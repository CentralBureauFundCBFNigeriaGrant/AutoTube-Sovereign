const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

// Configuration
const GROQ_KEYS = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(k => k);
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

/**
 * UTILITY: JSON Extraction
 */
function robustJSONParse(text) {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        const jsonStr = text.substring(start, end + 1);
        return JSON.parse(jsonStr);
    } catch (e) { return null; }
}

/**
 * STEP 1: THE BRAIN (Groq)
 */
async function getScript() {
    console.log("🧠 Step 1: Brainstorming Viral Script...");
    for (let i = 0; i < GROQ_KEYS.length; i++) {
        try {
            console.log(`📡 Trying Groq Key ${i + 1}...`);
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: "You are a viral YouTube creator. Output ONLY raw JSON." },
                    { role: "user", content: "Create a 58-second high-energy script about 'The AI Money Secret'. Format: {\"script\": \"...\", \"search_term\": \"finance\"}" }
                ],
                response_format: { type: "json_object" }
            }, { 
                headers: { 'Authorization': `Bearer ${GROQ_KEYS[i]}` },
                timeout: 50000 
            });

            const data = robustJSONParse(response.data.choices[0].message.content);
            if (data && data.script) return data;
        } catch (e) { console.warn(`⚠️ Key ${i+1} skipped.`); }
    }
    throw new Error("All Brain keys failed.");
}

/**
 * STEP 2: THE VOICE (Edge TTS - FREE & HIGH QUALITY)
 * Voice Used: en-NG-AbeoNeural (Nigerian Male)
 */
async function generateAudio(text) {
    console.log("🎙️ Step 2: Generating Edge AI Voice (Abeo - Nigeria)...");
    try {
        // We use the Python CLI tool we installed in the workflow
        // --rate=+15% makes the voice faster and more 'Hormozi' style
        const cmd = `edge-tts --voice en-NG-AbeoNeural --text "${text.replace(/"/g, '')}" --write-media voice.mp3 --rate=+15%`;
        execSync(cmd);
        console.log("✅ Voiceover generated: voice.mp3");
    } catch (e) {
        console.error("❌ Edge TTS Failed:", e.message);
        throw e;
    }
}

/**
 * STEP 3: THE EYES (Pixabay)
 */
async function getVisuals(keyword) {
    console.log(`🎬 Step 3: Finding footage for: ${keyword}...`);
    let videoUrl = "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4";
    try {
        const res = await axios.get(`https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&orientation=vertical`);
        if (res.data.hits?.length > 0) videoUrl = res.data.hits[0].videos.large.url;
    } catch (e) { console.warn("⚠️ Using fallback video."); }

    const writer = fs.createWriteStream('background.mp4');
    const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    return new Promise((resolve) => writer.on('finish', resolve));
}

/**
 * STEP 4: THE EDITOR (FFmpeg - Final Polish)
 */
async function assembleVideo() {
    console.log("✂️ Step 4: Final Assembly (1080x1920 Vertical)...");
    const cmd = `ffmpeg -y -stream_loop -1 -i background.mp4 -i voice.mp3 \
        -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,drawtext=text='RICH DADDY YO':fontcolor=yellow:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2+300:borderw=4:bordercolor=black" \
        -c:v libx264 -preset ultrafast -c:a aac -shortest output.mp4`;
    execSync(cmd, { stdio: 'inherit' });
}

/**
 * STEP 5: THE DELIVERY (YouTube @RichDaddyYo)
 */
async function uploadToYouTube(script) {
    console.log("🚀 Step 5: Uploading to YouTube...");
    const oauth2Client = new google.auth.OAuth2(process.env.YT_CLIENT_ID, process.env.YT_CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: process.env.YT_REFRESH_TOKEN });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: { title: 'AI Wealth Secret #Shorts', description: script, categoryId: '27' },
            status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
        },
        media: { body: fs.createReadStream('output.mp4') }
    });
}

async function main() {
    try {
        const content = await getScript();
        await generateAudio(content.script);
        await getVisuals(content.search_term);
        await assembleVideo();
        await uploadToYouTube(content.script);
        console.log("🏆 SUCCESS: Video is LIVE on @RichDaddyYo!");
    } catch (e) {
        console.error("🔥 ERROR:", e.message);
        process.exit(1);
    }
}

main();
