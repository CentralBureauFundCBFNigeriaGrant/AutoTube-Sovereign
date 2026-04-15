const fs = require('fs');
const https = require('https');
const ffmpeg = require('fluent-ffmpeg');

async function downloadBGM(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
    });
}

async function mixAudio() {
    console.log("🎵 Mixing Voice and Background Music...");
    const bgmUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
    
    await downloadBGM(bgmUrl, 'bgm.mp3');

    ffmpeg()
        .input('voiceover.mp3')
        .input('bgm.mp3')
        .complexFilter([
            {
                filter: 'amix',
                options: { inputs: 2, duration: 'first' }, // Match duration to the voiceover
            },
            {
                filter: 'volume',
                options: { volume: '1.0' } // Keeps voice clear
            }
        ])
        .on('end', () => console.log("✅ Audio Mixed: mixed_audio.mp3"))
        .on('error', (err) => console.error("❌ Audio Error:", err))
        .save('mixed_audio.mp3');
}

mixAudio();
                  
