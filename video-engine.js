const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

const GROQ_KEYS = [process.env.GROQ_API_KEY].filter(k => k);
const PEXELS_API_KEY = process.env.PEXELS_API_KEY; 

function robustJSONParse(text) {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        return JSON.parse(text.substring(start, end + 1));
    } catch (e) { return null; }
}

/**
 * STEP 1: THE BRAIN (Now with Forced CTA)
 */
async function getContent() {
    console.log("🧠 Step 1: Generating High-Authority Script...");
    for (let key of GROQ_KEYS) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.1-8b-instant",
                messages: [{ 
                    role: "system", 
                    content: `You are a world-class Male Nigerian Tech Mentor. 
                    RULES:
                    1. EXACTLY 30 scenes. 
                    2. Each scene is 3-4 words. 
                    3. ALWAYS end the final scene with: "Subscribe for more viral secrets!"
                    4. KEYWORDS: Physical high-end objects.
                    Return JSON: {"scenes": [{"text": "Word word word", "keyword": "query"}]}` 
                }, { role: "user", content: "Topic: YouTube Growth 2026" }],
                response_format: { type: "json_object" }
            }, { headers: { 'Authorization': `Bearer ${key}` }, timeout: 30000 });

            const data = robustJSONParse(response.data.choices[0].message.content);
            if (data?.scenes) return data.scenes;
        } catch (e) { console.warn("⚠️ Groq Retry..."); }
    }
    throw new Error("Script failed.");
}

/**
 * STEP 2 & 3: MALE VOICE WITH FORCED PAUSES
 */
async function processMedia(scenes) {
    console.log("🎙️ Step 2: Generating Male Nigerian Voice with SSML Pauses...");
    
    // We build an SSML string to force 500ms breaks between scenes
    let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-NG">`;
    scenes.forEach(s => {
        ssml += `${s.text}<break time="500ms"/>`;
    });
    ssml += `</speak>`;
    fs.writeFileSync('script.ssml', ssml);

    // Using Abeo (Authoritative Male Nigerian)
    execSync(`edge-tts --voice en-NG-AbeoNeural --ssml-file script.ssml --write-media voice.mp3 --rate=-10%`);

    console.log(`🎬 Step 3: Fetching Clips...`);
    const downloadClip = async (scene, i) => {
        let videoUrl = null;
        try {
            const res = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(scene.keyword)}&orientation=portrait&per_page=1`, {
                headers: { 'Authorization': PEXELS_API_KEY }, timeout: 8000
            });
            if (res.data.videos?.[0]) videoUrl = res.data.videos[0].video_files[0].link;
        } catch (e) {}

        const path = `clip_${i}.mp4`;
        if (!videoUrl) { fs.copyFileSync('backup.mp4', path); return; }
        const writer = fs.createWriteStream(path);
        const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
        response.data.pipe(writer);
        return new Promise(r => writer.on('finish', r));
    };

    for (let i = 0; i < scenes.length; i += 5) {
        await Promise.all(scenes.slice(i, i + 5).map((s, idx) => downloadClip(s, i + idx)));
    }
    return scenes.map((_, i) => `clip_${i}.mp4`);
}

/**
 * STEP 4: PRECISION SYNC (Weighted by Word Length)
 */
async function assembleVideo(scenes, videoFiles) {
    console.log("✂️ Step 4: Assembling with 100% Accuracy...");
    
    const audioDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`).toString());
    
    // Create the concat list for background videos
    let concatList = "";
    videoFiles.forEach((f) => { concatList += `file '${f}'\nduration ${audioDur / scenes.length}\n`; });
    concatList += `file '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    const fontPath = "./fonts/Anton.ttf";
    let vFilter = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";
    
    let sceneStartTime = 0;
    const sceneDuration = audioDur / scenes.length;

    scenes.forEach((scene) => {
        const words = scene.text.split(' ');
        const totalChars = scene.text.length;
        let wordStartTime = sceneStartTime;

        words.forEach((word) => {
            // Give each word time based on how long it is (proportionate)
            const wordWeight = (word.length / totalChars) * (sceneDuration * 0.8); // 80% of time for words, 20% for the break
            const wordEndTime = wordStartTime + wordWeight;
            const clean = word.toUpperCase().replace(/[^A-Z]/g, "");

            if (clean) {
                vFilter += `,drawtext=fontfile='${fontPath}':text='${clean}':fontcolor=yellow:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2:borderw=15:bordercolor=black:enable='between(t,${wordStartTime.toFixed(2)},${wordEndTime.toFixed(2)})'`;
            }
            wordStartTime = wordEndTime;
        });
        sceneStartTime += sceneDuration;
    });

    fs.writeFileSync('filters.txt', vFilter + "[outv]");

    let audioIn = "-i voice.mp3";
    let aFilt = "[1:a]copy[aout]";
    if (fs.existsSync('background.mp3')) {
        audioIn = "-i voice.mp3 -i background.mp3";
        aFilt = "[2:a]volume=0.10,aloop=loop=-1:size=2e9[bg];[1:a][bg]amix=inputs=2:duration=first[aout]";
    }

    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt ${audioIn} -filter_complex_script filters.txt -filter_complex "${aFilt}" -map "[outv]" -map "[aout]" -c:v libx264 -preset ultrafast -t ${audioDur} output.mp4`;
    execSync(cmd, { stdio: 'inherit' });
}

async function main() {
    try {
        const scenes = await getContent();
        const files = await processMedia(scenes);
        await assembleVideo(scenes, files);
        console.log("🏆 PROJECT COMPLETE: Paused, Male, and Subscribed.");
    } catch (e) { console.error(e.message); }
}
main();
