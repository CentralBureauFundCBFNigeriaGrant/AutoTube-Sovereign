const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

// Configuration
const GROQ_KEYS = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(k => k);
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

/**
 * UTILITY: Word Wrap for FFmpeg
 * Prevents text from going off-screen by splitting long lines.
 */
function wrapText(text, maxChars = 15) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = "";
    words.forEach(word => {
        if ((currentLine + word).length > maxChars) {
            lines.push(currentLine.trim());
            currentLine = word + " ";
        } else {
            currentLine += word + " ";
        }
    });
    lines.push(currentLine.trim());
    return lines.join('\n');
}

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
 * STEP 1: THE BRAIN (Ultra-Short Scenes for Fast Switching)
 */
async function getContent() {
    console.log("🧠 Step 1: Generating High-Speed Hormozi Script...");
    for (let i = 0; i < GROQ_KEYS.length; i++) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [
                    { 
                        role: "system", 
                        content: "You are a viral creator. Respond ONLY with JSON. Break the 58-second script into 15+ micro-scenes. Each scene must be 3-6 words MAX. This ensures the video switches VERY FAST." 
                    },
                    { 
                        role: "user", 
                        content: `Topic: 'AI Wealth Secret'. Return format: {"scenes": [{"text": "STOP WASTING TIME.", "keyword": "angry man"}, {"text": "AI IS THE KEY.", "keyword": "digital brain"}]}` 
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
 * STEP 2 & 3: VOICE & DUAL-API VISUALS
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Voiceover...");
    const fullScript = scenes.map(s => s.text).join(' ');
    // Natural rate (+0%) for clean pronunciation
    const voiceCmd = `edge-tts --voice en-NG-AbeoNeural --text "${fullScript.replace(/"/g, '')}" --write-media voice.mp3 --rate=+0%`;
    execSync(voiceCmd);

    const videoFiles = [];
    for (let i = 0; i < scenes.length; i++) {
        const filename = `clip_${i}.mp4`;
        const keyword = scenes[i].keyword;
        let videoUrl = null;

        try {
            const pxa = await axios.get(`https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&orientation=vertical&per_page=3`);
            if (pxa.data.hits?.length > 0) videoUrl = pxa.data.hits[0].videos.large.url;
        } catch (e) {}

        if (!videoUrl && PEXELS_API_KEY) {
            try {
                const pex = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&orientation=portrait&per_page=1`, {
                    headers: { 'Authorization': PEXELS_API_KEY }
                });
                if (pex.data.videos?.length > 0) videoUrl = pex.data.videos[0].video_files.find(f => f.quality === 'hd').link;
            } catch (e) {}
        }

        if (!videoUrl) videoUrl = "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4";

        const writer = fs.createWriteStream(filename);
        const stream = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
        stream.data.pipe(writer);
        await new Promise(r => writer.on('finish', r));
        videoFiles.push(filename);
    }
    return videoFiles;
}

/**
 * STEP 4: THE EDITOR (The "Perfect Hormozi" Subtitles)
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Mastering Hormozi Style...");
    
    const listContent = videoFiles.map(f => `file '${f}'`).join('\n');
    fs.writeFileSync('inputs.txt', listContent);

    // Font path for Ubuntu (GitHub Actions)
    const fontPath = "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf";

    let filterString = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";
    let currentTime = 0;
    const wordsPerSecond = 2.4; 

    scenes.forEach((scene) => {
        const duration = scene.text.split(' ').length / wordsPerSecond;
        const endTime = currentTime + duration;
        
        // Wrap text to ensure it stays in the middle and doesn't cut off
        const wrappedText = wrapText(scene.text.toUpperCase(), 12);
        const escapedText = wrappedText.replace(/'/g, "").replace(/:/g, "\\:");

        // MASSIVE YELLOW TEXT | THICK BORDER | CENTERED
        filterString += `,drawtext=fontfile='${fontPath}':text='${escapedText}':fontcolor=yellow:fontsize=110:x=(w-text_w)/2:y=(h-text_h)/2:borderw=12:bordercolor=black:line_spacing=10:enable='between(t,${currentTime},${endTime})'`;
        
        currentTime = endTime;
    });

    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt -i voice.mp3 \
        -vf "${filterString}" -c:v libx264 -preset ultrafast -c:a aac -shortest output.mp4`;
    
    execSync(cmd, { stdio: 'inherit' });
}

async function uploadToYouTube(fullScript) {
    console.log("🚀 Step 5: Uploading...");
    const oauth2Client = new google.auth.OAuth2(process.env.YT_CLIENT_ID, process.env.YT_CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: process.env.YT_REFRESH_TOKEN });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: { title: 'The AI Money Secret #Shorts', description: fullScript, categoryId: '27' },
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
        console.log("🏆 V8 SUCCESSFUL!");
    } catch (e) {
        console.error("🔥 ERROR:", e.message);
        process.exit(1);
    }
}
main();
