// ===================================================================
// 🛰️ AUTO-TUBE SOVEREIGN V13.1 - EDGE TTS RATE FIX
// ===================================================================
// - Fixes Edge TTS "Invalid rate '0%'" error by omitting flag for default speed
// - Uses VTT subtitles for scene timing + character-weighted word display
// - Strict 20 scenes = 60 seconds
// - 100% Free & Reliable
// ===================================================================

const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

// ========== CONFIGURATION ==========
const GROQ_KEY = process.env.GROQ_API_KEY;
const PEXELS_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY;
const YT_CLIENT_ID = process.env.YT_CLIENT_ID;
const YT_CLIENT_SECRET = process.env.YT_CLIENT_SECRET;
const YT_REFRESH_TOKEN = process.env.YT_REFRESH_TOKEN;

const TARGET_DURATION = 60;
const BACKUP_VIDEO = 'backup.mp4';
const SCENE_COUNT = 20;
const TTS_VOICE = 'en-NG-AbeoNeural';

// ========== ROBUST JSON PARSE ==========
function robustJSONParse(text) {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        return JSON.parse(text.substring(start, end + 1));
    } catch (e) { return null; }
}

// ========== STEP 1: GENERATE SCRIPT (STRICT 20 SCENES) ==========
async function getContent(topic = "How to go viral on YouTube in 2026") {
    console.log("🧠 Generating Nigerian Mentor script (strict 20 scenes)...");
    const backupScenes = [
        { text: "Stop posting trash!", keyword: "angry mentor" },
        { text: "Want viral videos?", keyword: "youtube studio" },
        { text: "Here is the secret.", keyword: "secret document" },
        { text: "Watch time is king.", keyword: "stopwatch" },
        { text: "Hook in 3 seconds.", keyword: "fishing hook" },
        { text: "Then deliver value.", keyword: "gift box" },
        { text: "Use pattern interrupts.", keyword: "glitch effect" },
        { text: "Keep them curious.", keyword: "question mark" },
        { text: "Never be boring.", keyword: "party crowd" },
        { text: "Edit for retention.", keyword: "video editing" },
        { text: "Cut the fluff.", keyword: "scissors" },
        { text: "Use text on screen.", keyword: "text animation" },
        { text: "Sound design matters.", keyword: "audio mixer" },
        { text: "Tell a story.", keyword: "storytelling" },
        { text: "Be relatable.", keyword: "friends laughing" },
        { text: "Show the result.", keyword: "trophy" },
        { text: "Build anticipation.", keyword: "drum roll" },
        { text: "Overdeliver value.", keyword: "treasure" },
        { text: "That's the blueprint.", keyword: "blueprint" },
        { text: "Subscribe for more viral secrets!", keyword: "subscribe button" }
    ];

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant",
            messages: [{
                role: "system",
                content: `You are a Male Nigerian Mentor. Create a 60‑second video script.
                RULES:
                - EXACTLY ${SCENE_COUNT} scenes. No more, no less.
                - Each scene 3-5 words max.
                - First scene is a punchy hook. Last scene is "Subscribe for more viral secrets!"
                - Return ONLY valid JSON: {"scenes": [{"text": "...", "keyword": "..."}]}`
            }, {
                role: "user",
                content: `Topic: ${topic}`
            }],
            response_format: { type: "json_object" },
            temperature: 0.7
        }, {
            headers: { 'Authorization': `Bearer ${GROQ_KEY}` },
            timeout: 30000
        });

        const data = robustJSONParse(response.data.choices[0].message.content);
        if (data?.scenes && Array.isArray(data.scenes)) {
            let scenes = data.scenes;
            if (scenes.length > SCENE_COUNT) {
                console.warn(`⚠️ AI returned ${scenes.length} scenes. Trimming to ${SCENE_COUNT}.`);
                scenes = scenes.slice(0, SCENE_COUNT);
            } else if (scenes.length < SCENE_COUNT) {
                console.warn(`⚠️ AI returned only ${scenes.length} scenes. Padding with backup.`);
                while (scenes.length < SCENE_COUNT) {
                    scenes.push(backupScenes[scenes.length % backupScenes.length]);
                }
            }
            console.log(`✅ Script ready: ${scenes.length} scenes.`);
            return scenes;
        }
        throw new Error("Invalid AI response structure.");
    } catch (e) {
        console.warn("⚠️ AI failed. Using emergency backup script (20 scenes).");
        return backupScenes.slice(0, SCENE_COUNT);
    }
}

