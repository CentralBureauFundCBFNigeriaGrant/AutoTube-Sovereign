const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

const GROQ_KEYS = [process.env.GROQ_API_KEY].filter(k => k);
const PEXELS_API_KEY = process.env.PEXELS_API_KEY; 
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

/**
 * STEP 1: THE BRAIN (Short Sentences + Human Pacing)
 */
async function getContent() {
    console.log("🧠 Step 1: Generating Human-Paced Tutor Script...");
    for (let key of GROQ_KEYS) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [{ 
                    role: "system", 
                    content: `You are a calm, expert YouTube Mentor. Output ONLY JSON.
                    RULES:
                    1. STRUCTURE: Exactly 35 scenes.
                    2. PACING: Each scene MUST be 3 to 5 words long. 
                    3. PUNCTUATION: Use commas after almost every scene to force the narrator to breathe and pause.
                    4. KEYWORDS: Physical objects for Pexels (e.g., 'luxury office', 'man typing', 'golden coin').
                    Return format: {"scenes": [{"text": "Scene text here,", "keyword": "visual_query"}]}` 
                }, { role: "user", content: "Topic: How to go viral on YouTube in 2026" }],
                response_format: { type: "json_object" }
            }, { headers: { 'Authorization': `Bearer ${key}` }, timeout: 30000 });

            const data = JSON.parse(response.data.choices[0].message.content);
            if (data?.scenes) return data.scenes;
        } catch (e) { console.warn("⚠️ Groq Key failed..."); }
    }
    throw new Error("Script failed.");
}

/**
 * STEP 2 & 3: CLEAN VOICE & CLIPS
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Clean Tutor Voice (-12% rate)...");
    const fullScript = scenes.map(s => s.text).join(' ').replace(/["']/g, "");
    // Using GuyNeural for professional clarity
    execSync(`edge-tts --voice en-US-GuyNeural --text "${fullScript}" --write-media voice.mp3 --rate=-12%`);

    console.log(`🎬 Step 3: Fetching 35+ Pexels Clips...`);
    const downloadClip = async (scene, i) => {
        let videoUrl = null;
        const query = encodeURIComponent(scene.keyword);
        try {
            const res = await axios.get(`https://api.pexels.com/videos/search?query=${query}&orientation=portrait&per_page=1`, {
                headers: { 'Authorization': PEXELS_API_KEY }, timeout: 8000
            });
            if (res.data.videos?.length > 0) videoUrl = res.data.videos[0].video_files[0].link;
        } catch (e) {}
        
        const path = `clip_${i}.mp4`;
        if (!videoUrl) { fs.copyFileSync('backup.mp4', path); return; }
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
 * STEP 4: ANTON FONT & HORMOZI SYNC
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Final Assembly (Anton Font + Music)...");
    
    const audioDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`).toString());
    const totalWords = scenes.map(s => s.text).join(' ').split(' ').length;
    const timePerWord = audioDur / totalWords;

    let concatList = "";
    videoFiles.forEach((file) => { concatList += `file '${file}'\nduration ${audioDur / scenes.length}\n`; });
    concatList += `file '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    // ANTON FONT STYLE: Huge (180), Yellow, Massive Black Outline (25)
    let filterString = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";
    const fontPath = "./fonts/Anton.ttf";
    
    let currentTime = 0;
    scenes.forEach((scene) => {
        const words = scene.text.split(' ');
        words.forEach((word) => {
            const end = currentTime + timePerWord;
            const clean = word.toUpperCase().replace(/[^A-Z]/g, "");
            if (clean) {
                filterString += `,drawtext=fontfile='${fontPath}':text='${clean}':fontcolor=yellow:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2:borderw=25:bordercolor=black:enable='between(t,${currentTime.toFixed(2)},${end.toFixed(2)})'`;
            }
            currentTime = end;
        });
    });

    fs.writeFileSync('filters.txt', `${filterString}[outv]`);

    // Music Mixing Logic
    let audioIn = "-i voice.mp3";
    let audioFilt = "[1:a]copy[aout]";
    if (fs.existsSync('background.mp3')) {
        audioIn = "-i voice.mp3 -i background.mp3";
        audioFilt = "[2:a]volume=0.10,aloop=loop=-1:size=2e9[bg];[1:a][bg]amix=inputs=2:duration=first[aout]";
    }

    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt ${audioIn} \
        -filter_complex_script filters.txt -filter_complex "${audioFilt}" \
        -map "[outv]" -map "[aout]" -c:v libx264 -preset ultrafast -t ${audioDur} -c:a aac output.mp4`;
    
    execSync(cmd, { stdio: 'inherit' });
}

async function main() {
    try {
        const scenes = await getContent();
        const videoFiles = await processMedia(scenes);
        await assembleVideo(scenes, videoFiles);
        console.log(`🏆 DONE! High-quality Anton-styled video generated.`);
    } catch (e) { console.error("🔥 ERROR:", e.message); }
}
main();
