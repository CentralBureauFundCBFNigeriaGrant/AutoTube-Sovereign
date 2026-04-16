const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

// Configuration
const GROQ_KEYS = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(k => k);
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

/**
 * UTILITY: JSON Extraction
 */
function robustJSONParse(text) {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        const jsonStr = text.substring(start, end + 1);
        return JSON.parse(jsonStr);
    } catch (e) { return null; }
}

/**
 * STEP 1: THE BRAIN (Now strictly filtering meta-talk)
 */
async function getContent() {
    console.log("🧠 Step 1: Generating Scene-by-Scene Script...");
    for (let i = 0; i < GROQ_KEYS.length; i++) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [
                    { 
                        role: "system", 
                        content: "You are a viral YouTube creator. Output ONLY JSON. DO NOT include stage directions, speaker names, or transition notes. The 'text' field must contain ONLY what the person says." 
                    },
                    { 
                        role: "user", 
                        content: `Create a 58-second high-energy script about 'Financial Freedom with AI'. 
                        Break it into 10 scenes. 
                        Format: {"scenes": [{"text": "You are losing money every second you aren't using AI.", "keyword": "digital money pulse"}]}` 
                    }
                ],
                response_format: { type: "json_object" }
            }, { headers: { 'Authorization': `Bearer ${GROQ_KEYS[i]}` }, timeout: 50000 });

            const data = robustJSONParse(response.data.choices[0].message.content);
            if (data && data.scenes) return data.scenes;
        } catch (e) { console.warn(`⚠️ Groq Key ${i+1} failed.`); }
    }
    throw new Error("All Groq keys failed.");
}

/**
 * STEP 2 & 3: VOICE & DUAL-API VISUALS
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Natural Voiceover...");
    const fullScript = scenes.map(s => s.text).join(' ');
    // RATE FIXED TO +0% FOR NATURAL SPEECH
    const voiceCmd = `edge-tts --voice en-NG-AbeoNeural --text "${fullScript.replace(/"/g, '')}" --write-media voice.mp3 --rate=+0%`;
    execSync(voiceCmd);

    const videoFiles = [];
    for (let i = 0; i < scenes.length; i++) {
        const filename = `clip_${i}.mp4`;
        const keyword = scenes[i].keyword;
        console.log(`🎬 Fetching Clip ${i+1} for: ${keyword}`);
        
        let videoUrl = null;

        // Try Pixabay First
        try {
            const pxa = await axios.get(`https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&orientation=vertical&per_page=3`);
            if (pxa.data.hits?.length > 0) videoUrl = pxa.data.hits[0].videos.large.url;
        } catch (e) { console.warn("  - Pixabay skipped."); }

        // Try Pexels Backup
        if (!videoUrl && PEXELS_API_KEY) {
            try {
                console.log("  - Falling back to Pexels...");
                const pex = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&orientation=portrait&per_page=1`, {
                    headers: { 'Authorization': PEXELS_API_KEY }
                });
                if (pex.data.videos?.length > 0) videoUrl = pex.data.videos[0].video_files.find(f => f.quality === 'hd' || f.quality === 'sd').link;
            } catch (e) { console.warn("  - Pexels skipped."); }
        }

        // Final Safety Fallback
        if (!videoUrl) {
            console.log("  - Using Emergency Safety Clip.");
            videoUrl = "https://cdn.pixabay.com/video/2016/09/13/5053-181585489_large.mp4"; 
        }

        const writer = fs.createWriteStream(filename);
        const stream = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
        stream.data.pipe(writer);
        await new Promise(r => writer.on('finish', r));
        videoFiles.push(filename);
    }
    return videoFiles;
}

/**
 * STEP 4: THE EDITOR (Hormozi Masterpiece)
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Final Assembly with Thick Subtitles...");
    
    const listContent = videoFiles.map(f => `file '${f}'`).join('\n');
    fs.writeFileSync('inputs.txt', listContent);

    let filterString = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";
    let currentTime = 0;
    const wordsPerSecond = 2.4; // Slightly slower for natural feel

    scenes.forEach((scene) => {
        const duration = scene.text.split(' ').length / wordsPerSecond;
        const endTime = currentTime + duration;
        // Forces Uppercase and removes special characters for clean subtitles
        const cleanText = scene.text.toUpperCase().replace(/[^\w\s]/gi, '');
        
        // HORMOZI STYLE: Yellow, Bold, Thick 10px Border
        filterString += `,drawtext=text='${cleanText}':fontcolor=yellow:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2:borderw=10:bordercolor=black:enable='between(t,${currentTime},${endTime})'`;
        
        currentTime = endTime;
    });

    // Sub-Watermark
    filterString += `,drawtext=text='@RICHDADDYYO':fontcolor=white@0.4:fontsize=35:x=(w-text_w)/2:y=h-200`;

    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt -i voice.mp3 \
        -vf "${filterString}" -c:v libx264 -preset ultrafast -c:a aac -shortest output.mp4`;
    
    execSync(cmd, { stdio: 'inherit' });
}

/**
 * STEP 5: THE DELIVERY
 */
async function uploadToYouTube(fullScript) {
    console.log("🚀 Step 5: Uploading...");
    const oauth2Client = new google.auth.OAuth2(process.env.YT_CLIENT_ID, process.env.YT_CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: process.env.YT_REFRESH_TOKEN });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: { title: 'The AI Money Secret #Shorts', description: fullScript, categoryId: '27' },
            status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
        },
        media: { body: fs.createReadStream('output.mp4') }
    });
}

async function main() {
    try {
        const scenes = await getContent();
        const videoFiles = await processMedia(scenes);
        await assembleVideo(scenes, videoFiles);
        await uploadToYouTube(scenes.map(s => s.text).join(' '));
        console.log("🏆 V7 MISSION SUCCESSFUL!");
    } catch (e) {
        console.error("🔥 ERROR:", e.message);
        process.exit(1);
    }
}

main();
