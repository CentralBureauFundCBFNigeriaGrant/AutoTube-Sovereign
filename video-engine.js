const fs = require('fs');
const https = require('https');
const ffmpeg = require('fluent-ffmpeg');

// --- 1. THE SRT GENERATOR ---
function generateSRT(text, duration) {
    const srtContent = `1
00:00:00,000 --> 00:00:${duration.toString().padStart(2, '0')},000
${text}`;
    fs.writeFileSync('subtitles.srt', srtContent);
    console.log("📝 Subtitles generated.");
}

// --- 2. ASSET DOWNLOADER ---
async function downloadAsset(url, dest, label) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) return reject(new Error(`${label} Failed: ${response.statusCode}`));
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`✅ ${label} Ready.`);
                resolve();
            });
        }).on('error', reject);
    });
}

// --- 3. THE OPTIMIZED COMPOSER ---
async function createFinalVideo(imagePath, voicePath, bgmPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log("🎬 FFmpeg: Rendering with 'Superfast' quality...");

        ffmpeg()
            .input(imagePath)
            .inputOptions(['-loop 1', '-t 10']) // 10-second duration
            .input(voicePath)
            .input(bgmPath)
            .complexFilter([
                // MOTION: Smooth zoom at 25fps
                {
                    filter: 'zoompan',
                    options: {
                        z: 'min(zoom+0.001,1.1)',
                        d: 250, // 25 fps * 10 seconds
                        s: '1920x1080',
                        fps: 25
                    },
                    outputs: 'v_zoomed'
                },
                // SUBTITLES: Burn them onto the zoomed video
                {
                    filter: 'subtitles',
                    options: { filename: 'subtitles.srt' },
                    inputs: 'v_zoomed',
                    outputs: 'v_subbed'
                },
                // AUDIO MIX: Voice (1:a) + BGM (2:a) at 15% volume
                {
                    filter: 'amix',
                    options: { inputs: 2, duration: 'shortest' },
                    inputs: ['1:a', '2:a']
                }
            ])
            .outputOptions([
                '-c:v libx264',
                '-preset superfast', // THE SPEED FIX: Low CPU usage, high quality
                '-crf 18',           // THE QUALITY FIX: 18 is visually lossless
                '-pix_fmt yuv420p',
                '-shortest'
            ])
            .on('end', () => {
                console.log(`🚀 Video Cooked Successfully!`);
                resolve();
            })
            .on('error', (err, stdout, stderr) => {
                console.error("❌ Error:", err.message);
                reject(err);
            })
            .save(outputPath);
    });
}

// --- EXECUTION ---
async function startProduction() {
    try {
        const script = "Experience the future of automation. Clean, fast, and effortless.";
        
        // 1. Setup Assets
        await downloadAsset(`https://image.pollinations.ai/prompt/${encodeURIComponent(script + " cinematic workspace")}?width=1920&height=1080&nologo=true`, 'ai_visual.jpg', 'AI Image');
        await downloadAsset("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", 'background_music.mp3', 'BGM');
        generateSRT(script, 10);

        // 2. Render
        await createFinalVideo('ai_visual.jpg', 'voiceover.mp3', 'background_music.mp3', 'final_video.mp4');

    } catch (err) {
        console.error("🚨 Production Failed:", err);
        process.exit(1);
    }
}

startProduction();
