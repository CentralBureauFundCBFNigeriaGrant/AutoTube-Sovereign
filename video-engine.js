const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

/**
 * CONFIG & API KEYS
 */
const GROQ_KEYS = [process.env.GROQ_API_KEY].filter(k => k);
const PEXELS_API_KEY = process.env.PEXELS_API_KEY; 
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

const YT_CLIENT_ID = process.env.YT_CLIENT_ID;
const YT_CLIENT_SECRET = process.env.YT_CLIENT_SECRET;
const YT_REFRESH_TOKEN = process.env.YT_REFRESH_TOKEN;

/**
 * STEP 1: THE BRAIN (Now 35 Scenes for 60s)
 */
async function getContent() {
    console.log("🧠 Step 1: Generating 35 Scenes for High Retention...");
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
                        1. SCENES: Provide EXACTLY 35 very short scenes (approx 4 words each).
                        2. KEYWORDS: Keywords must be physical and common (e.g., 'office', 'money', 'forest', 'city') to ensure Pexels finds them.
                        Return format: {"scenes": [{"text": "SCENE TEXT", "keyword": "search_term"}]}` 
                    },
                    { role: "user", content: `Topic: ${topic}` }
                ],
                response_format: { type: "json_object" }
            }, { headers: { 'Authorization': `Bearer ${key}` }, timeout: 30000 });

            const data = JSON.parse(response.data.choices[0].message.content);
            if (data && data.scenes) return data.scenes;
        } catch (e) { console.warn("⚠️ Groq Key failed..."); }
    }
    throw new Error("Failed script generation.");
}

/**
 * STEP 2 & 3: VOICE & CLIP DOWNLOADS
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Pro Voice + VTT Subtitles...");
    const fullScript = scenes.map(s => s.text).join(' ').replace(/["']/g, "");
    
    // We use GuyNeural and tell edge-tts to export a .vtt file for 100% sync
    execSync(`edge-tts --voice en-US-GuyNeural --text "${fullScript}" --write-media voice.mp3 --write-subtitles subs.vtt`);

    console.log(`🎬 Step 3: Fetching 35 Clips (Pexels-First)...`);
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
 * STEP 4: TURBO ASSEMBLY
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Final Assembly...");
    
    // Calculate scene duration based on audio file length
    const audioDuration = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`).toString());
    const timePerScene = audioDuration / scenes.length;

    let concatList = "";
    videoFiles.forEach((file) => { concatList += `file '${file}'\nduration ${timePerScene}\n`; });
    concatList += `file '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    // SUBTITLE STYLE: We use the .vtt file directly now for 100% sync
    // This centers the text and gives it the yellow/bold look
    const style = "Alignment=10,FontSize=24,PrimaryColour=&H00FFFF&,OutlineColour=&H000000&,BorderStyle=3,Outline=1,Shadow=0,Fontname=Arial Black";

    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt -i voice.mp3 \
        -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,subtitles=subs.vtt:force_style='${style}'" \
        -c:v libx264 -preset ultrafast -t ${audioDuration} -c:a aac output.mp4`;
    
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
            snippet: { title: 'Viral Mentor Strategy 2026 #Shorts', description: fullScript, categoryId: '27' },
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
        console.log(`🏆 SUCCESS! Everything synced.`);
    } catch (e) {
        console.error("🔥 ERROR:", e.message);
        process.exit(1);
    }
}

main();
