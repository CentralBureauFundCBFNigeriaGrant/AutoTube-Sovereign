const fs = require('fs');
const axios = require('axios');
const { Groq } = require('groq-sdk');
const textToSpeech = require('@google-cloud/text-to-speech');
const { execSync } = require('child_process');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ttsClient = new textToSpeech.TextToSpeechClient();
const PEXELS_KEY = process.env.PEXELS_API_KEY;

const settings = JSON.parse(fs.readFileSync('video_settings.json', 'utf8'));

// --- BRAIN: Script Generation ---
async function generateScript() {
    const prompt = `Write a viral YouTube Short script (under 60 seconds) about ${settings.niche}. Return ONLY the narration text.`;
    const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
    });
    return chatCompletion.choices[0].message.content;
}

// --- VOICE: Google TTS ---
async function generateAudio(text) {
    console.log("🎙️ Generating AI voice...");
    const request = {
        input: { text: text },
        voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
        audioConfig: { audioEncoding: 'MP3' },
    };
    const [response] = await ttsClient.synthesizeSpeech(request);
    const audioFile = 'narration.mp3';
    await fs.promises.writeFile(audioFile, response.audioContent, 'binary');
    console.log(`✅ Audio saved: ${audioFile}`);
    return audioFile;
}

// --- VISUALS: Pexels Download ---
async function downloadFootage(query) {
    console.log(`📽️ Sourcing footage for: ${query}...`);
    const response = await axios.get(`https://api.pexels.com/videos/search?query=${query}&per_page=1&orientation=portrait`, {
        headers: { 'Authorization': PEXELS_KEY }
    });
    const videoFile = response.data.videos[0].video_files[0].link;
    const outputName = 'raw_video.mp4';
    const writer = fs.createWriteStream(outputName);
    const stream = await axios({ url: videoFile, method: 'GET', responseType: 'stream' });
    stream.data.pipe(writer);
    return new Promise((resolve) => writer.on('finish', () => resolve(outputName)));
}

// --- EDITING: The Merge ---
function mergeMedia(video, audio) {
    console.log("🎬 Merging video and audio...");
    const output = 'final_video.mp4';
    // This command combines them and ensures the video matches the audio length
    execSync(`ffmpeg -i ${video} -i ${audio} -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest ${output}`);
    console.log(`🏁 BAKE COMPLETE: ${output}`);
    return output;
}

async function startBake() {
    try {
        const script = await generateScript();
        const audioPath = await generateAudio(script);
        const videoPath = await downloadFootage(settings.niche);
        
        const finalVideo = mergeMedia(videoPath, audioPath);
        console.log(`🚀 Your video is ready for upload: ${finalVideo}`);
    } catch (error) {
        console.error("❌ Bake Failed:", error);
    }
}

startBake();

