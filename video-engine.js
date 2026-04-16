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
 * FIXED ROBUST PARSE: Handles truncated or messy AI responses.
 */
function robustJSONParse(text) {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        const cleaned = text.substring(start, end + 1);
        return JSON.parse(cleaned);
    } catch (e) { 
        console.error("⚠️ JSON structure was incomplete. Retrying...");
        return null; 
    }
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
                        content: `You are a Nigerian YouTube Mentor. You speak in short, impactful phrases.
                        RULES:
                        1. SCENES: Exactly 35 scenes.
                        2. TEXT: 3-5 words per scene.
                        3. PACING: Use commas (,) and ellipses (...) for natural pauses.
                        4. KEYWORDS: Direct physical terms (e.g., 'smartphone', 'bright office', 'money').
                        Return ONLY JSON: {"scenes": [{"text": "Scene text...", "keyword": "query"}]}` 
                    },
                    { role: "user", content: `Topic: ${topic}` }
                ],
                max_tokens: 2000,
                response_format: { type: "json_object" }
            }, { headers: { 'Authorization': `Bearer ${key}` }, timeout: 40000 });

            const data = robustJSONParse(response.data.choices[0].message.content);
            if (data && data.scenes && data.scenes.length > 20) return data.scenes;
        } catch (e) { console.warn("⚠️ API struggle... trying next key."); }
    }
    throw new Error("CRITICAL: Script failed. Verify API keys and limits.");
}

/**
 * STEP 2 & 3: NIGERIAN VOICE & CLIP DOWNLOADS
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Nigerian Tutor Voice (-12% rate)...");
    const fullScript = scenes.map(s => s.text).join(' ').replace(/["']/g, "");
    
    // Using Ezinne for that authentic Nigerian Female Mentor sound
    execSync(`edge-tts --voice en-NG-EzinneNeural --text "${fullScript}" --write-media voice.mp3 --rate=-12%`);

    console.log(`🎬 Step 3: Fetching 35 Viral Clips (Pexels First)...`);
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
 * STEP 4: PRECISION ASSEMBLY (Anton Font + Fixed Regex)
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Final Assembly (Anton Font + Word-for-Word)...");
    
    const audioDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`).toString());
    const totalWords = scenes.map(s => s.text).join(' ').split(' ').length;
    const timePerWord = audioDur / totalWords;

    let concatList = "";
    videoFiles.forEach((file) => { concatList += `file '${file}'\nduration ${audioDur / scenes.length}\n`; });
    concatList += `file '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    // ANTON STYLE: Yellow, Bold, Giant Outline
    let filterString = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";
    const fontPath = "./fonts/Anton.ttf";
    
    let currentTime = 0;
    scenes.forEach((scene) => {
        const words = scene.text.split(' ');
        words.forEach((word) => {
            const end = currentTime + timePerWord;
            const cleanWord = word.toUpperCase().replace(/[^A-Z]/g, ""); // FIXED: Corrected regex flag
            
            if (cleanWord.length > 0) {
                filterString += `,drawtext=fontfile='${fontPath}':text='${cleanWord}':fontcolor=yellow:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2:borderw=25:bordercolor=black:enable='between(t,${currentTime.toFixed(2)},${end.toFixed(2)})'`;
            }
            currentTime = end;
        });
    });

    fs.writeFileSync('filters.txt', `${filterString}[outv]`);

    let audioInput = "-i voice.mp3";
    let audioFilter = '[1:a]copy[aout]';
    if (fs.existsSync('background.mp3')) {
        audioInput = "-i voice.mp3 -i background.mp3";
        audioFilter = '[2:a]volume=0.10,aloop=loop=-1:size=2e9[bg];[1:a][bg]amix=inputs=2:duration=first[aout]';
    }

    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt ${audioInput} \
        -filter_complex_script filters.txt -filter_complex "${audioFilter}" \
        -map "[outv]" -map "[aout]" \
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
        console.log(`🏆 SUCCESS! Sovereign Engine finished with perfect sync.`);
    } catch (e) {
        console.error("🔥 ERROR:", e.message);
        process.exit(1);
    }
}
main();
