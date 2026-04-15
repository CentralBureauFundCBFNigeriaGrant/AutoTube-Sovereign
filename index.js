const fs = require('fs');
const { Groq } = require('groq-sdk');

// 1. Initialize Groq with your Secret
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// 2. Load your "Order Form"
const settings = JSON.parse(fs.readFileSync('video_settings.json', 'utf8'));

async function generateScript() {
    console.log(`🧠 Consulting Groq for a ${settings.niche} script...`);
    
    const prompt = `Write a viral YouTube Short script (under 60 seconds) about ${settings.niche}. 
    Tone: ${settings.video_settings.tone}. 
    Include a strong hook: ${settings.content_hooks[0]}. 
    Format: Return ONLY the spoken narration text. No scene descriptions.`;

    const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant', // Fast and efficient for scripts
    });

    return chatCompletion.choices[0].message.content;
}

async function startBake() {
    try {
        console.log(`🚀 Starting Bake for: ${settings.project_name}`);
        
        // STEP 1: The Brain
        const finalScript = await generateScript();
        console.log("📝 SCRIPT GENERATED:");
        console.log("--------------------");
        console.log(finalScript);
        console.log("--------------------");

        // STEP 2: The Visuals (Next Step)
        console.log("✅ Script ready. Next up: Pexels footage sourcing.");
        
    } catch (error) {
        console.error("❌ Error during bake:", error);
    }
}

startBake();
        
