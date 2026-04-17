// ===================================================================
// 🛰️ AUTO-TUBE SOVEREIGN V14.0 - UNBREAKABLE GODZILLA
// ===================================================================
// - Edge TTS with plain text (no newlines)
// - FFmpeg atempo forces exactly 60 seconds
// - Filter complex built in memory (no script file)
// - Comprehensive error logging
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

// ========== HELPER: ROBUST JSON PARSE ==========
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

// ========== STEP 3: GENERATE VOICEOVER + FORCE 60s WITH ATEMPO ==========
async function generateVoiceover(scenes) {
    console.log("🔊 Generating Nigerian Male voiceover with Edge TTS...");

    // Single line text (spaces only, no newlines)
    const plainText = scenes.map(s => s.text).join(' ');
    fs.writeFileSync('script.txt', plainText);
    console.log(`   📝 Text length: ${plainText.length} chars`);

    // Synthesize with default rate
    const cmd = `edge-tts --voice ${TTS_VOICE} --file script.txt --write-media raw_voice.mp3`;
    console.log(`   🎙️ Running: ${cmd}`);
    execSync(cmd, { stdio: 'pipe' });

    // Get raw duration
    const rawDur = parseFloat(execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 raw_voice.mp3`
    ).toString());
    console.log(`   ⏱️ Raw duration: ${rawDur.toFixed(2)}s`);

    // Force exactly 60 seconds using atempo (audio tempo filter)
    // atempo only accepts values between 0.5 and 2.0, so we chain if needed
    const tempo = rawDur / TARGET_DURATION;
    console.log(`   🎚️ Required tempo adjustment: ${tempo.toFixed(3)}x`);

    let atempoFilter = '';
    let remainingTempo = tempo;
    while (remainingTempo > 2.0) {
        atempoFilter += `atempo=2.0,`;
        remainingTempo /= 2.0;
    }
    while (remainingTempo < 0.5) {
        atempoFilter += `atempo=0.5,`;
        remainingTempo /= 0.5;
    }
    atempoFilter += `atempo=${remainingTempo.toFixed(3)}`;

    const ffmpegTempoCmd = `ffmpeg -y -i raw_voice.mp3 -filter:a "${atempoFilter}" -vn voice.mp3`;
    console.log(`   🔧 Adjusting tempo: ${ffmpegTempoCmd}`);
    execSync(ffmpegTempoCmd, { stdio: 'pipe' });

    const finalDur = parseFloat(execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`
    ).toString());
    console.log(`   ✅ Final voiceover duration: ${finalDur.toFixed(2)}s`);

    // Also generate subtitles VTT for rough timing (we'll use scene-based timing later)
    execSync(`edge-tts --voice ${TTS_VOICE} --file script.txt --write-subtitles subtitles.vtt`, { stdio: 'pipe' });
}

// ========== STEP 4: ASSEMBLE VIDEO WITH CHARACTER-WEIGHTED SUBTITLES ==========
async function assembleVideo(scenes, videoFiles) {
    console.log("🎞️ Assembling final video...");

    const audioPath = 'voice.mp3';
    const bgMusicPath = 'bg.mp3';
    const audioDur = parseFloat(execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${audioPath}`
    ).toString());
    const clipDuration = audioDur / scenes.length;

    // Build concat file
    let concatList = videoFiles.map(f => `file '${f}'\nduration ${clipDuration}`).join('\n');
    concatList += `\nfile '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    // Build filter complex in memory
    const fontPath = "./fonts/Anton.ttf";
    let filterComplex = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";

    // Get scene timings from VTT (or fallback to even split)
    let sceneTimes = [];
    try {
        const vtt = fs.readFileSync('subtitles.vtt', 'utf8');
        const lines = vtt.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('-->')) {
                const times = lines[i].split(' --> ');
                const toSec = (t) => {
                    const parts = t.split(':');
                    return parseFloat(parts[0])*3600 + parseFloat(parts[1])*60 + parseFloat(parts[2]);
                };
                sceneTimes.push({ start: toSec(times[0]), end: toSec(times[1]) });
            }
        }
    } catch (e) {
        console.warn("   ⚠️ VTT parsing failed, using even scene division.");
    }

    if (sceneTimes.length !== scenes.length) {
        sceneTimes = scenes.map((_, i) => ({
            start: (i / scenes.length) * audioDur,
            end: ((i + 1) / scenes.length) * audioDur
        }));
    }

    // Add drawtext filters for each word
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

    filterComplex += `[outv]`;

    // Build audio mixing part
    let audioInputs = "-i voice.mp3";
    let audioMap = "-map 1:a";
    if (fs.existsSync(bgMusicPath)) {
        audioInputs += " -i bg.mp3";
        filterComplex += `;[2:a]volume=0.10,aloop=loop=-1:size=2e9[bg];[1:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]`;
        audioMap = "-map '[aout]'";
    }

    // Final FFmpeg command with filter_complex passed directly (no script file)
    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt ${audioInputs} -filter_complex "${filterComplex}" -map "[outv]" ${audioMap} -c:v libx264 -preset fast -crf 22 -t ${audioDur} -c:a aac -b:a 128k -movflags +faststart -shortest output.mp4`;
    console.log("   🔨 Encoding video...");
    try {
        execSync(cmd, { stdio: 'inherit' });
    } catch (e) {
        console.error("   ❌ FFmpeg failed. Dumping filter complex for debugging:");
        fs.writeFileSync('filter_debug.txt', filterComplex);
        console.error("   📄 Filter complex saved to filter_debug.txt");
        throw e;
    }
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
        console.log("🛰️ GODZILLA V14.0 ACTIVATED (UNBREAKABLE)");
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