// ========== STEP 2: DOWNLOAD CLIPS ==========
async function downloadClip(scene, index) {
    const filename = `clip_${index}.mp4`;
    const downloadFromUrl = async (url) => {
        const writer = fs.createWriteStream(filename);
        const response = await axios({ url, method: 'GET', responseType: 'stream' });
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    };

    if (PEXELS_KEY) {
        try {
            const res = await axios.get('https://api.pexels.com/videos/search', {
                params: { query: scene.keyword, orientation: 'portrait', per_page: 1 },
                headers: { 'Authorization': PEXELS_KEY },
                timeout: 8000
            });
            const video = res.data.videos?.[0]?.video_files.find(f => f.quality === 'hd' || f.height >= 720);
            if (video) {
                await downloadFromUrl(video.link);
                console.log(`   🎬 Clip ${index}: Pexels`);
                return;
            }
        } catch (e) {}
    }

    if (PIXABAY_KEY) {
        try {
            const res = await axios.get('https://pixabay.com/api/videos/', {
                params: { key: PIXABAY_KEY, q: scene.keyword, orientation: 'vertical', per_page: 3 },
                timeout: 8000
            });
            const hit = res.data.hits?.find(h => h.videos.medium?.url);
            if (hit) {
                await downloadFromUrl(hit.videos.medium.url);
                console.log(`   🎬 Clip ${index}: Pixabay`);
                return;
            }
        } catch (e) {}
    }

    console.log(`   ⚠️ Clip ${index}: Using backup.mp4`);
    fs.copyFileSync(BACKUP_VIDEO, filename);
}

async function processMedia(scenes) {
    console.log("🎥 Downloading visual assets...");
    for (let i = 0; i < scenes.length; i += 4) {
        const batch = scenes.slice(i, i + 4);
        await Promise.all(batch.map((scene, idx) => downloadClip(scene, i + idx)));
    }
    return scenes.map((_, i) => `clip_${i}.mp4`);
}

