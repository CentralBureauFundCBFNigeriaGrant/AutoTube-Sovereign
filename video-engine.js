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
    const srt = `1\n00:00:00,000 --> 00:00:10,000\nAutomated Content, Delivered.`;
    fs.writeFileSync('subtitles.srt', srt);
}

async function runVideoEngine() {
    try {
        generateSRT();
        await downloadImage("https://image.pollinations.ai/prompt/cinematic%20tech%20startup%20office%204k?width=1280&height=720&nologo=true", 'ai_visual.jpg');

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
                    '-preset superfast',
                    '-crf 20',
                    '-c:a copy',
                    '-shortest'
                ])
                .on('error', (err) => reject(err))
                .on('end', () => {
                    console.log('🚀 Video rendering complete.');
                    resolve();
                })
                .save('final_video.mp4');
        });
    } catch (err) {
        console.error("🚨 Video Error:", err);
        process.exit(1);
    }
}

runVideoEngine();

