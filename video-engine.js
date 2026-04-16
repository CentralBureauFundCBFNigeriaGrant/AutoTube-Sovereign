const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const textToSpeech = require('@google-cloud/text-to-speech');
const { google } = require('googleapis');

// Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

/**
 * STEP 1: THE BRAIN (With Extraction Logic)
 */
async function getScript() {
    console.log("🧠 Step 1: Brainstorming Script...");
    try {
        const response = await axios.post('[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)', {
            model: "llama-3.1-8b-instant",
            messages: [
                { 
                    role: "system", 
                    content: "You are a professional YouTube creator. Respond ONLY with a JSON object containing 'script' and 'search_term'. Do not use markdown blocks or backticks." 
                },
                { 
                    role: "user", 
                    content: "Create a 55-second viral script about 'AI passive income'. JSON format: {\"script\": \"...\", \"search_term\": \"money\"}" 
                }
            ],
            response_format: { type: "json_object" },
            max_tokens: 1024 // Increased to prevent "Unexpected End" truncation
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });

        let rawContent = response.data.choices[0].message.content.trim();
        
        // --- TRIPLE-SAFETY EXTRACTION ---
        console.log("RAW OUTPUT:", rawContent);

        // 1. Remove Markdown code blocks if present
        rawContent = rawContent.replace(/```json|```/g, "").trim();

        // 2. Find the first '{' and last '}' to strip any "chatter"
        const firstBracket = rawContent.indexOf('{');
        const lastBracket = rawContent.lastIndexOf('}');
        
        if (firstBracket === -1 || lastBracket === -1) {
            throw new Error("No JSON brackets found in response.");
        }
        
        const jsonString = rawContent.substring(firstBracket, lastBracket + 1);
        const data = JSON.parse(jsonString);

        if (!data.script) throw new Error("Script field missing in JSON.");
        
        return data;
    } catch (error) {
        console.error("❌ BRAIN ERROR:", error.message);
        // Emergency Fallback so the pipeline continues
        return { 
            script: "The world of AI is moving fast. If you're not using automation, you're falling behind. Start today.", 
            search_term: "technology" 
        };
    }
}

/**
 * STEP 2: THE VOICE (Nigerian Male)
 */
async function generateAudio(text) {
    console.log("🎙️ Step 2: Generating Nigerian Voiceover...");
    const client = new textToSpeech.TextToSpeechClient();
    const [response] = await client.synthesizeSpeech({
        input: { text },
        voice: { languageCode: 'en-NG', name: 'en-NG-Wavenet-B', ssmlGender: 'MALE' },
        audioConfig: { audioEncoding: 'MP3' },
    });
    fs.writeFileSync('voice.mp3', response.audioContent, 'binary');
}

/**
 * STEP 3: THE EYES (With URL Validation)
 */
async function getVisuals(keyword) {
    console.log(`🎬 Step 3: Finding footage for: ${keyword}...`);
    let videoUrl = "[https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4](https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4)"; 

    try {
        const url = `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&orientation=vertical`;
        const res = await axios.get(url);
        if (res.data.hits && res.data.hits.length > 0) {
            videoUrl = res.data.hits[0].videos.large.url;
        }
    } catch (e) {
        console.log("⚠️ Pixabay failed, using fallback video.");
    }

    console.log("📥 Downloading:", videoUrl);
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
    // FFmpeg merges audio/video and cuts to the shortest length
    const cmd = `ffmpeg -y -stream_loop -1 -i background.mp4 -i voice.mp3 -map 0:v:0 -map 1:a:0 -c:v libx264 -preset ultrafast -c:a aac -b:a 192k -pix_fmt yuv420p -shortest output.mp4`;
    execSync(cmd);
}

/**
 * STEP 5: THE DELIVERY
 */
async function uploadToYouTube(script) {
    console.log("🚀 Step 5: Uploading to @RichDaddyYo...");
    try {
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
        console.log("📺 Video is LIVE!");
    } catch (e) {
        console.error("🚀 YOUTUBE UPLOAD FAILED:", e.message);
    }
}

async function main() {
    try {
        const content = await getScript();
        await generateAudio(content.script);
        await getVisuals(content.search_term);
        await assembleVideo();
        await uploadToYouTube(content.script);
        console.log("✅ COMPLETE!");
    } catch (e) {
        console.error("❌ CRITICAL FAILURE:", e.message);
        process.exit(1);
    }
}

main();
