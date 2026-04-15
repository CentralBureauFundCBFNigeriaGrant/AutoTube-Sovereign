const fs = require('fs');
const axios = require('axios');
const { Groq } = require('groq-sdk');

// 1. Setup & Credentials
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const PEXELS_KEY = process.env.PEXELS_API_KEY;

// 2. Load Video Settings
const settings = JSON.parse(fs.readFileSync('video_settings.json', 'utf8'));

// --- BRAIN: Script Generation ---
async function generateScript() {
    console.log(`🧠 Consulting Groq for a ${settings.niche} script...`);
    
    const prompt = `Write a viral YouTube Short script (under 60 seconds) about ${settings.niche}. 
    Tone: ${settings.video_settings.tone}. 
    Include a strong hook: ${settings.content_hooks[0]}. 
    Format: Return ONLY the spoken narration text. No scene descriptions.`;

    const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant', // Your updated, working model
    });

    return chatCompletion.choices[0].message.content;
}

// --- VISUALS: Pexels Sourcing & Downloading ---
async function downloadFootage(query) {
    console.log(`📽️ Searching Pexels for: "${query}"...`);
    
    try {
        const response = await axios.get(`https://api.pexels.com/videos/search?query=${query}&per_page=1&orientation=portrait`, {
            headers: { 'Authorization': PEXELS_KEY }
        });

        if (response.data.videos.length === 0) throw new Error("No videos found on Pexels.");

        // Get the best high-def file link
        const videoFile = response.data.videos[0].video_files[0].link;
        const fileName = 'raw_footage.mp4';

        console.log("💾 Downloading video file...");
        const writer = fs.createWriteStream(fileName);
        const videoStream = await axios({
            url: videoFile,
            method: 'GET',
            responseType: 'stream'
        });

        videoStream.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`✅ Download complete: ${fileName}`);
                resolve(fileName);
            });
            writer.on('error', reject);
        });

    } catch (error) {
        console.error("❌ Pexels Error:", error.message);
    }
}

// --- ORCHESTRATOR: The "Bake" ---
async function startBake() {
    try {
        console.log(`🚀 Starting Bake for: ${settings.project_name}`);
        
        // Step 1: Generate Script
        const script = await generateScript();
        console.log(`📝 SCRIPT: "${script.substring(0, 50)}..."`);

        // Step 2: Fetch Visuals
        // We use the niche as the search term for high-quality matches
        const videoPath = await downloadFootage(settings.niche);

        console.log("-----------------------------------------");
        console.log("🔥 STEP 1 & 2 COMPLETE");
        console.log(`📍 Script ready.`);
        console.log(`📍 Footage saved to: ${videoPath}`);
        console.log("-----------------------------------------");
        console.log("✅ AutoTube is ready for the Edit phase.");

    } catch (error) {
        console.error("❌ Critical Engine Failure:", error);
    }
}

startBake();

