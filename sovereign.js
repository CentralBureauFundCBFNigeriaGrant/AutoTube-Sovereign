// ===================================================================
// 🛰️ AUTO-TUBE SOVEREIGN V10.1 - GODZILLA EDITION
// ===================================================================
// Integrated for GitHub Actions Workflow
// Uses: GROQ_API_KEY, PEXELS_API_KEY, PIXABAY_API_KEY, YT_* secrets
// Fallback: Uses repo's backup.mp4 if stock footage fails.
// ===================================================================

const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

// ========== CONFIGURATION (MATCHES YOUR GITHUB SECRETS) ==========
const GROQ_KEY = process.env.GROQ_API_KEY;
const PEXELS_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY;
const YT_CLIENT_ID = process.env.YT_CLIENT_ID;
const YT_CLIENT_SECRET = process.env.YT_CLIENT_SECRET;
const YT_REFRESH_TOKEN = process.env.YT_REFRESH_TOKEN;

const TARGET_DURATION = 60; // Seconds
const BACKUP_VIDEO = 'backup.mp4'; // Already in your repo

// ========== ROBUST JSON PARSING ==========
function robustJSONParse(text) {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        return JSON.parse(text.substring(start, end + 1));
    } catch (e) { return null; }
}

// ========== SCRIPT GENERATION (LLAMA 3.1) ==========
async function getContent(topic = "How to go viral on YouTube in 2026") {
    console.log("🧠 Generating Nigerian Mentor script...");
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant",
            messages: [{ 
                role: "system", 
                content: `You are a Male Nigerian Mentor (Abeo voice). Create a 60-second video script.
                RULES:
                - EXACTLY 22 scenes.
                - Each scene 3-5 words max.
                - First scene is a dynamic hook.
                - Last scene: "Subscribe for more viral secrets!"
                Return ONLY valid JSON: {"scenes": [{"text": "...", "keyword": "..."}]}`
            }, { 
                role: "user", 
                content: `Topic: ${topic}` 
            }],
            response_format: { type: "json_object" },
            temperature: 0.7
        }, { headers: { 'Authorization': `Bearer ${GROQ_KEY}` }, timeout: 30000 });

        const data = robustJSONParse(response.data.choices[0].message.content);
        if (data?.scenes && data.scenes.length >= 20) {
            console.log(`✅ Script ready: ${data.scenes.length} scenes.`);
            return data.scenes;
        }
        throw new Error("Invalid scene count.");
    } catch (e) {
        console.warn("⚠️ AI failed. Using emergency script.");
        // Hardcoded fallback (22 scenes, includes hook and outro)
        return [
            { text: "Stop posting trash!", keyword: "angry mentor" },
            { text: "You want viral videos?", keyword: "youtube studio" },
            { text: "Here is the secret.", keyword: "secret document" },
            { text: "Watch time is king.", keyword: "stopwatch" },
            { text: "Hook them in 3 seconds.", keyword: "fishing hook" },
            { text: "Then deliver value.", keyword: "gift box" },
            { text: "Use pattern interrupts.", keyword: "glitch effect" },
            { text: "Keep them curious.", keyword: "question mark" },
            { text: "Never be boring.", keyword: "party crowd" },
            { text: "Edit for retention.", keyword: "video editing timeline" },
            { text: "Cut the fluff.", keyword: "scissors cutting" },
            { text: "Use text on screen.", keyword: "text animation" },
            { text: "Like this video.", keyword: "thumbs up" },
            { text: "Sound design matters.", keyword: "audio mixer" },
            { text: "Tell a story.", keyword: "storytelling book" },
            { text: "Be relatable.", keyword: "friends laughing" },
            { text: "Show the result.", keyword: "trophy winner" },
            { text: "Build anticipation.", keyword: "drum roll" },
            { text: "Overdeliver value.", keyword: "overflowing treasure" },
            { text: "Ask a question.", keyword: "thinking person" },
            { text: "That's the blueprint.", keyword: "architect blueprint" },
            { text: "Subscribe for more viral secrets!", keyword: "subscribe button" }
        ];
    }
}

