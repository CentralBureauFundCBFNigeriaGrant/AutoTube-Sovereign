const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

/**
 * CONFIGURATION & API KEYS
 */
const GROQ_KEYS = [process.env.GROQ_API_KEY].filter(k => k);
const PEXELS_API_KEY = process.env.PEXELS_API_KEY; 
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

const YT_CLIENT_ID = process.env.YT_CLIENT_ID;
const YT_CLIENT_SECRET = process.env.YT_CLIENT_SECRET;
const YT_REFRESH_TOKEN = process.env.YT_REFRESH_TOKEN;

/**
 * ROBUST PARSE: Prevents "Script failed" by stripping AI chatter from JSON
 */
function robustJSONParse(text) {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        const cleaned = text.substring(start, end + 1);
        return JSON.parse(cleaned);
    } catch (e) { return null; }
}

/**
 * STEP 1: THE BRAIN (Human-Paced Tutor Script)
 */
async function getContent() {
    console.log("🧠 Step 1: Generating Mentor-Style Script...");
    const topic = "How to go viral on YouTube in 2026"; 
    
    for (let key of GROQ_KEYS) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [
                    { 
                        role: "system", 
                        content: `You are an expert YouTube Mentor. You speak in short, punchy bursts.
                        RULES:
                        1. SCENES: Exactly 35 scenes.
                        2. TEXT: 3-6 words per scene.
                        3. PACING: Use commas (,) and ellipses (...) to force natural teacher pauses.
                        4. TONE: Impactful, calm, and educational.
                        5. KEYWORDS: Physical visual terms for Pexels (e.g., 'professional studio', 'gold trophy', 'fast city').
                        Return ONLY JSON: {"scenes": [{"text": "First punchy phrase...", "keyword": "visual_query"}]}` 
                    },
                    { role: "user", content: `Topic: ${topic}` }
                ],
                response_format: { type: "json_object" }
            }, { headers: { 'Authorization': `Bearer ${key}` }, timeout: 30000 });

            const data = robustJSONParse(response.data.choices[0].message.content);
            if (data && data.scenes && data.scenes.length > 20) return data.scenes;
        } catch (e) { console.warn("⚠️ Groq Key struggle... retrying."); }
    }
    throw new Error("CRITICAL: Script failed. Check Groq API usage.");
}

/**
 * STEP 2 & 3: CLEAN VOICE & PEXELS CLIPS
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Human-Paced Voiceover...");
    const fullScript = scenes.map(s => s.text).join(' ').replace(/["']/g, "");
    
    // -12% rate for that relaxed, authoritative Mentor vibe.
    execSync(`edge-tts --voice en-US-GuyNeural --text "${fullScript}" --write-media voice.mp3 --rate=-12%`);

    console.log(`🎬 Step 3: Fetching 35 Viral Clips (Pexels First)...`);
    const downloadClip = async (scene, i) => {
        let videoUrl = null;
        const query = encodeURIComponent(scene.keyword);
