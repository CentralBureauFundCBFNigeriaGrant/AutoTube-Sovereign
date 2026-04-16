const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const OpenAI = require('openai');
const textToSpeech = require('@google-cloud/text-to-speech');

// Initialize Clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ttsClient = new textToSpeech.TextToSpeechClient();

/**
 * 1. GENERATE SCRIPT & KEYWORDS (Groq/Llama)
 */
async function getScript() {
    console.log("--- Step 1: Generating Script with Llama 3.1 ---");
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: "llama-3.1-8b-instant",
        messages: [{
            role: "user",
            content: "Create a 55-second viral script for a YouTube Short about making money online. Format: { \"script\": \"...\", \"keywords\": \"keyword1, keyword2\" }. Make it engaging for a Nigerian audience."
        }],
        response_format: { type: "json_object" }
    }, {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
    });
    return JSON.parse(response.data.choices[0].message.content);
}

/**
 * 2. FETCH DYNAMIC VIDEO (Pixabay)
 */
async function getVideo(keyword) {
    console.log(`--- Step 2: Fetching Video for "${keyword}" ---`);
    const url = `https://pixabay.com/api/videos/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&orientation=vertical&per_page=3`;
    const res = await axios.get(url);
    if (res.data.hits.length > 0) {
        // Pick a random hit to ensure variety
        const video = res.data.hits[Math.floor(Math.random() * res.data.hits.length)];
        const videoUrl = video.videos.large?.url || video.videos.medium.url;
        execSync(`curl -L -o background.mp4 "${videoUrl}"`);
    } else {
        throw new Error("No videos found on Pixabay for this keyword.");
    }
}

/**
 * 3. GENERATE NIGERIAN MALE VOICE (Google TTS)
 */
async function generateVoice(text) {
    console.log("--- Step 3: Generating Nigerian Male Voiceover ---");
    const request = {
        input: { text: text },
        voice: { languageCode: 'en-NG', name: 'en-NG-Wavenet-B', ssmlGender: 'MALE' },
        audioConfig: { audioEncoding: 'MP3', pitch: 0, speakingRate: 1.1 },
    };
    const [response] = await ttsClient.synthesizeSpeech(request);
    fs.writeFileSync('voiceover.mp3', response.audioContent, 'binary');
}

/**
 * 4. GET PERFECT TIMESTAMPS (OpenAI Whisper)
 */
async function generateSubtitles() {
    console.log("--- Step 4: Transcribing with Whisper for Perfect Sync ---");
    const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream("voiceover.mp3"),
        model: "whisper-1",
        response_format: "vtt", // VTT format is cleaner for FFmpeg
    });
    fs.writeFileSync("subs.vtt", transcription);
}

/**
 * 5. ASSEMBLE FINAL VIDEO (FFmpeg)
 */
async function assembleVideo() {
    console.log("--- Step 5: Final Assembly with Hormozi Styling ---");
    
    // Hormozi Style Config: 
    // Yellow Color (&H00FFFF), Impact Font (or Arial Bold), Centered (Alignment=10)
    const style = "Fontname=Impact,FontSize=28,PrimaryColour=&H00FFFF,OutlineColour=&H000000,BorderStyle=3,Outline=2,Alignment=10";
    
    try {
        execSync(`
            ffmpeg -stream_loop -1 -i background.mp4 -i voiceover.mp3 \
            -vf "subtitles=subs.vtt:force_style='${style}'" \
            -c:v libx264 -c:a aac -shortest -pix_fmt yuv420p -y output.mp4
        `);
        console.log("--- Success! Video 'output.mp4' is ready. ---");
    } catch (error) {
        console.error("FFmpeg Error:", error.message);
    }
}

/**
 * MAIN EXECUTION
 */
async function main() {
    try {
        const data = await getScript();
        await getVideo(data.keywords.split(',')[0]); // Use the first keyword
        await generateVoice(data.script);
        await generateSubtitles();
        await assembleVideo();
    } catch (err) {
        console.error("Pipeline Failed:", err);
    }
}

main();
