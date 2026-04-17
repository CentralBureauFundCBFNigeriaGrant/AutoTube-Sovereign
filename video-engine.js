const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

const GROQ_KEYS = [process.env.GROQ_API_KEY].filter(k => k);
const PEXELS_API_KEY = process.env.PEXELS_API_KEY; 
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

const YT_CLIENT_ID = process.env.YT_CLIENT_ID;
const YT_CLIENT_SECRET = process.env.YT_CLIENT_SECRET;
const YT_REFRESH_TOKEN = process.env.YT_REFRESH_TOKEN;

/**
 * ROBUST PARSE: Cleans AI junk from JSON responses
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
 * STEP 1: THE BRAIN (Human-Paced Nigerian Tutor)
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
                        content: `You are an expert Nigerian YouTube Mentor. You speak in short, impactful bursts.
                        RULES:
                        1. SCENES: Exactly 35 scenes.
                        2. TEXT: 3-5 words per scene.
                        3. PACING: Use commas (,) and ellipses (...) for natural teaching pauses.
                        4. KEYWORDS: Physical visual terms for Pexels (e.g., 'professional studio', 'gold trophy', 'fast city').
                        Return ONLY JSON: {"scenes": [{"text": "First punchy phrase...", "keyword": "visual_query"}]}` 
                    },
                    { role: "user", content: `Topic: ${topic}` }
                ],
                response_format: { type: "json_object" }
            }, { headers: { 'Authorization': `Bearer ${key}` }, timeout: 40000 });

            const data = robustJSONParse(response.data.choices[0].message.content);
            if (data && data.scenes && data.scenes.length > 20) return data.scenes;
        } catch (e) { console.warn("⚠️ API retry..."); }
    }
    throw new Error("CRITICAL: Script failed.");
}

/**
 * STEP 2 & 3: VOICE & CLIP DOWNLOADS
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Nigerian Tutor Voice (Ezinne)...");
    const fullScript = scenes.map(s => s.text).join(' ').replace(/["']/g, "");
    
    // Using Ezinne for the Nigerian accent at -12% speed for a relaxed mood
    execSync(`edge-tts --voice en-NG-EzinneNeural --text "${fullScript}" --write-media voice.mp3 --rate=-12%`);

    console.log(`🎬 Step 3: Fetching Viral Clips (Pexels Priority)...`);
    const downloadClip = async (scene, i) => {
        let videoUrl = null;
        const query = encodeURIComponent(scene.keyword);

        if (PEXELS_API_KEY) {
            try {
                const res = await axios.get(`https://api.pexels.com/videos/search?query=${query}&orientation=portrait&per_page=1`, {
                    headers: { 'Authorization': PEXELS_API_KEY }, timeout: 10000
                });
                if (res.data.videos?.length > 0) videoUrl = res.data.videos[0].video_files[0].link;
            } catch (e) {}
        }

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

    for (let i = 0; i < scenes.length; i += 7) {
        await Promise.all(scenes.slice(i, i + 7).map((s, idx) => downloadClip(s, i + idx)));
    }
    return scenes.map((_, i) => `clip_${i}.mp4`);
}

/**
 * STEP 4: PRECISION ASSEMBLY (Fixes the filtergraph error)
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Final Assembly (Anton Font + Fixed Audio Logic)...");
    
    const audioDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`).toString());
    const totalWordsCount = scenes.map(s => s.text).join(' ').split(' ').length;
    const timePerWord = audioDur / totalWordsCount;

    let concatList = "";
    videoFiles.forEach((file) => { concatList += `file '${file}'\nduration ${audioDur / scenes.length}\n`; });
    concatList += `file '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    // 1. Video Filters: Anton Style, Yellow, Giant Outline
    let vFilter = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";
    const fontPath = "./fonts/Anton.ttf";
    
    let currentTime = 0;
    scenes.forEach((scene) => {
        const words = scene.text.split(' ');
        words.forEach((word) => {
            const end = currentTime + timePerWord;
            const cleanWord = word.toUpperCase().replace(/[^A-Z]/g, ""); 
            
            if (cleanWord.length > 0) {
                vFilter += `,drawtext=fontfile='${fontPath}':text='${cleanWord}':fontcolor=yellow:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2:borderw=25:bordercolor=black:enable='between(t,${currentTime.toFixed(2)},${end.toFixed(2)})'`;
            }
            currentTime = end;
        });
    });
    vFilter += "[outv]";

    // 2. Audio Logic: Handle background.mp3 existence
    let aFilter = "";
    let inputs = "-i inputs.txt -i voice.mp3";
    let mapAudio = "-map 1:a"; // Default mapping if no music

    if (fs.existsSync('background.mp3')) {
        console.log("🎵 Mixing background music...");
        inputs += " -i background.mp3";
        // Mix voice (1:a) and looped background (2:a) at 10% volume
        aFilter = ";[2:a]volume=0.10,aloop=loop=-1:size=2e9[bg];[1:a][bg]amix=inputs=2:duration=first[aout]";
        mapAudio = "-map '[aout]'";
    }

    // Combine all filters into the script file
    fs.writeFileSync('filters.txt', vFilter + aFilter);

    const cmd = `ffmpeg -y -f concat -safe 0 ${inputs} \
        -filter_complex_script filters.txt \
        -map "[outv]" ${mapAudio} \
        -c:v libx264 -preset ultrafast -t ${audioDur} -c:a aac output.mp4`;
    
    execSync(cmd, { stdio: 'inherit' });
}

/**
 * STEP 5: UPLOAD
 */
async function uploadToYouTube(fullScript) {
    console.log("🚀 Step 5: Uploading...");
    if (!YT_CLIENT_ID || !YT_REFRESH_TOKEN) return;

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
        const videoFiles = await processMedia(scenes);
        await assembleVideo(scenes, videoFiles);
        await uploadToYouTube(scenes.map(s => s.text).join(' '));
        console.log(`🏆 SUCCESS! Video is live with Nigerian voice and perfect subtitles.`);
    } catch (e) {
        console.error("🔥 ERROR:", e.message);
        process.exit(1);
    }
}
main();
         