// ========== DOWNLOAD CLIP (PEXELS → PIXABAY → BACKUP.MP4) ==========
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

    // 1. Pexels
    if (PEXELS_KEY) {
        try {
            const res = await axios.get('https://api.pexels.com/videos/search', {
                params: { query: scene.keyword, orientation: 'portrait', per_page: 1 },
                headers: { 'Authorization': PEXELS_KEY },
                timeout: 8000
            });
            if (res.data.videos?.[0]) {
                const video = res.data.videos[0].video_files.find(f => f.quality === 'hd' || f.height >= 720);
                if (video) {
                    await downloadFromUrl(video.link);
                    console.log(`   🎬 Clip ${index}: Pexels`);
                    return;
                }
            }
        } catch (e) {}
    }

    // 2. Pixabay
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

    // 3. Fallback to backup.mp4 (Your repo's safety video)
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

// Replace generateVoiceover with this Edge‑TTS variant
async function generateVoiceover(scenes) {
    console.log("🔊 Generating Abeo voiceover...");
    const plainText = scenes.map(s => s.text).join(' ');
    fs.writeFileSync('script.txt', plainText);
    
    // Use explicit voice and rate; avoid SSML
    execSync(`edge-tts --voice en-NG-AbeoNeural --file script.txt --write-media voice.mp3 --rate=+5%`, { stdio: 'pipe' });
    
    const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.mp3`).toString());
    console.log(`   ⏱️ Voice duration: ${dur.toFixed(1)}s`);
    
    // Adjust rate to hit 60s
    if (dur < 55 || dur > 65) {
        const targetRate = Math.round((60 / dur - 1) * 100);
        execSync(`edge-tts --voice en-NG-AbeoNeural --file script.txt --write-media voice.mp3 --rate=${targetRate}%`, { stdio: 'pipe' });
    }
    
    // Generate subtitles using aeneas (you'd need to install python and aeneas)
    // Or use a simpler approach: divide audio equally among words.
    // For perfection, I recommend Google TTS.
}

// ========== ASSEMBLE VIDEO WITH PERFECT SUBTITLE SYNC ==========
async function assembleVideo(scenes, videoFiles) {
    console.log("🎞️ Assembling final video...");
    const audioPath = 'voice.mp3';
    const bgMusicPath = 'bg.mp3';
    const audioDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${audioPath}`).toString());
    const clipDuration = audioDur / scenes.length;

    // Create concat file
    let concatList = videoFiles.map(f => `file '${f}'\nduration ${clipDuration}`).join('\n');
    concatList += `\nfile '${videoFiles[videoFiles.length-1]}'`;
    fs.writeFileSync('inputs.txt', concatList);

    const fontPath = "./fonts/Anton.ttf";
    let filterComplex = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p";
    
    let sceneStart = 0;
    scenes.forEach(scene => {
        const words = scene.text.split(' ');
        const totalChars = scene.text.replace(/\s/g, '').length || 1;
        let wordStart = sceneStart;
        words.forEach(word => {
            const clean = word.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (!clean) return;
            const weight = (clean.length / totalChars) * (clipDuration * 0.9);
            const end = wordStart + weight;
            filterComplex += `,drawtext=fontfile='${fontPath}':text='${clean}':fontcolor=yellow:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2:borderw=8:bordercolor=black:enable='between(t,${wordStart.toFixed(2)},${end.toFixed(2)})'`;
            wordStart = end;
        });
        sceneStart += clipDuration;
    });
    filterComplex += `[outv];`;

    let audioInputs = "-i voice.mp3";
    let audioMap = "-map 1:a";
    if (fs.existsSync(bgMusicPath)) {
        audioInputs += " -i bg.mp3";
        filterComplex += `[2:a]volume=0.10,aloop=loop=-1:size=2e9[bg];[1:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]`;
        audioMap = "-map '[aout]'";
    } else {
        console.log("   ℹ️ No bg.mp3 found. Using voice only.");
    }

    fs.writeFileSync('filters.txt', filterComplex);
    const cmd = `ffmpeg -y -f concat -safe 0 -i inputs.txt ${audioInputs} -filter_complex_script filters.txt -map "[outv]" ${audioMap} -c:v libx264 -preset fast -crf 22 -t ${audioDur} -c:a aac -b:a 128k -movflags +faststart -shortest output.mp4`;
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✅ Video ready: output.mp4`);
    return audioDur;
}

// ========== YOUTUBE UPLOAD ==========
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
        console.log("🛰️ GODZILLA MODE ACTIVATED");
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
