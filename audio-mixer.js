const fs = require('fs');
const https = require('https');
const ffmpeg = require('fluent-ffmpeg');

async function downloadAsset(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`Download Failed: ${res.statusCode}`));
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
    });
}

async function startMixing() {
    try {
        const bgmUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
        await downloadAsset(bgmUrl, 'bgm.mp3');

        return new Promise((resolve, reject) => {
            ffmpeg()
                .input('voiceover.mp3')
                .input('bgm.mp3')
                .complexFilter([
                    {
                        filter: 'volume',
                        options: { volume: '0.15' },
                        inputs: '1:a',
                        outputs: 'bgm_quiet'
                    },
                    {
                        filter: 'amix',
                        options: { inputs: 2, duration: 'first' },
                        inputs: ['0:a', 'bgm_quiet']
                    }
                ])
                .on('error', (err) => reject(err))
                .on('end', () => {
                    console.log('✅ Audio mixed successfully.');
                    resolve();
                })
                .save('mixed_audio.mp3');
        });
    } catch (error) {
        console.error("🚨 Mixer Error:", error);
        process.exit(1);
    }
}

startMixing();

