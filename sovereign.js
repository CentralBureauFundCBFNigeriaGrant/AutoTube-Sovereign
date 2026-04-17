// ===================================================================
// 🛰️ AUTO-TUBE SOVEREIGN V11 - GOOGLE TTS GODZILLA EDITION
// ===================================================================
// Perfect Voice. Perfect Timing. 60 Seconds Guaranteed.
// ===================================================================

const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');
const textToSpeech = require('@google-cloud/text-to-speech');

// ========== CONFIGURATION ==========
const GROQ_KEY = process.env.GROQ_API_KEY;
const PEXELS_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY;
const YT_CLIENT_ID = process.env.YT_CLIENT_ID;
const YT_CLIENT_SECRET = process.env.YT_CLIENT_SECRET;
const YT_REFRESH_TOKEN = process.env.YT_REFRESH_TOKEN;

const TARGET_DURATION = 60;
const BACKUP_VIDEO = 'backup.mp4';

// ========== HELPER: ROBUST JSON PARSE ==========
function robustJSONParse(text) {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        return JSON.parse(text.substring(start, end + 1));
    } catch (e) { return null; }
}

// ========== STEP 1: GENERATE SCRIPT ==========
async function getContent(topic = "How to go viral on YouTube in 2026") {
    console.log("🧠 Generating Nigerian Mentor script...");
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant",
            messages: [{
                role: "system",
                content: `You are a Male Nigerian Mentor. Create a 60-second video script.
                RULES:
                - EXACTLY 20 scenes (each ~3 seconds).
                - Each scene 3-5 words.
                - First scene: punchy hook. Last scene: "Subscribe for more viral secrets!"
                Return JSON: {"scenes": [{"text": "...", "keyword": "..."}]}`
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
        if (data?.scenes && data.scenes.length >= 18) {
            console.log(`✅ Script ready: ${data.scenes.length} scenes.`);
            return data.scenes;
        }
        throw new Error("Invalid scene count.");
    } catch (e) {
        console.warn("⚠️ AI failed. Using emergency script.");
        // 20‑scene backup
        return [
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
    }
}

// ========== STEP 2: DOWNLOAD CLIPS (SAME AS BEFORE) ==========
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

    // Pexels
    if (PEXELS_KEY) {
        try {
            const res = await axios.get('https://api.pexels.com/videos/search', {
                params: { query: scene.keyword, orientation: 'portrait', per_page: 1 },
                headers: { 'Authorization': PEXELS_KEY },
                timeout: 8000
            });
            const video = res.data.videos?.[0]?.video_files.find(f => f.quality === 'hd');
            if (video) {
                await downloadFromUrl(video.link);
                console.log(`   🎬 Clip ${index}: Pexels`);
                return;
            }
        } catch (e) {}
    }

    // Pixabay
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

    // Fallback
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

// ========== STEP 3: GOOGLE CLOUD TTS WITH WORD TIMINGS ==========
async function generateVoiceover(scenes) {
    console.log("🔊 Generating Google Cloud TTS voiceover...");
    const client = new textToSpeech.TextToSpeechClient();

    // Build SSML with <mark> tags for each word to get precise timings
    let ssml = '<speak>';
    scenes.forEach((scene, sceneIdx) => {
        const words = scene.text.split(' ');
        words.forEach((word, wordIdx) => {
            // Clean word for SSML
            const cleanWord = word.replace(/[^a-zA-Z0-9']/g, '');
            if (cleanWord) {
                ssml += `<mark name="s${sceneIdx}w${wordIdx}"/>${cleanWord} `;
            }
        });
        // Add a 300ms pause between scenes (natural breathing)
        if (sceneIdx < scenes.length - 1) {
            ssml += '<break time="300ms"/>';
        }
    });
    ssml += '</speak>';

    // Request with Nigerian Male voice and timepoint tracking
    const [response] = await client.synthesizeSpeech({
        input: { ssml },
        voice: {
            languageCode: 'en-NG',
            name: 'en-NG-Standard-B',  // Male Nigerian voice
            ssmlGender: 'MALE'
        },
        audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0,  // Adjust to hit 60s
            pitch: 0.0
        },
        enableTimePointing: ['SSML_MARK']
    });

    // Write audio file
    fs.writeFileSync('voice.mp3', response.audioContent, 'binary');
    console.log('   ✅ Voiceover generated.');

    // Parse timepoints to get word-level timings
    const timepoints = response.timepoints || [];
    const wordTimings = timepoints.map(tp => ({
        mark: tp.markName,
        timeSeconds: parseFloat(tp.timeSeconds)
    }));

    // Save timings to JSON for later use in subtitles
    fs.writeFileSync('timings.json', JSON.stringify(wordTimings, null, 2));
    console.log(`   ⏱️ Word timings captured (${wordTimings.length} words).`);

    // Get audio duration
    const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`).toString());
    console.log(`   ⏱️ Voice duration: ${dur.toFixed(1)}s`);

    // Adjust speaking rate if not within 55-65 seconds
    if (dur < 55 || dur > 65) {
        console.log(`   🔁 Adjusting speaking rate to hit 60s target...`);
        const rateAdjust = 60 / dur;
        const newRate = Math.min(1.5, Math.max(0.7, rateAdjust));
        console.log(`   🎚️ New speaking rate: ${newRate.toFixed(2)}`);
        const [adjustedResp] = await client.synthesizeSpeech({
            input: { ssml },
            voice: {
                languageCode: 'en-NG',
                name: 'en-NG-Standard-B',
                ssmlGender: 'MALE'
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: newRate,
                pitch: 0.0
            },
            enableTimePointing: ['SSML_MARK']
        });
        fs.writeFileSync('voice.mp3', adjustedResp.audioContent, 'binary');
        const newDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`).toString());
        console.log(`   ✅ Adjusted duration: ${newDur.toFixed(1)}s`);
    }
}

