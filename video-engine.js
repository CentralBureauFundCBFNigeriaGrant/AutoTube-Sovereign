const axios = require('axios');
const fs = require('fs');

// Configuration from GitHub Secrets
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

/**
 * STEP 1: Generate Script via Groq
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
                        content: "Create a 60-second high-energy script about making money with AI. Response MUST be a JSON object with: 'script' (the text) and 'search_term' (keyword)."
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

        // Extract and parse the JSON string from the response
        const contentString = response.data.choices[0].message.content;
        const data = JSON.parse(contentString);
        
        console.log("Script Generated successfully.");
        return data;
    } catch (error) {
        console.error("Error in Groq Script Generation:", error.message);
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
            return res.data.hits[0].videos.large.url;
        }
        return "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4"; // Fallback
    } catch (error) {
        return "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4";
    }
}

// Main Execution Flow
async function main() {
    const content = await getScript();
    const videoUrl = await getVisuals(content.search_term);
    
    console.log("\n--- Processing Check ---");
    
    // FIX: Ensuring the data is a String before writing to file
    const finalScript = String(content.script || "Script generation failed.");
    
    fs.writeFileSync('script_output.txt', finalScript);
    console.log("Script saved to script_output.txt");
    
    // We also save the video URL so we can see it in the logs
    fs.writeFileSync('video_url.txt', String(videoUrl));
    console.log("Video URL saved to video_url.txt");
    
    console.log("Success! Script and Video link are ready.");
}

main();
