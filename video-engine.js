const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const textToSpeech = require('@google-cloud/text-to-speech');
const { google } = require('googleapis');

// Configuration - Key Fallback Array
const GROQ_KEYS = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2];
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

/**
 * STEP 1: THE BRAIN (With Fallback Logic)
 * Tries Key 1, then Key 2 if it hits a limit or error.
 */
async function getScript() {
    console.log("🧠 Step 1: Brainstorming Viral Script...");
    
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
                        content: "You are a viral YouTube Shorts creator. Respond ONLY in valid JSON. No conversational filler. No markdown backticks." 
                    },
                    { 
                        role: "user", 
                        content: "Create a 55-second high-energy script about 'AI Passive Income'. Format: {\"script\": \"...\", \"search_term\": \"wealth\"}" 
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 1024
            }, { 
                headers: { 'Authorization': `Bearer ${currentKey}`, 'Content-Type': 'application/json' },
                timeout: 30000 
            });

            let rawContent = response.data.choices[0].message.content.trim();
            
            // CLEANER: Strip markdown and extract only the JSON object
            rawContent = rawContent.replace(/```json|```/g, "").trim();
            const firstBracket = rawContent.indexOf('{');
            const lastBracket = rawContent.lastIndexOf('}');
            const jsonString = rawContent.substring(firstBracket, lastBracket + 1);
            
            const data = JSON.parse(jsonString);
            console.log("✅ Success! Script generated using Key " + (i + 1));
            return data;

        } catch (error) {
            console.warn(`⚠️ Key ${i + 1} failed or hit limit: ${error.message}`);
            if (i === GROQ_KEYS.length - 1) {
                console.error("❌ ALL KEYS EXHAUSTED.");
                throw new Error("Could not get a response from any Groq API keys.");
            }
            console.log("🔄 Switching to next fallback key...");
        }
    }
}

/**
 * STEP 2: THE VOICE (Nigerian Male Wavenet)
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
 * STEP 3: THE EYES (Pixabay Vertical Footage)
 */
async function getVisuals(keyword) {
    console.log(`🎬 Step 3: Finding footage for: ${keyword}...`);
    let videoUrl = "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4"; // Safety Fallback

    try {
        const url = `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&orientation=vertical`;
        const res = await axios.get(url);
        if (res.data.hits && res.data.hits.length > 0) {
            videoUrl = res.data.hits[0].videos.large.url;
        }
    } catch (e) {
        console.log("⚠️ Pixabay API error, using fallback footage.");
    }

    const writer = fs.createWriteStream('background.mp4');
    const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    return new Promise((resolve) => writer.on('finish', resolve));
}

/**
 * STEP 4: THE EDITOR (Hormozi-Style Subtitles)
 */
async function assembleVideo() {
    console.log("✂️ Step 4: Assembling Video with Hormozi Style...");
    // This burns a stylized title onto the center of the video using Impact font
    const cmd = `ffmpeg -y -stream_loop -1 -i background.mp4 -i voice.mp3 \
        -vf "drawtext=fontfile=/usr/share/fonts/truetype/msttcorefonts/Impact.ttf:text='AI WEALTH SECRET':fontcolor=yellow:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2:borderw=4:bordercolor=black" \
        -c:v libx264 -preset ultrafast -c:a aac -b:a 192k -pix_fmt yuv420p -shortest output.mp4`;
    execSync(cmd);
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
            snippet: { 
                title: 'AI Passive Income #Shorts', 
                description: script, 
                categoryId: '27' 
            },
            status: { 
                privacyStatus: 'public', // Change to 'private' if you want a hidden test
                selfDeclaredMadeForKids: false 
            }
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
        console.log("✅ JOB COMPLETE: Video is LIVE on @RichDaddyYo!");
    } catch (e) {
        console.error("❌ CRITICAL ERROR:", e.message);
        process.exit(1);
    }
}

main();