// ========== STEP 4: ASSEMBLE VIDEO WITH PERFECT WORD-LEVEL SUBTITLES ==========
async function assembleVideo(scenes, videoFiles) {
    console.log("🎞️ Assembling final video with Google TTS timings...");

    const audioPath = 'voice.mp3';
    const bgMusicPath = 'bg.mp3';
    const audioDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${audioPath}`).toString());
    const clipDuration = audioDur / scenes.length;

    // Create concat file
    let concatList = videoFiles.map(f => `file '${f}'\nduration ${clipDuration}`).join('\n');
    concatList += `\nfile '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    // Load word timings
    const timings = JSON.parse(fs.readFileSync('timings.json', 'utf8'));

    // Build filter graph with exact enable times from Google TTS marks
    const fontPath = "./fonts/Anton.ttf";
    let filterComplex = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";

    // Group timings by scene (marks are like "s0w0", "s0w1", ...)
    const sceneWordMap = {};
    timings.forEach(tp => {
        const match = tp.mark.match(/s(\d+)w(\d+)/);
        if (match) {
            const sceneIdx = parseInt(match[1]);
            const wordIdx = parseInt(match[2]);
            if (!sceneWordMap[sceneIdx]) sceneWordMap[sceneIdx] = [];
            sceneWordMap[sceneIdx].push({
                time: tp.timeSeconds,
                text: scenes[sceneIdx].text.split(' ')[wordIdx]
            });
        }
    });

    // For each scene, add drawtext filters for each word
    for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
        const words = sceneWordMap[sIdx] || [];
        for (let wIdx = 0; wIdx < words.length; wIdx++) {
            const current = words[wIdx];
            const next = words[wIdx + 1];
            const startTime = current.time;
            const endTime = next ? next.time : (sIdx < scenes.length - 1 ? sceneWordMap[sIdx+1]?.[0]?.time : audioDur);
            if (!endTime) continue;

            const cleanWord = current.text.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (!cleanWord) continue;

            filterComplex += `,drawtext=fontfile='${fontPath}':text='${cleanWord}':fontcolor=yellow:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2:borderw=8:bordercolor=black:enable='between(t,${startTime.toFixed(2)},${endTime.toFixed(2)})'`;
        }
    }

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
    return audioDur;
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
        console.log("🛰️ GODZILLA MODE (Google TTS) ACTIVATED");
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
        process.exit(1);
    }
}

main();
