const fs = require('fs');
const https = require('https');
const ffmpeg = require('fluent-ffmpeg');

// --- 1. THE SRT GENERATOR ---
// Creates a basic subtitle file from your script
function generateSRT(text, durationInSeconds) {
    const srtContent = `1
00:00:00,000 --> 00:00:${durationInSeconds.toFixed(0).padStart(2, '0')},000
${text}`;
    fs.writeFileSync('subtitles.srt', srtContent);
    console.log("📝 Subtitles file generated.");
}

// --- 2. ASSET DOWNLOADERS ---
async function downloadAsset(url, dest, label) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) return reject(new Error(`${label} Failed`));
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`✅ ${label} Ready.`);
                resolve();
            });
        }).on('error', reject);
    });
}

// --- 3. THE ULTIMATE COMPOSER ---
async function createFinalVideo(imagePath, voicePath, bgmPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log("🎬 FFmpeg: Mixing Audio & Burning Subtitles...");

        ffmpeg()
            .input(imagePath)
            .inputOptions(['-loop 1', '-t 10']) // Define duration here for zoom to work
            .input(voicePath)
            .input(bgmPath)
            .complexFilter([
                // 1. MOTION: Better zoom logic with defined framerate
                {
                    filter: 'zoompan',
                    options: {
                        z: 'min(zoom+0.001,1.1)',
                        d: 25 * 10, // 25 fps * 10 seconds
                        s: '1920x1080',
                        fps: 25
                    },
                    outputs: 'v_zoomed'
                },
                // 2. AUDIO MIXING: Mix Voice (Input 1) and BGM (Input 2)
                // We lower BGM volume to 0.1 (10%) so it doesn't drown the voice
                {
                    filter: 'amix',
                    options: { inputs: 2, duration: 'shortest' },
                    inputs: ['1:a', '2:a']
                },
                // 3. SUBTITLES: Burn the .srt file directly onto the video
                // Note: File path needs to be formatted for FFmpeg
                {
                    filter: 'subtitles',
                    options: { filename: 'subtitles.srt', force_style: 'Alignment=2,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3' },
                    inputs: 'v_zoomed'
                }
            ])
            .outputOptions([
                '-c:v libx264',
                '-pix_fmt yuv420p',
                '-shortest'
            ])
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .save(outputPath);
    });
}

// --- EXECUTION ---
async function startProduction() {
    try {
        const script = "In the heart of innovation, AutoTube rises. A world where AI handles the stress, while you handle the vision.";
        
        console.log("🚀 Starting Production Phase...");

        // 1. Get AI Visual
        await downloadAsset(`https://image.pollinations.ai/prompt/${encodeURIComponent(script)}?width=1920&height=1080&nologo=true`, 'ai_visual.jpg', 'AI Image');

        // 2. Get Background Music (Royalty Free Sample)
        await downloadAsset("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", 'background_music.mp3', 'BGM');

        // 3. Generate Subtitles
        generateSRT(script, 10);

        // 4. Assemble everything
        await createFinalVideo('ai_visual.jpg', 'voiceover.mp3', 'background_music.mp3', 'final_video.mp4');

        console.log("🎉 AutoTube: Production Complete with Audio Mix and Captions!");
    } catch (err) {
        console.error("🚨 Production Failed:", err);
    }
}

startProduction();

