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
 * STEP 1: THE BRAIN (Now with Viral Hook & CTA)
 */
async function getContent() {
    console.log("🧠 Step 1: Generating Viral Script...");
    const topic = "How to go viral on YouTube in 2026"; 
    
    for (let key of GROQ_KEYS) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [
                    { 
                        role: "system", 
                        content: `You are a viral YouTube Shorts expert. Output ONLY JSON.
                        RULES:
                        1. HOOK: The first scene must be a high-energy "scroll-stopper."
                        2. CTA: The last scene MUST say "Subscribe for more viral secrets!"
                        3. FORMAT: Break script into 15-20 very short scenes (2-4 words each).
                        Return format: {"scenes": [{"text": "SCENE TEXT", "keyword": "search_term"}]}` 
                    },
                    { role: "user", content: `Topic: ${topic}` }
                ],
                response_format: { type: "json_object" }
            }, { headers: { 'Authorization': `Bearer ${key}` }, timeout: 30000 });

            const data = robustJSONParse(response.data.choices[0].message.content);
            if (data && data.scenes) return data.scenes;
        } catch (e) { console.warn("⚠️ Groq Key failed, retrying..."); }
    }
    throw new Error("Failed to generate script.");
}

/**
 * STEP 2 & 3: VOICE & MEDIA
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Nigerian Voiceover...");
    const fullScript = scenes.map(s => s.text).join(' ');
    // Added --rate=+10% for more energy and fixed quote escaping
    const safeScript = fullScript.replace(/["']/g, "");
    execSync(`edge-tts --voice en-NG-AbeoNeural --text "${safeScript}" --write-media voice.mp3 --rate=+10%`);

    console.log("🎬 Step 3: Fetching Clips...");
    const downloadClip = async (scene, i) => {
        let videoUrl = "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4"; 
        try {
            const pxa = await axios.get(`https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(scene.keyword)}&orientation=vertical&per_page=3`, { timeout: 10000 });
            if (pxa.data.hits?.length > 0) {
                videoUrl = pxa.data.hits[0].videos.medium.url;
            } else if (PEXELS_API_KEY) {
                const pex = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(scene.keyword)}&orientation=portrait&per_page=1`, {
                    headers: { 'Authorization': PEXELS_API_KEY }, timeout: 10000
                });
                if (pex.data.videos?.length > 0) videoUrl = pex.data.videos[0].video_files[0].link;
            }
        } catch (e) { console.log(`⚠️ Clip ${i} fetch error.`); }

        const path = `clip_${i}.mp4`;
        const writer = fs.createWriteStream(path);
        const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
        response.data.pipe(writer);
        return new Promise(r => writer.on('finish', r));
    };

    await Promise.all(scenes.map((s, i) => downloadClip(s, i)));
    return scenes.map((_, i) => `clip_${i}.mp4`);
}

/**
 * STEP 4: TURBO ASSEMBLY (Word-for-Word Subtitles Fix)
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Rapid Rendering with Pop Subtitles...");
    
    const listContent = videoFiles.map(f => `file '${f}'`).join('\n');
    fs.writeFileSync('inputs.txt', listContent);

    const fontPath = "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf";
    let filterString = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";
    
    let currentTime = 0;
    const wordsPerSec = 2.6; // Adjusted for +10% speed

    scenes.forEach((scene) => {
        const words = scene.text.split(' ');
        const sceneDuration = words.length / wordsPerSec;
        const timePerWord = sceneDuration / words.length;

        words.forEach((word, index) => {
            const wordStart = currentTime + (index * timePerWord);
            const wordEnd = wordStart + timePerWord;
            const cleanWord = word.toUpperCase().replace(/[':;]/g, "");

            // NEW: Word-for-word timing logic
            filterString += `,drawtext=fontfile='${fontPath}':text='${cleanWord}':fontcolor=yellow:fontsize=120:x=(w-text_w)/2:y=(h-text_h)/2:borderw=10:bordercolor=black:enable='between(t,${wordStart.toFixed(2)},${wordEnd.toFixed(2)})'`;
        });
        
        currentTime += sceneDuration;
    });

    // Fix: Explicitly map audio (-map 0:v -map 1:a) to ensure voice.mp3 is used
    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt -i voice.mp3 \
        -filter_complex "[0:v]${filterString}[outv]" -map "[outv]" -map 1:a \
        -c:v libx264 -preset ultrafast -crf 28 -c:a aac -shortest output.mp4`;
    
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
            snippet: { title: 'Viral YouTube Secret 2026 #Shorts', description: fullScript, categoryId: '27' },
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
        console.log(`🏆 DONE! Check your channel!`);
    } catch (e) {
        console.error("🔥 SYSTEM CRASH:", e.message);
        process.exit(1);
    }
}

main();
                   
