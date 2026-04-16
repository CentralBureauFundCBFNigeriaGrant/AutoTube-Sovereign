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

// YouTube Credentials
const YT_CLIENT_ID = process.env.YT_CLIENT_ID;
const YT_CLIENT_SECRET = process.env.YT_CLIENT_SECRET;
const YT_REFRESH_TOKEN = process.env.YT_REFRESH_TOKEN;

/**
 * HELPER: Robust JSON Parsing
 */
function robustJSONParse(text) {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        return JSON.parse(text.substring(start, end + 1));
    } catch (e) { return null; }
}

/**
 * STEP 1: THE BRAIN (Script Generation via Groq)
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
                        content: "You are a YouTube Growth Expert. Output ONLY JSON. Break script into 12-15 short scenes (3-6 words each). Style: Aggressive, high-energy. Return format: {\"scenes\": [{\"text\": \"SCENE TEXT\", \"keyword\": \"search_term\"}]}" 
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
 * STEP 2 & 3: VOICE & CONCURRENT MEDIA DOWNLOADS
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Nigerian Voiceover...");
    const fullScript = scenes.map(s => s.text).join(' ');
    // We use Abeo (Nigerian Male) and a slightly faster rate for engagement
    execSync(`edge-tts --voice en-NG-AbeoNeural --text "${fullScript.replace(/"/g, '')}" --write-media voice.mp3 --rate=+5%`);

    console.log("🎬 Step 3: Fetching Clips in Parallel...");
    const downloadClip = async (scene, i) => {
        let videoUrl = "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4"; // Default Safety
        
        try {
            // Try Pixabay First
            const pxa = await axios.get(`https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(scene.keyword)}&orientation=vertical&per_page=3`, { timeout: 10000 });
            if (pxa.data.hits?.length > 0) {
                videoUrl = pxa.data.hits[0].videos.medium.url;
            } else if (PEXELS_API_KEY) {
                // Fallback to Pexels
                const pex = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(scene.keyword)}&orientation=portrait&per_page=1`, {
                    headers: { 'Authorization': PEXELS_API_KEY }, timeout: 10000
                });
                if (pex.data.videos?.length > 0) videoUrl = pex.data.videos[0].video_files[0].link;
            }
        } catch (e) { console.log(`⚠️ Clip ${i} fetch error, using backup.`); }

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
 * STEP 4: TURBO ASSEMBLY (FFmpeg)
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Rapid Rendering...");
    
    const listContent = videoFiles.map(f => `file '${f}'`).join('\n');
    fs.writeFileSync('inputs.txt', listContent);

    const fontPath = "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf";
    let filterString = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";
    
    let currentTime = 0;
    const wordsPerSec = 2.4; // Average speed of Nigerian voice at +5%

    scenes.forEach((scene) => {
        const duration = scene.text.split(' ').length / wordsPerSec;
        const endTime = currentTime + duration;
        const cleanText = scene.text.toUpperCase().replace(/[':;]/g, "");

        // HORMOZI STYLE: Yellow, Bold, Central, Shadow
        filterString += `,drawtext=fontfile='${fontPath}':text='${cleanText}':fontcolor=yellow:fontsize=105:x=(w-text_w)/2:y=(h-text_h)/2:borderw=8:bordercolor=black:enable='between(t,${currentTime},${endTime})'`;
        
        currentTime = endTime;
    });

    // TURBO COMMAND: Ultrafast preset + No threads limit
    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt -i voice.mp3 \
        -vf "${filterString}" -c:v libx264 -preset ultrafast -threads 0 -crf 28 -c:a aac -shortest output.mp4`;
    
    execSync(cmd, { stdio: 'inherit' });
}

/**
 * STEP 5: YOUTUBE UPLOAD
 */
async function uploadToYouTube(fullScript) {
    console.log("🚀 Step 5: Uploading to @RichDaddyYo...");
    if (!YT_CLIENT_ID || !YT_REFRESH_TOKEN) {
        console.log("⏩ Skipping upload: Credentials not set.");
        return;
    }

    const oauth2Client = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: { title: 'How to Go Viral (2026 Strategy) #Shorts', description: fullScript, categoryId: '27' },
            status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
        },
        media: { body: fs.createReadStream('output.mp4') }
    });
}

/**
 * MAIN EXECUTION
 */
async function main() {
    try {
        const startTime = Date.now();
        const scenes = await getContent();
        const videoFiles = await processMedia(scenes);
        await assembleVideo(scenes, videoFiles);
        await uploadToYouTube(scenes.map(s => s.text).join(' '));
        
        const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        console.log(`🏆 DONE! Total time: ${totalTime} minutes.`);
    } catch (e) {
        console.error("🔥 SYSTEM CRASH:", e.message);
        process.exit(1);
    }
}

main();
            
