const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

/**
 * CONFIGURATION & API KEYS
 */
const GROQ_KEYS = [process.env.GROQ_API_KEY].filter(k => k);
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY; 

const YT_CLIENT_ID = process.env.YT_CLIENT_ID;
const YT_CLIENT_SECRET = process.env.YT_CLIENT_SECRET;
const YT_REFRESH_TOKEN = process.env.YT_REFRESH_TOKEN;

function robustJSONParse(text) {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        return JSON.parse(text.substring(start, end + 1));
    } catch (e) { return null; }
}

/**
 * STEP 1: THE BRAIN
 */
async function getContent() {
    console.log("🧠 Step 1: Generating 60-second Viral Script...");
    const topic = "How to go viral on YouTube in 2026"; 
    
    for (let key of GROQ_KEYS) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [
                    { 
                        role: "system", 
                        content: `You are a viral YouTube Shorts creator. Output ONLY JSON.
                        RULES:
                        1. SCENES: Provide EXACTLY 25 short scenes.
                        2. KEYWORDS: Each keyword MUST be a specific visual.
                        Return format: {"scenes": [{"text": "SCENE TEXT", "keyword": "search_term"}]}` 
                    },
                    { role: "user", content: `Topic: ${topic}` }
                ],
                response_format: { type: "json_object" }
            }, { headers: { 'Authorization': `Bearer ${key}` }, timeout: 30000 });

            const data = robustJSONParse(response.data.choices[0].message.content);
            if (data && data.scenes) return data.scenes;
        } catch (e) { console.warn("⚠️ Groq Key failed..."); }
    }
    throw new Error("Failed to generate script.");
}

/**
 * STEP 2 & 3: VOICE & FALLBACK MEDIA
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Natural Voiceover...");
    const fullScript = scenes.map(s => s.text).join(' ');
    execSync(`edge-tts --voice en-NG-AbeoNeural --text "${fullScript.replace(/["']/g, "")}" --write-media voice.mp3 --rate=+0%`);

    console.log("🎬 Step 3: Fetching Clips...");
    const downloadClip = async (scene, i) => {
        let videoUrl = null;
        const query = encodeURIComponent(scene.keyword);

        try {
            const res = await axios.get(`https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${query}&orientation=vertical&per_page=3`, { timeout: 8000 });
            if (res.data.hits?.length > 0) videoUrl = res.data.hits[0].videos.medium.url;
        } catch (e) {}

        if (!videoUrl && PEXELS_API_KEY) {
            try {
                const res = await axios.get(`https://api.pexels.com/videos/search?query=${query}&orientation=portrait&per_page=1`, {
                    headers: { 'Authorization': PEXELS_API_KEY }, timeout: 8000
                });
                if (res.data.videos?.length > 0) videoUrl = res.data.videos[0].video_files[0].link;
            } catch (e) {}
        }

        const path = `clip_${i}.mp4`;
        if (!videoUrl) {
            console.log(`⚠️ Using backup.mp4 for clip ${i}`);
            fs.copyFileSync('backup.mp4', path);
            return;
        }

        const writer = fs.createWriteStream(path);
        const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
        response.data.pipe(writer);
        return new Promise(r => writer.on('finish', r));
    };

    for (let i = 0; i < scenes.length; i += 5) {
        await Promise.all(scenes.slice(i, i + 5).map((s, idx) => downloadClip(s, i + idx)));
    }
    return scenes.map((_, i) => `clip_${i}.mp4`);
}

/**
 * STEP 4: PRECISE ASSEMBLY (SOLVING E2BIG ERROR)
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Syncing Subtitles via Filter Script...");
    const TOTAL_DURATION = 60; 
    const timePerScene = TOTAL_DURATION / scenes.length; 

    // We start the filter by labeling the first input [0:v]
    let filterString = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";
    const fontPath = "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf";
    
    let concatList = "";
    videoFiles.forEach((file) => { concatList += `file '${file}'\nduration ${timePerScene}\n`; });
    concatList += `file '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    let currentTime = 0;
    scenes.forEach((scene) => {
        const words = scene.text.split(' ');
        const timePerWord = timePerScene / words.length;

        words.forEach((word, wIdx) => {
            const start = currentTime + (wIdx * timePerWord);
            const end = start + timePerWord;
            const cleanWord = word.toUpperCase().replace(/[':;]/g, "");
            
            // We append each drawtext to the chain
            filterString += `,drawtext=fontfile='${fontPath}':text='${cleanWord}':fontcolor=yellow:fontsize=120:x=(w-text_w)/2:y=(h-text_h)/2:borderw=10:bordercolor=black:enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`;
        });
        currentTime += timePerScene;
    });

    // Add final output label
    filterString += "[outv]";

    // Write the massive filter string to a file to prevent E2BIG error
    fs.writeFileSync('filters.txt', filterString);

    // NEW COMMAND: Uses -filter_complex_script to read from the file
    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt -i voice.mp3 \
        -filter_complex_script filters.txt -map "[outv]" -map 1:a \
        -c:v libx264 -preset ultrafast -t 60 -c:a aac output.mp4`;
    
    execSync(cmd, { stdio: 'inherit' });
}

/**
 * STEP 5: UPLOAD
 */
async function uploadToYouTube(fullScript) {
    console.log("🚀 Step 5: Uploading...");
    if (!YT_CLIENT_ID || !YT_REFRESH_TOKEN) return;

    const oauth2Client = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: { title: 'Viral Strategy 2026 #Shorts', description: fullScript, categoryId: '27' },
            status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
        },
        media: { body: fs.createReadStream('output.mp4') }
    });
}

async function main() {
    try {
        const scenes = await getContent();
        const videoFiles = await processMedia(scenes);
        await assembleVideo(scenes, videoFiles);
        await uploadToYouTube(scenes.map(s => s.text).join(' '));
        console.log(`🏆 SUCCESS! E2BIG Error bypassed. Video posted.`);
    } catch (e) {
        console.error("🔥 ERROR:", e.message);
        process.exit(1);
    }
}

main();
