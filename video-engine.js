const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const textToSpeech = require('@google-cloud/text-to-speech');
const { google } = require('googleapis');

// Configuration - Key Fallback Array
const GROQ_KEYS = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2];
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

/**
 * STEP 1: THE BRAIN (Diagnostic Version)
 */
async function getScript() {
    console.log("🧠 Step 1: Brainstorming (Diagnostic Mode)...");
    
    for (let i = 0; i < GROQ_KEYS.length; i++) {
        const currentKey = GROQ_KEYS[i];
        if (!currentKey) continue;

        try {
            console.log(`📡 Attempting with API Key ${i + 1}...`);
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [
                    { 
                        role: "system", 
                        content: "You are a JSON generator. Respond ONLY with a JSON object. Do not include any other text." 
                    },
                    { 
                        role: "user", 
                        content: "Generate this exact JSON: {\"script\": \"Unlock your financial freedom today with AI automation.\", \"search_term\": \"money\"}" 
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 500 // Short and safe
            }, { 
                headers: { 'Authorization': `Bearer ${currentKey}`, 'Content-Type': 'application/json' },
                timeout: 30000 
            });

            // --- TOKEN TRACKING ---
            console.log("📊 --- USAGE DETAILS ---");
            console.log(`Tokens Remaining: ${response.headers['x-ratelimit-remaining-tokens']}`);
            console.log(`Requests Remaining: ${response.headers['x-ratelimit-remaining-requests']}`);
            console.log("------------------------");

            const rawContent = response.data.choices[0].message.content.trim();
            console.log("📥 Raw Brain Output:", rawContent);

            const data = JSON.parse(rawContent);
            console.log("✅ Success! Script generated using Key " + (i + 1));
            return data;

        } catch (error) {
            console.warn(`⚠️ Key ${i + 1} Error: ${error.message}`);
            
            // If the error was a JSON parse error, print what we tried to parse
            if (error instanceof SyntaxError) {
                console.error("❌ DATA WAS NOT VALID JSON. Check the 'Raw Brain Output' above.");
            }
            
            if (i === GROQ_KEYS.length - 1) {
                throw new Error("All Groq keys failed. Check GitHub Logs for the raw output.");
            }
            console.log("🔄 Trying next key...");
        }
    }
}

/**
 * STEP 2: THE VOICE (Nigerian Male Wavenet)
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
        console.error("❌ Voiceover Error:", e.message);
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
        const url = `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&orientation=vertical`;
        const res = await axios.get(url);
        if (res.data.hits && res.data.hits.length > 0) {
            videoUrl = res.data.hits[0].videos.large.url;
        }
    } catch (e) {
        console.warn("⚠️ Pixabay failed, using fallback.");
    }

    const writer = fs.createWriteStream('background.mp4');
    const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    return new Promise((resolve) => writer.on('finish', resolve));
}

/**
 * STEP 4: THE EDITOR (Hormozi Styling)
 */
async function assembleVideo() {
    console.log("✂️ Step 4: Assembling Video...");
    // Draws text in the middle with yellow color and black border
    const cmd = `ffmpeg -y -stream_loop -1 -i background.mp4 -i voice.mp3 \
        -vf "drawtext=text='RICH DADDY YO':fontcolor=yellow:fontsize=70:x=(w-text_w)/2:y=(h-text_h)/2:borderw=3:bordercolor=black" \
        -c:v libx264 -preset ultrafast -c:a aac -shortest output.mp4`;
    execSync(cmd);
}

/**
 * STEP 5: THE DELIVERY (YouTube)
 */
async function uploadToYouTube(script) {
    console.log("🚀 Step 5: Uploading Private Test...");
    const oauth2Client = new google.auth.OAuth2(process.env.YT_CLIENT_ID, process.env.YT_CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: process.env.YT_REFRESH_TOKEN });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: { title: 'AI Test #Shorts', description: script, categoryId: '27' },
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
        console.log("✅ DIAGNOSTIC RUN SUCCESSFUL!");
    } catch (e) {
        console.error("❌ CRITICAL FAILURE:", e.message);
        process.exit(1);
    }
}

main();
                                        
