const axios = require('axios');
const fs = require('fs');
const { google } = require('googleapis');

// Configuration from GitHub Secrets
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

/**
 * STEP 1: Generate Script via Groq (Llama 3.1 8B)
 * Fix: Explicitly mentioning "JSON" in the prompt to satisfy JSON Mode requirements.
 */
async function getScript() {
    console.log("--- Step 1: Generating Script with Llama 3.1 ---");
    try {
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama-3.1-8b-instant",
                messages: [
                    {
                        role: "system",
                        content: "You are a viral YouTube Shorts creator. You must always respond in valid JSON format."
                    },
                    {
                        role: "user",
                        content: "Create a 60-second high-energy script about making money with AI. The response MUST be a JSON object with two keys: 'script' (the spoken text) and 'search_term' (a keyword for background footage). Keep it under 140 words."
                    }
                ],
                response_format: { type: "json_object" }
            },
            {
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = JSON.parse(response.data.choices[0].message.content);
        console.log("Script Generated successfully.");
        return data;
    } catch (error) {
        console.error("Error in Groq Script Generation:");
        if (error.response) {
            // This will show us the EXACT reason for the 'Bad Request'
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        process.exit(1); 
    }
}

/**
 * STEP 2: Fetch Visuals from Pixabay
 */
async function getVisuals(keyword) {
    console.log(`--- Step 2: Fetching video for: ${keyword} ---`);
    try {
        const url = `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&per_page=3&orientation=vertical`;
        const res = await axios.get(url);
        if (res.data.hits.length > 0) {
            const videoUrl = res.data.hits[0].videos.large.url;
            console.log("Video found:", videoUrl);
            return videoUrl;
        }
        throw new Error("No videos found on Pixabay for this keyword.");
    } catch (error) {
        console.error("Pixabay Error:", error.message);
        return "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4"; // Fallback
    }
}

// Main Execution Flow
async function main() {
    const content = await getScript();
    const videoUrl = await getVisuals(content.search_term);
    
    console.log("\n--- Ready for Processing ---");
    console.log("Script:", content.script);
    console.log("Video URL:", videoUrl);
    
    // Future steps: TTS (Nigerian Voice) and FFmpeg assembly go here.
    // For now, we save the text so the Action doesn't return "No Artifacts"
    fs.writeFileSync('script_output.txt', content.script);
    console.log("Progress saved to script_output.txt");
}

main();
