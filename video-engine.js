const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

/**
 * CONFIGURATION
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
 * STEP 1: THE BRAIN (Now with 25 Precise Scenes)
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
                        content: `You are a YouTube Shorts expert. Output ONLY JSON.
                        RULES:
                        1. SCENES: Provide EXACTLY 25 short scenes.
                        2. TOTAL WORDS: Total script must be around 140-150 words (perfect for 60 seconds).
                        3. KEYWORDS: The 'keyword' for each scene MUST be a physical object or action (e.g., 'fast car', 'man thinking', 'exploding rocket') that Pixabay can find.
                        4. HOOK: Start with a high-energy scroll-stopper.
                        5. CTA: End with "Subscribe for more viral secrets!"
                        Return format: {"scenes": [{"text": "SCENE TEXT", "keyword": "search_term"}]}` 
                    },
                    { role: "user", content: `Topic: ${topic}` }
                ],
                response_format: { type: "json_object" }
            }, { headers: { 'Authorization': `Bearer ${key}` }, timeout: 30000 });

            const data = robustJSONParse(response.data.choices[0].message.content);
            if (data && data.scenes && data.scenes.length >= 20) return data.scenes;
        } catch (e) { console.warn("⚠️ Groq Key failed, retrying..."); }
    }
    throw new Error("Failed to generate script.");
}

/**
 * STEP 2 & 3: VOICE & CLIP FETCHING
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Natural Voiceover...");
    const fullScript = scenes.map(s => s.text).join(' ');
    const safeScript = fullScript.replace(/["']/g, "");
    
    // REMOVED +10% rate for natural human pace
    execSync(`edge-tts --voice en-NG-AbeoNeural --text "${safeScript}" --write-media voice.mp3 --rate=+0%`);

    console.log(`🎬 Step 3: Fetching ${scenes.length} Clips...`);
    const downloadClip = async (scene, i) => {
        let videoUrl = "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4"; 
        try {
            const pxa = await axios.get(`https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(scene.keyword)}&orientation=vertical&per_page=3`, { timeout: 10000 });
            if (pxa.data.hits?.length > 0) {
                videoUrl = pxa.data.hits[0].videos.medium.url;
            }
        } catch (e) { console.log(`⚠️ Clip ${i} keyword: ${scene.keyword} not found, using backup.`); }

        const path = `clip_${i}.mp4`;
        const writer = fs.createWriteStream(path);
        const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
        response.data.pipe(writer);
        return new Promise(r => writer.on('finish', r));
    };

    // Download in batches of 5 to avoid hitting API rate limits
    for (let i = 0; i < scenes.length; i += 5) {
        const batch = scenes.slice(i, i + 5).map((s, idx) => downloadClip(s, i + idx));
        await Promise.all(batch);
    }
    return scenes.map((_, i) => `clip_${i}.mp4`);
}

/**
 * STEP 4: PRECISE ASSEMBLY
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Syncing Subtitles and 25 Clips...");
    
    // We force each clip to be exactly its portion of the 60 seconds
    const TOTAL_DURATION = 60; 
    const timePerScene = TOTAL_DURATION / scenes.length; // 60 / 25 = 2.4s per clip

    let filterString = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";
    const fontPath = "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf";
    
    let currentTime = 0;
    
    // Prepare the list of clips with specific durations for FFmpeg concat
    let concatList = "";
    videoFiles.forEach((file, i) => {
        concatList += `file '${file}'\nduration ${timePerScene}\n`;
    });
    // Final file entry requires no duration or a repeat to close properly
    concatList += `file '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    scenes.forEach((scene, sIdx) => {
        const words = scene.text.split(' ');
        const timePerWord = timePerScene / words.length;

        words.forEach((word, wIdx) => {
            const wordStart = currentTime + (wIdx * timePerWord);
            const wordEnd = wordStart + timePerWord;
            const cleanWord = word.toUpperCase().replace(/[':;]/g, "");

            filterString += `,drawtext=fontfile='${fontPath}':text='${cleanWord}':fontcolor=yellow:fontsize=110:x=(w-text_w)/2:y=(h-text_h)/2:borderw=10:bordercolor=black:enable='between(t,${wordStart.toFixed(2)},${wordEnd.toFixed(2)})'`;
        });
        
        currentTime += timePerScene;
    });

    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt -i voice.mp3 \
        -filter_complex "[0:v]${filterString}[outv]" -map "[outv]" -map 1:a \
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
            snippet: { 
                title: 'How to Go Viral in 2026 #Shorts', 
                description: fullScript, 
                categoryId: '27' 
            },
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
        console.log(`🏆 SUCCESS: 60s Video Uploaded.`);
    } catch (e) {
        console.error("🔥 ERROR:", e.message);
        process.exit(1);
    }
}

main();
            
