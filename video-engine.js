const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const textToSpeech = require('@google-cloud/text-to-speech');
const { google } = require('googleapis');

// Configuration
const GROQ_KEYS = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(k => k);
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

/**
 * UTILITY: JSON Extraction (The "Cleaner")
 * Fixes "Unexpected end of JSON" by finding the first { and last }
 */
function robustJSONParse(text) {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        const jsonStr = text.substring(start, end + 1);
        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
}

/**
 * STEP 1: THE BRAIN (Groq Multi-Key Fallback)
 */
async function getScript() {
    console.log("🧠 Step 1: Brainstorming Detailed Script...");
    for (let i = 0; i < GROQ_KEYS.length; i++) {
        try {
            console.log(`📡 Attempting Groq Key ${i + 1}...`);
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: "You are a viral content bot. Output ONLY raw JSON." },
                    { role: "user", content: "Create a 60-second script for 'AI Passive Income'. Format: {\"script\": \"...\", \"search_term\": \"money\"}" }
                ],
                response_format: { type: "json_object" }
            }, { 
                headers: { 'Authorization': `Bearer ${GROQ_KEYS[i]}` },
                timeout: 50000 
            });

            const data = robustJSONParse(response.data.choices[0].message.content);
            if (data && data.script) {
                console.log("✅ Script Acquired.");
                return data;
            }
        } catch (e) {
            console.warn(`⚠️ Key ${i+1} failed: ${e.message}`);
        }
    }
    throw new Error("FATAL: All Groq Keys failed.");
}

/**
 * STEP 2: THE VOICE (Nigerian Male Wavenet)
 */
async function generateAudio(text) {
    console.log("🎙️ Step 2: Generating Nigerian Voiceover...");
    try {
        const client = new textToSpeech.TextToSpeechClient();
        const request = {
            input: { text },
            voice: { languageCode: 'en-NG', name: 'en-NG-Wavenet-B', ssmlGender: 'MALE' },
            audioConfig: { audioEncoding: 'MP3', speakingRate: 1.15 },
        };
        const [response] = await client.synthesizeSpeech(request);
        fs.writeFileSync('voice.mp3', response.audioContent, 'binary');
    } catch (e) {
        console.error("❌ Voiceover Error. Check Google Cloud Billing/API:", e.message);
        throw e;
    }
}

/**
 * STEP 3: THE EYES (Pixabay)
 */
async function getVisuals(keyword) {
    console.log(`🎬 Step 3: Fetching footage for: ${keyword}...`);
    let videoUrl = "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4";
    try {
        const res = await axios.get(`https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&orientation=vertical`);
        if (res.data.hits?.length > 0) videoUrl = res.data.hits[0].videos.large.url;
    } catch (e) { console.warn("⚠️ Pixabay failed, using fallback."); }

    const writer = fs.createWriteStream('background.mp4');
    const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    return new Promise((resolve) => writer.on('finish', resolve));
}

/**
 * STEP 4: THE EDITOR (Hormozi Style)
 */
async function assembleVideo() {
    console.log("✂️ Step 4: Final Assembly...");
    // Draws yellow text with black borders in the center. 
    // Uses standard Arial for maximum compatibility in GitHub Actions.
    const cmd = `ffmpeg -y -stream_loop -1 -i background.mp4 -i voice.mp3 \
        -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,drawtext=text='RICH DADDY YO':fontcolor=yellow:fontsize=90:x=(w-text_w)/2:y=(h-text_h)/2:borderw=5:bordercolor=black" \
        -c:v libx264 -preset ultrafast -c:a aac -shortest output.mp4`;
    execSync(cmd, { stdio: 'inherit' });
}

/**
 * STEP 5: THE DELIVERY (YouTube @RichDaddyYo)
 */
async function uploadToYouTube(script) {
    console.log("🚀 Step 5: Uploading Private Test...");
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
        console.log("⭐ MISSION SUCCESSFUL!");
    } catch (e) {
        console.error("🔥 ENGINE CRASHED:", e.message);
        process.exit(1);
    }
}

main();
    
