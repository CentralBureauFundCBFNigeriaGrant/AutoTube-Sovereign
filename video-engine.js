const fs = require('fs');
const https = require('https');
const ffmpeg = require('fluent-ffmpeg');

async function downloadAsset(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
    });
}

function generateSRT() {
    const metadata = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
    // Fixed: Matches the 'fullScript' key from index.js
    const scriptText = metadata.fullScript || "Follow @RichDaddyYo for more!"; 
    
    const srtContent = `1
00:00:00,000 --> 00:01:00,000
${scriptText}`;

    fs.writeFileSync('subtitles.srt', srtContent);
}

async function runVideoEngine() {
    try {
        generateSRT();
        // Updated: Vertical image prompt (9:16)
        const imageUrl = "https://image.pollinations.ai/prompt/luxury%20vertical%20office%20tech%209:16%204k?width=720&height=1280&nologo=true";
        await downloadAsset(imageUrl, 'ai_visual.jpg');

        console.log("🎬 Rendering 60s Vertical Short...");
        return new Promise((resolve, reject) => {
            ffmpeg()
                .input('ai_visual.jpg').inputOptions(['-loop 1', '-t 60']) // Set to 60s
                .input('mixed_audio.mp3')
                .complexFilter([
                    // Updated: Vertical zoom settings
                    { filter: 'zoompan', options: { z: 'zoom+0.001', d: 1500, s: '720x1280', fps: 25 }, outputs: 'v' },
                    { filter: 'subtitles', options: { filename: 'subtitles.srt' }, inputs: 'v' }
                ])
                .outputOptions([
                    '-c:v libx264',
                    '-preset superfast',
                    '-crf 22',
                    '-c:a aac',
                    '-b:a 128k',
                    '-shortest'
                ])
                .on('error', (err) => reject(err))
                .on('end', () => {
                    console.log('🚀 Final Output Created.');
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
                            
