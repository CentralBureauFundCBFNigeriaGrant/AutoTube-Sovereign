const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

// Configuration
const GROQ_KEYS = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(k => k);
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

/**
 * UTILITY: JSON Extraction (Clean and precise)
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
 * STEP 1: THE BRAIN (Multi-Scene Logic)
 */
async function getContent() {
    console.log("🧠 Step 1: Generating Scene-by-Scene Script...");
    for (let i = 0; i < GROQ_KEYS.length; i++) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [
                    { 
                        role: "system", 
                        content: "You are a viral YouTube creator. Output ONLY JSON. No stage directions like 'Scene 1' or 'Intro'. No quotes. Just the spoken words." 
                    },
                    { 
                        role: "user", 
                        content: `Create a 58-second high-energy script about 'The Secret to AI Wealth'. 
                        Break it into 10 scenes. 
                        Format: {"scenes": [{"text": "Imagine making money while you sleep.", "keyword": "luxury bedroom"}, {"text": "AI does the work for you.", "keyword": "robot technology"}]}` 
                    }
                ],
                response_format: { type: "json_object" }
            }, { headers: { 'Authorization': `Bearer ${GROQ_KEYS[i]}` }, timeout: 50000 });

            const data = robustJSONParse(response.data.choices[0].message.content);
            if (data && data.scenes) return data.scenes;
        } catch (e) { console.warn(`⚠️ Key ${i+1} failed.`); }
    }
    throw new Error("All Groq keys failed.");
}

/**
 * STEP 2: THE VOICE & THE EYES (Multi-Clip Fetching)
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Voiceover...");
    const fullScript = scenes.map(s => s.text).join(' ');
    const voiceCmd = `edge-tts --voice en-NG-AbeoNeural --text "${fullScript.replace(/"/g, '')}" --write-media voice.mp3 --rate=+20%`;
    execSync(voiceCmd);

    const videoFiles = [];
    for (let i = 0; i < scenes.length; i++) {
        const filename = `clip_${i}.mp4`;
        console.log(`🎬 Fetching Clip ${i+1}/${scenes.length} for: ${scenes[i].keyword}`);
        
        let videoUrl = "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4";
        try {
            const res = await axios.get(`https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(scenes[i].keyword)}&orientation=vertical`);
            if (res.data.hits?.length > 0) videoUrl = res.data.hits[0].videos.large.url;
        } catch (e) { console.warn("Fallback clip used."); }

        const writer = fs.createWriteStream(filename);
        const stream = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
        stream.data.pipe(writer);
        await new Promise(r => writer.on('finish', r));
        videoFiles.push(filename);
    }
    return videoFiles;
}

/**
 * STEP 4: THE EDITOR (The Hormozi "Pop" Filter)
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Mastering Video with Hormozi Subtitles...");
    
    const listContent = videoFiles.map(f => `file '${f}'`).join('\n');
    fs.writeFileSync('inputs.txt', listContent);

    let filterString = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";
    let currentTime = 0;
    const wordsPerSecond = 3.0; // Dynamic pacing

    scenes.forEach((scene) => {
        const duration = scene.text.split(' ').length / wordsPerSecond;
        const endTime = currentTime + duration;
        const cleanText = scene.text.toUpperCase().replace(/'/g, "");
        
        // BOLD YELLOW TEXT + THICK BLACK BORDER
        filterString += `,drawtext=text='${cleanText}':fontcolor=yellow:fontsize=85:x=(w-text_w)/2:y=(h-text_h)/2:borderw=8:bordercolor=black:enable='between(t,${currentTime},${endTime})'`;
        
        currentTime = endTime;
    });

    // Branding Watermark
    filterString += `,drawtext=text='@RICHDADDYYO':fontcolor=white@0.3:fontsize=40:x=(w-text_w)/2:y=h-150`;

    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt -i voice.mp3 \
        -vf "${filterString}" -c:v libx264 -preset ultrafast -c:a aac -shortest output.mp4`;
    
    execSync(cmd, { stdio: 'inherit' });
}

/**
 * STEP 5: THE DELIVERY
 */
async function uploadToYouTube(fullScript) {
    console.log("🚀 Step 5: Uploading to @RichDaddyYo...");
    const oauth2Client = new google.auth.OAuth2(process.env.YT_CLIENT_ID, process.env.YT_CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: process.env.YT_REFRESH_TOKEN });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: { title: 'AI Wealth Secret #Shorts', description: fullScript, categoryId: '27' },
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
        console.log("🏆 MISSION COMPLETE: Video is LIVE!");
    } catch (e) {
        console.error("🔥 FATAL ERROR:", e.message);
        process.exit(1);
    }
}

main();
