const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

/**
 * CONFIGURATION
 */
const GROQ_KEYS = [process.env.GROQ_API_KEY].filter(k => k);
const PEXELS_API_KEY = process.env.PEXELS_API_KEY; 
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

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
    console.log("🧠 Step 1: Generating Tutor Script...");
    const topic = "How to go viral on YouTube in 2026"; 
    
    for (let key of GROQ_KEYS) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [
                    { 
                        role: "system", 
                        content: `You are a professional YouTube Mentor. Output ONLY JSON.
                        RULES:
                        1. SCENES: Provide EXACTLY 35 very short scenes.
                        2. TONE: Confident, helpful, instructional. Use commas for natural pauses.
                        3. KEYWORDS: Specific physical objects only.
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
    throw new Error("Failed script generation.");
}

/**
 * STEP 2 & 3: VOICE & CLIP DOWNLOADS
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Pro Voice...");
    const fullScript = scenes.map(s => s.text).join(' ').replace(/["']/g, "");
    execSync(`edge-tts --voice en-US-GuyNeural --text "${fullScript}" --write-media voice.mp3 --rate=-10%`);

    console.log(`🎬 Step 3: Fetching 35 Clips (Pexels Priority)...`);
    const downloadClip = async (scene, i) => {
        let videoUrl = null;
        const query = encodeURIComponent(scene.keyword);

        if (PEXELS_API_KEY) {
            try {
                const res = await axios.get(`https://api.pexels.com/videos/search?query=${query}&orientation=portrait&per_page=1`, {
                    headers: { 'Authorization': PEXELS_API_KEY }, timeout: 8000
                });
                if (res.data.videos?.length > 0) videoUrl = res.data.videos[0].video_files[0].link;
            } catch (e) {}
        }

        if (!videoUrl && PIXABAY_API_KEY) {
            try {
                const res = await axios.get(`https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${query}&orientation=vertical&per_page=1`);
                if (res.data.hits?.length > 0) videoUrl = res.data.hits[0].videos.medium.url;
            } catch (e) {}
        }

        const path = `clip_${i}.mp4`;
        if (!videoUrl) {
            fs.copyFileSync('backup.mp4', path);
            return;
        }

        const writer = fs.createWriteStream(path);
        const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
        response.data.pipe(writer);
        return new Promise(r => writer.on('finish', r));
    };

    for (let i = 0; i < scenes.length; i += 7) {
        await Promise.all(scenes.slice(i, i + 7).map((s, idx) => downloadClip(s, i + idx)));
    }
    return scenes.map((_, i) => `clip_${i}.mp4`);
}

/**
 * STEP 4: PRECISION ASSEMBLY WITH BACKGROUND MUSIC
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Final Assembly with Background Music...");
    
    const actualAudioDuration = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`).toString());
    const totalScript = scenes.map(s => s.text).join(' ');
    const totalWordsCount = totalScript.split(' ').length;
    const preciseTimePerWord = actualAudioDuration / totalWordsCount;

    let concatList = "";
    videoFiles.forEach((file) => { concatList += `file '${file}'\nduration ${actualAudioDuration / scenes.length}\n`; });
    concatList += `file '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    // Filter logic with Hormozi Style
    let filterString = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";
    const fontPath = "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf";
    
    let currentTime = 0;
    scenes.forEach((scene) => {
        const words = scene.text.split(' ');
        words.forEach((word) => {
            const start = currentTime;
            const end = start + preciseTimePerWord;
            const cleanWord = word.toUpperCase().replace(/[':;]/g, "");
            filterString += `,drawtext=fontfile='${fontPath}':text='${cleanWord}':fontcolor=yellow:fontsize=150:x=(w-text_w)/2:y=(h-text_h)/2:borderw=20:bordercolor=black:enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`;
            currentTime = end;
        });
    });

    filterString += "[outv]";
    fs.writeFileSync('filters.txt', filterString);

    // Check for background music file, otherwise skip mixing
    let audioInput = "-i voice.mp3";
    let audioFilter = '[1:a]copy[aout]'; // Default: just the voice
    
    if (fs.existsSync('background.mp3')) {
        console.log("🎵 Mixing background.mp3...");
        audioInput = "-i voice.mp3 -i background.mp3";
        // Mix voice (1:a) at 100% and music (2:a) at 12% volume
        audioFilter = '[2:a]volume=0.12[bg];[1:a][bg]amix=inputs=2:duration=first[aout]';
    } else {
        console.log("⚠️ background.mp3 not found. Video will have no music.");
    }

    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt ${audioInput} \
        -filter_complex_script filters.txt \
        -filter_complex "${audioFilter}" \
        -map "[outv]" -map "[aout]" \
        -c:v libx264 -preset ultrafast -t ${actualAudioDuration} -c:a aac output.mp4`;
    
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
        console.log(`🏆 SUCCESS! Everything synced with background music.`);
    } catch (e) {
        console.error("🔥 ERROR:", e.message);
        process.exit(1);
    }
}

main();
