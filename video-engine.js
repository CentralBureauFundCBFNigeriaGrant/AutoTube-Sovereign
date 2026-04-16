const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const textToSpeech = require('@google-cloud/text-to-speech');
const { google } = require('googleapis');

// Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

/**
 * STEP 1: THE BRAIN (Stricter Prompting)
 */
async function getScript() {
    console.log("🧠 Step 1: Brainstorming Script...");
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: "You are a professional scriptwriter. Respond ONLY with a JSON object. No markdown, no backticks, no text before or after the JSON." },
                { role: "user", content: "Create a high-energy 55-second script about 'The Future of AI Wealth'. Return JSON: {\"script\": \"the text\", \"search_term\": \"technology\"}" }
            ],
            response_format: { type: "json_object" }
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });

        const data = JSON.parse(response.data.choices[0].message.content.trim());
        if (!data.script || !data.search_term) throw new Error("Incomplete JSON from Brain");
        
        console.log("✅ Script received for keyword:", data.search_term);
        return data;
    } catch (error) {
        console.error("❌ BRAIN ERROR:", error.message);
        // Emergency Fallback
        return { script: "AI is changing the world. Start building today.", search_term: "business" };
    }
}

/**
 * STEP 2: THE VOICE (Nigerian Male)
 */
async function generateAudio(text) {
    console.log("🎙️ Step 2: Generating Nigerian Voiceover...");
    try {
        const client = new textToSpeech.TextToSpeechClient();
        const [response] = await client.synthesizeSpeech({
            input: { text },
            voice: { languageCode: 'en-NG', name: 'en-NG-Wavenet-B', ssmlGender: 'MALE' },
            audioConfig: { audioEncoding: 'MP3' },
        });
        fs.writeFileSync('voice.mp3', response.audioContent, 'binary');
    } catch (e) {
        console.error("🎙️ VOICE ERROR:", e.message);
        throw e;
    }
}

/**
 * STEP 3: THE EYES (With URL Safety Check)
 */
async function getVisuals(keyword) {
    console.log(`🎬 Step 3: Finding footage for: ${keyword}...`);
    let videoUrl = "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4"; // Default Fallback

    try {
        const url = `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&orientation=vertical`;
        const res = await axios.get(url);
        
        if (res.data.hits && res.data.hits.length > 0) {
            videoUrl = res.data.hits[0].videos.large.url;
        } else {
            console.log("⚠️ No specific footage found, using default business clip.");
        }
    } catch (e) {
        console.log("⚠️ Pixabay API failed, using fallback video.");
    }

    // FINAL URL CHECK: This prevents the "Invalid URL" crash
    if (!videoUrl || !videoUrl.startsWith('http')) {
        videoUrl = "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4";
    }

    console.log("📥 Downloading video from:", videoUrl);
    const writer = fs.createWriteStream('background.mp4');
    const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    return new Promise((resolve) => writer.on('finish', resolve));
}

/**
 * STEP 4: THE EDITOR
 */
async function assembleVideo() {
    console.log("✂️ Step 4: Assembling Video...");
    try {
        const cmd = `ffmpeg -y -stream_loop -1 -i background.mp4 -i voice.mp3 -map 0:v:0 -map 1:a:0 -c:v libx264 -preset ultrafast -c:a aac -b:a 192k -pix_fmt yuv420p -shortest output.mp4`;
        execSync(cmd);
    } catch (e) {
        console.error("✂️ FFMPEG ERROR:", e.message);
        throw e;
    }
}

/**
 * STEP 5: THE DELIVERY
 */
async function uploadToYouTube(script) {
    console.log("🚀 Step 5: Uploading to YouTube...");
    try {
        const oauth2Client = new google.auth.OAuth2(process.env.YT_CLIENT_ID, process.env.YT_CLIENT_SECRET);
        oauth2Client.setCredentials({ refresh_token: process.env.YT_REFRESH_TOKEN });
        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: { title: 'The Future of AI Wealth #Shorts', description: script, categoryId: '27' },
                status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
            },
            media: { body: fs.createReadStream('output.mp4') }
        });
    } catch (e) {
        console.error("🚀 YOUTUBE ERROR:", e.message);
        // We don't exit here so the artifact still uploads for you to see.
    }
}

async function main() {
    try {
        const content = await getScript();
        await generateAudio(content.script);
        await getVisuals(content.search_term);
        await assembleVideo();
        await uploadToYouTube(content.script);
        console.log("✅ JOB COMPLETE!");
    } catch (e) {
        console.error("❌ CRITICAL STOP:", e.message);
        process.exit(1);
    }
}

main();
