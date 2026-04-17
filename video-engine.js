const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

const GROQ_KEYS = [process.env.GROQ_API_KEY].filter(k => k);
const PEXELS_API_KEY = process.env.PEXELS_API_KEY; 

const YT_CLIENT_ID = process.env.YT_CLIENT_ID;
const YT_CLIENT_SECRET = process.env.YT_CLIENT_SECRET;
const YT_REFRESH_TOKEN = process.env.YT_REFRESH_TOKEN;

function robustJSONParse(text) {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        return JSON.parse(text.substring(start, end + 1));
    } catch (e) { return null; }
}

/**
 * STEP 1: THE BRAIN (35 Fast Scenes + Guaranteed CTA)
 */
async function getContent() {
    console.log("🧠 Step 1: Generating Male Nigerian Mentor Script...");
    for (let key of GROQ_KEYS) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [{ 
                    role: "system", 
                    content: `You are a professional Male Nigerian Mentor. 
                    RULES:
                    1. EXACTLY 35 scenes for fast pacing. 
                    2. Each scene is 3 words max. 
                    3. The last scene MUST BE: "Subscribe for more viral secrets!"
                    4. KEYWORDS: Luxury, tech, money, and professional success terms.
                    Return ONLY JSON: {"scenes": [{"text": "Your message here", "keyword": "query"}]}` 
                }, { role: "user", content: "Topic: YouTube Masterclass 2026" }],
                response_format: { type: "json_object" }
            }, { headers: { 'Authorization': `Bearer ${key}` }, timeout: 30000 });

            const data = robustJSONParse(response.data.choices[0].message.content);
            if (data?.scenes) return data.scenes;
        } catch (e) { console.warn("⚠️ Groq Retry..."); }
    }
    throw new Error("Script failed.");
}

/**
 * STEP 2 & 3: CLEAN MALE VOICE & FAST VISUALS
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Clean Abeo Voice (Fixing SSML Bug)...");
    
    // Building a CLEAN SSML string. Note: No extra quotes or weird characters.
    let ssmlBody = "";
    scenes.forEach(s => {
        ssmlBody += `${s.text} <break time="600ms"/> `;
    });

    const fullSSML = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-NG">
        <voice name="en-NG-AbeoNeural">
            ${ssmlBody}
        </voice>
    </speak>`;
    
    fs.writeFileSync('script.ssml', fullSSML);

    // FIXED: Using -f flag with standardized SSML file
    execSync(`edge-tts --file script.ssml --write-media voice.mp3 --rate=-10%`);

    console.log(`🎬 Step 3: Fetching 35 Fast Portrait Clips...`);
    const downloadClip = async (scene, i) => {
        let videoUrl = null;
        try {
            const res = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(scene.keyword)}&orientation=portrait&per_page=1`, {
                headers: { 'Authorization': PEXELS_API_KEY }, timeout: 8000
            });
            if (res.data.videos?.[0]) videoUrl = res.data.videos[0].video_files[0].link;
        } catch (e) {}

        const path = `clip_${i}.mp4`;
        if (!videoUrl) { 
            if (fs.existsSync('backup.mp4')) fs.copyFileSync('backup.mp4', path);
            else execSync(`ffmpeg -f lavfi -i color=c=black:s=1080x1920:d=3 -pix_fmt yuv420p ${path}`);
            return; 
        }
        const writer = fs.createWriteStream(path);
        const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
        response.data.pipe(writer);
        return new Promise(r => writer.on('finish', r));
    };

    // Download clips in parallel batches
    for (let i = 0; i < scenes.length; i += 7) {
        await Promise.all(scenes.slice(i, i + 7).map((s, idx) => downloadClip(s, i + idx)));
    }
    return scenes.map((_, i) => `clip_${i}.mp4`);
}

/**
 * STEP 4: PRECISION ASSEMBLY (No More Midway Stops)
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Final Assembly (Anton Font + Total Duration Fix)...");
    
    // Get EXACT duration of audio
    const audioDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`).toString());
    
    // DISTRIBUTE DURATION: Each clip gets exactly its fair share of the total audio time
    const clipDuration = audioDur / scenes.length;
    let concatList = "";
    videoFiles.forEach((f) => { 
        concatList += `file '${f}'\nduration ${clipDuration}\n`; 
    });
    // Repeat last clip as a safety buffer
    concatList += `file '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    const fontPath = "./fonts/Anton.ttf";
    let filterGraph = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";
    
    let sceneStartTime = 0;

    scenes.forEach((scene) => {
        const words = scene.text.split(' ');
        const totalChars = scene.text.length || 1;
        let wordStartTime = sceneStartTime;

        words.forEach((word) => {
            // Precision calculation: words take up 85% of scene time, 15% left for the SSML pause
            const wordWeight = (word.length / totalChars) * (clipDuration * 0.85); 
            const wordEndTime = wordStartTime + wordWeight;
            const clean = word.toUpperCase().replace(/[^A-Z]/g, "");

            if (clean) {
                filterGraph += `,drawtext=fontfile='${fontPath}':text='${clean}':fontcolor=yellow:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2:borderw=5:bordercolor=black:enable='between(t,${wordStartTime.toFixed(2)},${wordEndTime.toFixed(2)})'`;
            }
            wordStartTime = wordEndTime;
        });
        sceneStartTime += clipDuration;
    });
    filterGraph += "[outv]";

    let audioInputs = "-i voice.mp3";
    let audioMap = "-map 1:a";

    if (fs.existsSync('background.mp3')) {
        console.log("🎵 Mixing background music...");
        audioInputs += " -i background.mp3";
        filterGraph += ";[2:a]volume=0.10,aloop=loop=-1:size=2e9[bg];[1:a][bg]amix=inputs=2:duration=first[aout]";
        audioMap = "-map '[aout]'";
    }

    fs.writeFileSync('filters.txt', filterGraph);

    // FINAL COMMAND: -t ${audioDur} ensures the video is EXACTLY as long as the audio
    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt ${audioInputs} \
        -filter_complex_script filters.txt \
        -map "[outv]" ${audioMap} \
        -c:v libx264 -preset ultrafast -t ${audioDur} -c:a aac -shortest output.mp4`;
    
    execSync(cmd, { stdio: 'inherit' });
}

/**
 * STEP 5: UPLOAD
 */
async function uploadToYouTube(fullScript) {
    if (!YT_CLIENT_ID || !YT_REFRESH_TOKEN) return;
    console.log("🚀 Step 5: Uploading...");
    const oauth2Client = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: { title: 'Viral Mentor Secrets 2026 #Shorts', description: fullScript, categoryId: '27' },
            status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
        },
        media: { body: fs.createReadStream('output.mp4') }
    });
}

async function main() {
    try {
        const scenes = await getContent();
        const files = await processMedia(scenes);
        await assembleVideo(scenes, files);
        await uploadToYouTube(scenes.map(s => s.text).join(' '));
        console.log("🏆 DEPLOYMENT SUCCESSFUL.");
    } catch (e) { console.error("🔥 ERROR:", e.message); process.exit(1); }
}
main();
