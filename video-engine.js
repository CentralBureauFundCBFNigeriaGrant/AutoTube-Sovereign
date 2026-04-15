const fs = require('fs');
const https = require('https');
const ffmpeg = require('fluent-ffmpeg');

async function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
    });
}

function generateSRT() {
    const srt = `1\n00:00:00,000 --> 00:00:10,000\nBuilding the Future of YouTube Automation.`;
    fs.writeFileSync('subtitles.srt', srt);
    console.log("📝 Subtitles created.");
}

async function runVideoEngine() {
    try {
        generateSRT();
        
        console.log("🖼️ Downloading Visual...");
        await downloadImage("https://image.pollinations.ai/prompt/cinematic%20tech%20startup%20office%204k?width=1280&height=720&nologo=true", 'ai_visual.jpg');

        console.log("🎬 Starting Final Render...");
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
                    '-preset superfast', // The speed fix
                    '-crf 20',           // High quality
                    '-c:a copy',         // Just copy the audio (don't re-process)
                    '-shortest'
                ])
                .on('error', (err) => {
                    console.error('❌ Video Error:', err.message);
                    reject(err);
                })
                .on('end', () => {
                    console.log('🚀 BOOM! Video is done: final_video.mp4');
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

