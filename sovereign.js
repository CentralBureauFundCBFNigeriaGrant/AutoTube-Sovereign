// ===================================================================
// 🛰️ AUTO-TUBE SOVEREIGN V11.1 - GODZILLA PATCHED
// ===================================================================
// - Strict 20-scene limit
// - Google TTS with credential sanitization
// - SSML character escaping
// - Plain‑text fallback for TTS
// - Improved error visibility
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
const SCENE_COUNT = 20; // Hard‑coded for 60s videos

// ========== HELPER: ROBUST JSON PARSE ==========
function robustJSONParse(text) {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        return JSON.parse(text.substring(start, end + 1));
    } catch (e) { return null; }
}

// ========== SSML ESCAPE ==========
function escapeSSML(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ========== SANITIZE GOOGLE CREDENTIALS ==========
function getGoogleCredentials() {
    const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!creds) {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set.');
    }
    // If it's a file path, read it; otherwise treat as JSON string
    if (fs.existsSync(creds)) {
        return JSON.parse(fs.readFileSync(creds, 'utf8'));
    }
    // Attempt to parse as JSON, with trimming
    try {
        return JSON.parse(creds.trim());
    } catch (e) {
        console.error('❌ Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS:');
        console.error(creds.substring(0, 100) + '...');
        throw new Error('Credentials are not valid JSON.');
    }
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

// ========== STEP 2: DOWNLOAD CLIPS (PEXELS → PIXABAY → BACKUP) ==========
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
            const video = res.data.videos?.[0]?.video_files.find(f => f.quality === 'hd' || f.height >= 720);
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

// ========== STEP 3: GOOGLE TTS WITH PROPER SSML AND FALLBACK ==========
async function generateVoiceover(scenes) {
    console.log("🔊 Generating Google Cloud TTS voiceover...");

    // Sanitize credentials first
    const credentials = getGoogleCredentials();
    const client = new textToSpeech.TextToSpeechClient({ credentials });

    // Build SSML with escapes and <mark> tags
    let ssml = '<speak>';
    scenes.forEach((scene, sceneIdx) => {
        const words = scene.text.split(' ');
        words.forEach((word, wordIdx) => {
            const cleanWord = word.replace(/[^\w']/g, ''); // keep letters, numbers, apostrophe
            if (cleanWord) {
                const escapedWord = escapeSSML(cleanWord);
                ssml += `<mark name="s${sceneIdx}w${wordIdx}"/>${escapedWord} `;
            }
        });
        if (sceneIdx < scenes.length - 1) {
            ssml += '<break time="300ms"/>';
        }
    });
    ssml += '</speak>';

    // Write SSML to file for debugging
    fs.writeFileSync('debug.ssml', ssml);
    console.log('   📝 SSML written to debug.ssml');

    let response;
    try {
        // Attempt SSML synthesis
        [response] = await client.synthesizeSpeech({
            input: { ssml },
            voice: {
                languageCode: 'en-NG',
                name: 'en-NG-Standard-B',
                ssmlGender: 'MALE'
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: 1.0,
                pitch: 0.0
            },
            enableTimePointing: ['SSML_MARK']
        });
    } catch (ssmlError) {
        console.error('   ❌ SSML synthesis failed:', ssmlError.message);
        console.log('   🔄 Falling back to plain text TTS...');

        // Fallback to plain text (no SSML, no word timings)
        const plainText = scenes.map(s => s.text).join('. ');
        [response] = await client.synthesizeSpeech({
            input: { text: plainText },
            voice: {
                languageCode: 'en-NG',
                name: 'en-NG-Standard-B',
                ssmlGender: 'MALE'
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: 1.0,
                pitch: 0.0
            }
            // No timepoints in plain text mode
        });
        console.log('   ⚠️ Plain text TTS used – subtitles will be evenly spaced.');
    }

    // Write audio
    fs.writeFileSync('voice.mp3', response.audioContent, 'binary');
    console.log('   ✅ Voiceover generated.');

    // Get duration
    const dur = parseFloat(execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`
    ).toString());
    console.log(`   ⏱️ Voice duration: ${dur.toFixed(1)}s`);

    // Adjust speaking rate if needed (only if we have timepoints to regenerate)
    if (response.timepoints && response.timepoints.length > 0 && (dur < 55 || dur > 65)) {
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
        const newDur = parseFloat(execSync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`
        ).toString());
        console.log(`   ✅ Adjusted duration: ${newDur.toFixed(1)}s`);
        response = adjustedResp;
    }

    // Save timepoints if available
    if (response.timepoints) {
        const timings = response.timepoints.map(tp => ({
            mark: tp.markName,
            timeSeconds: parseFloat(tp.timeSeconds)
        }));
        fs.writeFileSync('timings.json', JSON.stringify(timings, null, 2));
        console.log(`   ⏱️ Word timings saved (${timings.length} marks).`);
    } else {
        // Create dummy timings for subtitle generation
        console.log('   📋 Creating fallback timings (equal word spacing).');
        const words = scenes.flatMap((s, idx) => s.text.split(' ').map((w, widx) => ({
            mark: `s${idx}w${widx}`,
            timeSeconds: (idx / scenes.length) * dur + (widx * 0.3) // rough estimate
        })));
        fs.writeFileSync('timings.json', JSON.stringify(words, null, 2));
    }
}

// ========== STEP 4: ASSEMBLE VIDEO WITH SUBTITLES ==========
async function assembleVideo(scenes, videoFiles) {
    console.log("🎞️ Assembling final video...");

    const audioPath = 'voice.mp3';
    const bgMusicPath = 'bg.mp3';
    const audioDur = parseFloat(execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${audioPath}`
    ).toString());
    const clipDuration = audioDur / scenes.length;

    // Concat file
    let concatList = videoFiles.map(f => `file '${f}'\nduration ${clipDuration}`).join('\n');
    concatList += `\nfile '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    const fontPath = "./fonts/Anton.ttf";
    let filterComplex = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";

    // Load timings
    const timings = JSON.parse(fs.readFileSync('timings.json', 'utf8'));

    // Map marks to scenes/words
    const sceneWordMap = {};
    timings.forEach(tp => {
        const match = tp.mark.match(/s(\d+)w(\d+)/);
        if (match) {
            const sIdx = parseInt(match[1]);
            const wIdx = parseInt(match[2]);
            if (!sceneWordMap[sIdx]) sceneWordMap[sIdx] = [];
            sceneWordMap[sIdx][wIdx] = {
                time: tp.timeSeconds,
                text: scenes[sIdx]?.text.split(' ')[wIdx] || ''
            };
        }
    });

    // Add drawtext filters
    for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
        const words = sceneWordMap[sIdx] || [];
        for (let wIdx = 0; wIdx < words.length; wIdx++) {
            const current = words[wIdx];
            if (!current) continue;
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
}

// ========== STEP 5: YOUTUBE UPLOAD ==========
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
        console.log("🛰️ GODZILLA V11.1 ACTIVATED (PATCHED)");
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