// ========== STEP 3: GENERATE VOICEOVER WITH EDGE TTS (RATE FIX) ==========
async function generateVoiceover(scenes) {
    console.log("🔊 Generating perfect 60s Nigerian Male voiceover with Edge TTS...");

    const plainText = scenes.map(scene => scene.text).join('\n');
    fs.writeFileSync('script.txt', plainText);
    console.log("   📝 Plain text script written.");

    const synthesize = (ratePercent) => {
        try { fs.unlinkSync('voice.mp3'); } catch (e) {}
        try { fs.unlinkSync('subtitles.vtt'); } catch (e) {}
        
        // Build command: omit --rate if ratePercent is 0
        let rateArg = '';
        if (ratePercent !== 0) {
            const sign = ratePercent > 0 ? '+' : '';
            rateArg = `--rate=${sign}${ratePercent}%`;
        }
        const cmd = `edge-tts --voice ${TTS_VOICE} --file script.txt --write-media voice.mp3 ${rateArg} --write-subtitles subtitles.vtt`.trim();
        console.log(`   🎙️ Running: ${cmd}`);
        execSync(cmd, { stdio: 'pipe' });
        const dur = parseFloat(execSync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`
        ).toString());
        return dur;
    };

    let currentRate = 0;
    let duration = synthesize(currentRate);
    console.log(`   ⏱️ Initial duration (default rate): ${duration.toFixed(1)}s`);

    if (duration < 55 || duration > 65) {
        console.log("   🔁 Adjusting speaking rate to hit exactly 60s...");
        const targetRate = Math.round((60 / duration - 1) * 100);
        const adjustedRate = Math.min(100, Math.max(-50, targetRate));
        console.log(`   🎚️ Trying rate: ${adjustedRate}%`);
        duration = synthesize(adjustedRate);
        console.log(`   ✅ New duration: ${duration.toFixed(1)}s`);
        
        if (duration < 55 || duration > 65) {
            const fineTuneRate = Math.round(adjustedRate + (60 / duration - 1) * 100);
            const finalRate = Math.min(100, Math.max(-50, fineTuneRate));
            console.log(`   🎚️ Final rate: ${finalRate}%`);
            duration = synthesize(finalRate);
            console.log(`   ✅ Final duration: ${duration.toFixed(1)}s`);
        }
    }
    
    console.log(`   🔈 Voiceover ready. VTT subtitles saved.`);
}

// ========== STEP 4: ASSEMBLE VIDEO WITH CHARACTER-WEIGHTED SUBTITLES ==========
async function assembleVideo(scenes, videoFiles) {
    console.log("🎞️ Assembling final video with character-weighted subtitles...");

    const audioPath = 'voice.mp3';
    const bgMusicPath = 'bg.mp3';
    const audioDur = parseFloat(execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${audioPath}`
    ).toString());
    
    let sceneTimes = [];
    try {
        const vttContent = fs.readFileSync('subtitles.vtt', 'utf8');
        const cueRegex = /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\n([\s\S]*?)(?=\n\n|\n*$)/g;
        let match;
        let idx = 0;
        while ((match = cueRegex.exec(vttContent)) !== null && idx < scenes.length) {
            const toSeconds = (t) => {
                const [h, m, s] = t.split(':');
                return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
            };
            sceneTimes.push({
                start: toSeconds(match[1]),
                end: toSeconds(match[2])
            });
            idx++;
        }
    } catch (e) {
        console.warn("   ⚠️ VTT parsing failed. Using evenly divided timing.");
    }

    if (sceneTimes.length !== scenes.length) {
        sceneTimes = scenes.map((_, i) => ({
            start: (i / scenes.length) * audioDur,
            end: ((i + 1) / scenes.length) * audioDur
        }));
    }

    let concatList = videoFiles.map(f => `file '${f}'\nduration ${audioDur / scenes.length}`).join('\n');
    concatList += `\nfile '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    const fontPath = "./fonts/Anton.ttf";
    let filterComplex = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";

    scenes.forEach((scene, sIdx) => {
        const words = scene.text.split(' ').filter(w => w.length > 0);
        const totalChars = words.reduce((sum, w) => sum + w.length, 0);
        const sceneStart = sceneTimes[sIdx].start;
        const sceneEnd = sceneTimes[sIdx].end;
        const sceneDuration = sceneEnd - sceneStart;
        
        let wordStart = sceneStart;
        words.forEach(word => {
            const cleanWord = word.toUpperCase().replace(/[^A-Z0-9']/g, '');
            if (!cleanWord) return;
            
            const wordWeight = (word.length / totalChars) * sceneDuration * 0.9;
            const wordEnd = Math.min(wordStart + wordWeight, sceneEnd);
            
            filterComplex += `,drawtext=fontfile='${fontPath}':text='${cleanWord}':fontcolor=yellow:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2:borderw=8:bordercolor=black:enable='between(t,${wordStart.toFixed(2)},${wordEnd.toFixed(2)})'`;
            
            wordStart = wordEnd;
        });
    });

    filterComplex += `[outv];`;

    let audioInputs = "-i voice.mp3";
    let audioMap = "-map 1:a";
    if (fs.existsSync(bgMusicPath)) {
        audioInputs += " -i bg.mp3";
        filterComplex += `[2:a]volume=0.10,aloop=loop=-1:size=2e9[bg];[1:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]`;
        audioMap = "-map '[aout]'";
    }

    fs.writeFileSync('filters.txt', filterComplex);
    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt ${audioInputs} -filter_complex_script filters.txt -map "[outv]" ${audioMap} -c:v libx264 -preset fast -crf 22 -t ${audioDur} -c:a aac -b:a 128k -movflags +faststart -shortest output.mp4`;
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✅ Video ready: output.mp4 (${Math.round(audioDur)} seconds)`);
}

// ========== STEP 5: UPLOAD TO YOUTUBE ==========
async function uploadToYouTube(videoPath, title, description) {
    console.log("📤 Uploading to YouTube...");
    const oauth2Client = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const res = await youtube.videos.insert({
        part: ['snippet,status'],
        requestBody: {
            snippet: { title, description, tags: ["shorts", "viral", "youtube tips"], categoryId: "27" },
            status: { privacyStatus: "public", selfDeclaredMadeForKids: false }
        },
        media: { body: fs.createReadStream(videoPath) }
    });
    console.log(`🎉 Uploaded: https://youtu.be/${res.data.id}`);
    return res.data.id;
}

// ========== MAIN ==========
async function main() {
    try {
        console.log("🛰️ GODZILLA V13.1 ACTIVATED (RATE FIX)");
        const scenes = await getContent();
        const files = await processMedia(scenes);
        await generateVoiceover(scenes);
        await assembleVideo(scenes, files);

        const title = `🔥 Viral Secrets in 60s (${new Date().toLocaleDateString()}) #Shorts`;
        const desc = `Nigerian Mentor drops the blueprint.\n👉 Subscribe for more.`;
        await uploadToYouTube('output.mp4', title, desc);
        console.log("🏆 MISSION COMPLETE.");
    } catch (e) {
        console.error("🔥 CRITICAL ERROR:", e.message);
        console.error(e.stack);
        process.exit(1);
    }
}

main();
