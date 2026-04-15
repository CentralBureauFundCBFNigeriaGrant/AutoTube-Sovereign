const crypto = require('crypto');
// This polyfill fixes the "crypto is not defined" error
if (!global.crypto) {
    global.crypto = {
        getRandomValues: (arr) => crypto.randomBytes(arr.length)
    };
}

const { MsEdgeTTS } = require('msedge-tts');
const fs = require('fs');

/**
 * Generates audio using a stream to avoid "file vs folder" path errors.
 */
async function generateAudio(text, outputFileName) {
    const tts = new MsEdgeTTS();
    await tts.setMetadata("en-US-GuyNeural", "audio-24khz-48kbitrate-mono-mp3");

    try {
        console.log(`Generating audio for: "${text.substring(0, 30)}..."`);
        
        // We use .push() to get the raw audio stream
        const readable = tts.push(text);
        const out = fs.createWriteStream(outputFileName);
        
        return new Promise((resolve, reject) => {
            readable.pipe(out);
            out.on('finish', () => {
                console.log(`✅ Success: ${outputFileName} is ready.`);
                resolve();
            });
            out.on('error', (err) => {
                console.error("❌ Stream Write Error:", err);
                reject(err);
            });
        });
    } catch (error) {
        console.error("❌ TTS Engine Error:", error);
        throw error;
    }
}

// --- MAIN EXECUTION ---
async function runAutoTube() {
    try {
        const script = "If you are hearing this, we have finally conquered the path and crypto errors. The engine is live.";
        const output = "voiceover.mp3";

        console.log("🚀 Starting Engine...");
        await generateAudio(script, output);
        console.log("🎉 All tasks completed!");

    } catch (err) {
        console.error("🚨 Critical Failure:", err);
        process.exit(1);
    }
}

runAutoTube();
