const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const textToSpeech = require('@google-cloud/text-to-speech');
const { google } = require('googleapis');

// Configuration
const GROQ_KEYS = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2];
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

/**
 * HELPER: Robust JSON Extractor
 * Strips "Here is your JSON" or markdown code blocks automatically.
 */
function extractJSON(raw) {
    try {
        const match = raw.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch (e) {
        return null;
    }
}

/**
 * STEP 1: THE BRAIN (High-Energy & Resilient)
 */
async function getScript() {
    console.log("🧠 Step 1: Brainstorming Detailed Viral Script...");
    
    for (let i = 0; i < GROQ_KEYS.length; i++) {
        const currentKey = GROQ_KEYS[i];
        if (!currentKey) continue;

        try {
            console.log(`📡 Attempting with Key ${i + 1}...`);
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [
                    { 
                        role: "system", 
                        content: "You are a world-class YouTube growth expert. You speak in a high-energy, 'Hormozi' style. Output ONLY raw JSON." 
                    },
                    { 
                        role: "user", 
                        content: `Create a 60-second viral script about 'How to make $10k/month with AI'. 
                        The script must have a strong hook, three value points, and a call to action. 
                        Return exactly this format: {"script": "full text here", "search_term": "luxury office"}` 
                    }
                ],
                response_format: { type: "json_object" }
            }, { 
                headers: { 'Authorization': `Bearer ${currentKey}` },
                timeout: 45000 
            });

            const rawText = response.data.choices[0].message.content;
            const data = extractJSON(rawText);

            if (!data || !data.script) throw new Error("Invalid JSON structure received.");
            
            console.log("✅ Success! Detailed Script Acquired.");
            return data;

        } catch (error) {
            console.warn(`⚠️ Key ${i + 1} failed: ${error.message}`);
            if (i === GROQ_KEYS.length - 1) throw new Error("FATAL: All Groq Keys Exhausted.");
        }
    }
}

/**
 * STEP 2: THE VOICE (With Auto-Retry)
 */
async function generateAudio(text, retry = 3) {
    console.log("🎙️ Step 2: Generating Nigerian Voiceover (Wavenet)...");
    const client = new textToSpeech.TextToSpeechClient();

    for (let attempt = 1; attempt <= retry; attempt++) {
        try {
            const [response] = await client.synthesizeSpeech({
                input: { text },
                voice: { languageCode: 'en-NG', name: 'en-NG-Wavenet-B', ssmlGender: 'MALE' },
                audioConfig: { audioEncoding: 'MP3', pitch: 0, speakingRate: 1.1 },
            });
            fs.writeFileSync('voice.mp3', response.audioContent, 'binary');
            return;
        } catch (e) {
            console.warn(`⚠️ Voiceover attempt ${attempt} failed. Retrying...`);
            if (attempt === retry) throw e;
            await new Promise(res => setTimeout(res, 2000));
        }
    }
}

/**
 * STEP 3: THE EYES (Pixabay)
 */
async function getVisuals(keyword) {
    console.log(`🎬 Step 3: Fetching vertical footage for: ${keyword}...`);
    let videoUrl = "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4";

    try {
        const res = await axios.get(`https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&orientation=vertical`);
        if (res.data.hits?.length > 0) videoUrl = res.data.hits[0].videos.large.url;
    } catch (e) {
        console.warn("⚠️ Pixabay API hiccup, using safety footage.");
    }

    const writer = fs.createWriteStream('background.mp4');
    const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    return new Promise((resolve) => writer.on('finish', resolve));
}

/**
 * STEP 4: THE EDITOR (FFmpeg Stability Fix)
 */
async function assembleVideo() {
    console.log("✂️ Step 4: Final Assembly (Hormozi Style)...");
    try {
        // We use a simpler FFmpeg command to avoid font path errors on different OS
        const cmd = `ffmpeg -y -stream_loop -1 -i background.mp4 -i voice.mp3 \
            -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,drawtext=text='RICH DADDY YO':fontcolor=yellow:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2+200:borderw=4:bordercolor=black" \
            -c:v libx264 -preset ultrafast -c:a aac -shortest output.mp4`;
        execSync(cmd, { stdio: 'inherit' });
    } catch (e) {
        console.error("❌ FFmpeg Assembly Failed:", e.message);
        throw e;
    }
}

/**
 * STEP 5: THE DELIVERY (YouTube @RichDaddyYo)
 */
async function uploadToYouTube(script) {
    console.log("🚀 Step 5: Uploading to @RichDaddyYo...");
    const oauth2Client = new google.auth.OAuth2(process.env.YT_CLIENT_ID, process.env.YT_CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: process.env.YT_REFRESH_TOKEN });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: { title: 'AI Wealth Secret #Shorts', description: script, categoryId: '27' },
            status: { privacyStatus: 'private', selfDeclaredMadeForKids: false }
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
        console.log("⭐ MISSION SUCCESSFUL: Video is uploaded!");
    } catch (e) {
        console.error("🔥 CRITICAL ENGINE ERROR:", e.message);
        process.exit(1);
    }
}

main();
