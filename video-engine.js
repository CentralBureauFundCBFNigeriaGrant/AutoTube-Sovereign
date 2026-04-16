const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const textToSpeech = require('@google-cloud/text-to-speech');
const { google } = require('googleapis');

// Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 1. THE BRAIN: Generate Script & Search Terms
async function getScript() {
    console.log("🧠 Step 1: Brainstorming Script...");
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: "llama-3.1-8b-instant",
        messages: [
            { role: "system", content: "You are a viral YouTube Shorts creator. You MUST respond in JSON." },
            { role: "user", content: "Create a 55-second high-energy script about making money online. JSON format: { 'script': '...', 'search_term': '...' }" }
        ],
        response_format: { type: "json_object" }
    }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });
    return JSON.parse(response.data.choices[0].message.content);
}

// 2. THE VOICE: Google TTS (Nigerian Male)
async function generateAudio(text) {
    console.log("🎙️ Step 2: Generating Nigerian Voiceover...");
    const client = new textToSpeech.TextToSpeechClient();
    const [response] = await client.synthesizeSpeech({
        input: { text },
        voice: { languageCode: 'en-NG', name: 'en-NG-Wavenet-B', ssmlGender: 'MALE' },
        audioConfig: { audioEncoding: 'MP3' },
    });
    fs.writeFileSync('voice.mp3', response.audioContent, 'binary');
    return 'voice.mp3';
}

// 3. THE EYES: Pixabay Visuals
async function getVisuals(keyword) {
    console.log(`🎬 Step 3: Finding footage for: ${keyword}...`);
    const url = `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&orientation=vertical`;
    const res = await axios.get(url);
    const videoUrl = res.data.hits[0].videos.large.url;
    const writer = fs.createWriteStream('background.mp4');
    const stream = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
    stream.data.pipe(writer);
    return new Promise((resolve) => writer.on('finish', resolve));
}

// 4. THE EDITOR: FFmpeg Assembly
async function assembleVideo() {
    console.log("✂️ Step 4: Assembling final Video...");
    // This merges audio + video and loops/cuts to match audio length
    const cmd = `ffmpeg -y -stream_loop -1 -i background.mp4 -i voice.mp3 -map 0:v:0 -map 1:a:0 -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest output.mp4`;
    execSync(cmd);
}

// 5. THE DELIVERY: YouTube Upload
async function uploadToYouTube(script) {
    console.log("🚀 Step 5: Uploading to YouTube @RichDaddyYo...");
    const oauth2Client = new google.auth.OAuth2(
        process.env.YT_CLIENT_ID,
        process.env.YT_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.YT_REFRESH_TOKEN });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: { title: 'How to make money with AI #Shorts', description: script, categoryId: '27' },
            status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
        },
        media: { body: fs.createReadStream('output.mp4') }
    });
}

// MAIN RUNNER
async function main() {
    try {
        const content = await getScript();
        await generateAudio(content.script);
        await getVisuals(content.search_term);
        await assembleVideo();
        await uploadToYouTube(content.script);
        console.log("✅ JOB COMPLETE: Video is LIVE!");
    } catch (e) {
        console.error("❌ CRITICAL ERROR:", e.message);
        process.exit(1);
    }
}

main();
