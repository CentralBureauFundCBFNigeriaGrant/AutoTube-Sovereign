const fs = require('fs');
const https = require('https');
const ffmpeg = require('fluent-ffmpeg');

// Helper to download assets
async function downloadAsset(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
    });
}

// DYNAMIC SUBTITLE GENERATOR
function generateSRT() {
    if (!fs.existsSync('metadata.json')) {
        throw new Error("Missing metadata.json! Run index.js first.");
    }

    const metadata = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
    const scriptText = metadata.text;
    const duration = metadata.duration;

    // Formats the SRT block to match the duration of the audio
    const srtContent = `1
00:00:00,000 --> 00:00:${duration.toString().padStart(2, '0')},000
${scriptText}`;

    fs.writeFileSync('subtitles.srt', srtContent);
    console.log("📝 Subtitles synced to metadata.");
}

async function runVideoEngine() {
    try {
        // 1. Setup
        generateSRT();
        const imageUrl = "https://image.pollinations.ai/prompt/cinematic%20high%20tech%20studio%20lighting%204k?width=1280&height=720&nologo=true";
        await downloadAsset(imageUrl, 'ai_visual.jpg');

        // 2. Render
        console.log("🎬 Rendering Final Video...");
        return new Promise((resolve, reject) => {
            ffmpeg()
                .input('ai_visual.jpg')
                .inputOptions(['-loop 1', '-t 10'])
                .input('mixed_audio.mp3')
                .complexFilter([
                    {
                        filter: 'zoompan',
                        options: { z: 'zoom+0.001', d: 250, s: '1280x720', fps: 25 },
                        outputs: 'v'
                    },
                    {
                        filter: 'subtitles',
                        options: { filename: 'subtitles.srt' },
                        inputs: 'v'
                    }
                ])
                .outputOptions([
                    '-c:v libx264',
                    '-preset superfast', // High speed preset
                    '-crf 20',           // High quality constant rate factor
                    '-c:a copy',         // Do not re-encode audio (saves time)
                    '-shortest'
                ])
                .on('error', (err) => reject(err))
                .on('end', () => {
                    console.log('🚀 Final Output: final_video.mp4 created.');
                    resolve();
                })
                .save('final_video.mp4');
        });
    } catch (err) {
        console.error("🚨 Video Engine Failed:", err);
        process.exit(1);
    }
}

runVideoEngine();
                    
