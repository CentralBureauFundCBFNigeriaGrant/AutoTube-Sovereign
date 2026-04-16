const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

const GROQ_KEYS = [process.env.GROQ_API_KEY].filter(k => k);
const PEXELS_API_KEY = process.env.PEXELS_API_KEY; 
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

/**
 * ROBUST PARSE: This prevents the "Script failed" error by cleaning AI clutter.
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
 * STEP 1: THE BRAIN (Now structured for Human Teaching)
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
                        content: `You are an expert YouTube Mentor. You speak in short, punchy phrases. 
                        RULES:
                        1. SCENES: Exactly 35 scenes.
                        2. TEXT: Each scene must be a short "teaching burst" (3-6 words).
                        3. PACING: Use commas (,) and ellipses (...) to signify pauses where a teacher would breathe. 
                        4. TONE: Do not write a "speech." Write a series of impactful insights.
                        5. KEYWORDS: Physical, high-quality visual terms (e.g., 'professional studio', 'smiling mentor', 'viral graph').
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
 * STEP 2 & 3: CLEAN VOICE & CLIPS
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Human-Paced Voiceover...");
    const fullScript = scenes.map(s => s.text).join(' ').replace(/["']/g, "");
    
    // -12% rate gives that relaxed, authoritative "Mentor" vibe.
    execSync(`edge-tts --voice en-US-GuyNeural --text "${fullScript}" --write-media voice.mp3 --rate=-12%`);

    console.log(`🎬 Step 3: Fetching 35 Viral Clips (Pexels First)...`);
    const downloadClip = async (scene, i) => {
        let videoUrl = null;
        const query = encodeURIComponent(scene.keyword);

        if (PEXELS_API_KEY) {
            try {
                const res = await axios.get(`https://api.pexels.com/videos/search?query=${query}&orientation=portrait&per_page=1`, {
                    headers: { 'Authorization': PEXELS_API_KEY }, timeout: 8000
                });
                if (res.data.videos?.length > 0) videoUrl = res.data.videos[0].video_files[0].link;
            } catch (e) {}
        }

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
 * STEP 4: PRECISION ASSEMBLY (Anton Font + High Outline)
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Final Assembly (Anton Font Style)...");
    
    const audioDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`).toString());
    const totalWordsCount = scenes.map(s => s.text).join(' ').split(' ').length;
    const timePerWord = audioDur / totalWordsCount;

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
            const cleanWord = word.toUpperCase().replace(/[^A-Z]/G, ""); 
            
            if (cleanWord.length > 0) {
                filterString += `,drawtext=fontfile='${fontPath}':text='${cleanWord}':fontcolor=yellow:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2:borderw=25:bordercolor=black:enable='between(t,${currentTime.toFixed(2)},${end.toFixed(2)})'`;
            }
            currentTime = end;
        });
    });

    fs.writeFileSync('filters.txt', `${filterString}[outv]`);

    // Music Mixing Logic (Ducking at 10%)
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

async function main() {
    try {
        const scenes = await getContent();
        const videoFiles = await processMedia(scenes);
        await assembleVideo(scenes, videoFiles);
        console.log(`🏆 SUCCESS! Video is ready for YouTube.`);
    } catch (e) {
        console.error("🔥 ERROR:", e.message);
        process.exit(1);
    }
}
main();
