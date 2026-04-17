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
 * STEP 1: THE BRAIN (Male Nigerian Mentor + CTA)
 */
async function getContent() {
    console.log("🧠 Step 1: Generating Male Nigerian Mentor Script...");
    for (let key of GROQ_KEYS) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [{ 
                    role: "system", 
                    content: `You are a Male Nigerian YouTube Mentor. 
                    RULES:
                    1. EXACTLY 30 scenes. 
                    2. Each scene is 3-4 words. 
                    3. The last scene MUST BE: "Subscribe for more viral secrets!"
                    4. KEYWORDS: Physical high-end objects.
                    Return JSON: {"scenes": [{"text": "Scene text here", "keyword": "query"}]}` 
                }, { role: "user", content: "Topic: YouTube Success 2026" }],
                response_format: { type: "json_object" }
            }, { headers: { 'Authorization': `Bearer ${key}` }, timeout: 30000 });

            const data = robustJSONParse(response.data.choices[0].message.content);
            if (data?.scenes) return data.scenes;
        } catch (e) { console.warn("⚠️ Groq Retry..."); }
    }
    throw new Error("Script failed.");
}

/**
 * STEP 2 & 3: MALE VOICE & SSML PAUSES
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Abeo Voice with Hard Pauses...");
    let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-NG">`;
    scenes.forEach(s => { ssml += `${s.text}<break time="600ms"/>`; }); // Increased pause for better teaching vibe
    ssml += `</speak>`;
    fs.writeFileSync('script.ssml', ssml);

    // FIXED: Using -f flag for SSML compatibility
    execSync(`edge-tts --voice en-NG-AbeoNeural -f script.ssml --write-media voice.mp3 --rate=-10%`);

    console.log(`🎬 Step 3: Fetching Portrait Clips...`);
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

    for (let i = 0; i < scenes.length; i += 6) {
        await Promise.all(scenes.slice(i, i + 6).map((s, idx) => downloadClip(s, i + idx)));
    }
    return scenes.map((_, i) => `clip_${i}.mp4`);
}

/**
 * STEP 4: PRECISION ASSEMBLY (Unified Filtergraph Fix)
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Final Assembly (Anton Font + Fixed Audio Logic)...");
    
    const audioDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`).toString());
    
    let concatList = "";
    videoFiles.forEach((f) => { concatList += `file '${f}'\nduration ${audioDur / scenes.length}\n`; });
    concatList += `file '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    const fontPath = "./fonts/Anton.ttf";
    let filterGraph = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";
    
    let sceneStartTime = 0;
    const sceneDuration = audioDur / scenes.length;

    scenes.forEach((scene) => {
        const words = scene.text.split(' ');
        const totalChars = scene.text.length || 1;
        let wordStartTime = sceneStartTime;

        words.forEach((word) => {
            const wordWeight = (word.length / totalChars) * (sceneDuration * 0.80); 
            const wordEndTime = wordStartTime + wordWeight;
            const clean = word.toUpperCase().replace(/[^A-Z]/g, "");

            if (clean) {
                filterGraph += `,drawtext=fontfile='${fontPath}':text='${clean}':fontcolor=yellow:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2:borderw=25:bordercolor=black:enable='between(t,${wordStartTime.toFixed(2)},${wordEndTime.toFixed(2)})'`;
            }
            wordStartTime = wordEndTime;
        });
        sceneStartTime += sceneDuration;
    });
    filterGraph += "[outv]";

    let audioInputs = "-i voice.mp3";
    let audioMap = "-map 1:a"; // Pass through voice only by default

    if (fs.existsSync('background.mp3')) {
        console.log("🎵 Mixing background music...");
        audioInputs += " -i background.mp3";
        // Unified audio filter: No 'copy' used. Correct amix logic.
        filterGraph += ";[2:a]volume=0.12,aloop=loop=-1:size=2e9[bg];[1:a][bg]amix=inputs=2:duration=first[aout]";
        audioMap = "-map '[aout]'";
    }

    fs.writeFileSync('filters.txt', filterGraph);

    // FIXED COMMAND: Only one filter complex, correctly mapped.
    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt ${audioInputs} \
        -filter_complex_script filters.txt \
        -map "[outv]" ${audioMap} \
        -c:v libx264 -preset ultrafast -t ${audioDur} -c:a aac output.mp4`;
    
    execSync(cmd, { stdio: 'inherit' });
}

/**
 * STEP 5: UPLOAD
 */
async function uploadToYouTube(fullScript) {
    if (!YT_CLIENT_ID || !YT_REFRESH_TOKEN) return;
    console.log("🚀 Step 5: Uploading Final Video...");
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
        console.log("🏆 PROJECT SOVEREIGN: DEPLOYED SUCCESSFULLY.");
    } catch (e) { console.error("🔥 FATAL ERROR:", e.message); process.exit(1); }
}
main();
