// --- 1. THE CRYPTO POLYFILL ---
const { webcrypto } = require('node:crypto');
if (!global.crypto) {
    global.crypto = webcrypto;
}

const { MsEdgeTTS } = require('msedge-tts');
const fs = require('fs');

/**
 * Generates audio using toStream to handle the library's latest update.
 */
async function generateAudio(text, outputFileName) {
    const tts = new MsEdgeTTS();
    
    // Set voice to Guy (Male)
    await tts.setMetadata("en-US-GuyNeural", "audio-24khz-48kbitrate-mono-mp3");

    try {
        console.log(`Generating audio for: "${text.substring(0, 30)}..."`);
        
        // Using toStream instead of push
        const readable = await tts.toStream(text);
        const out = fs.createWriteStream(outputFileName);
        
        return new Promise((resolve, reject) => {
            readable.pipe(out);
            
            out.on('finish', () => {
                console.log(`✅ Success: ${outputFileName} created.`);
                resolve();
            });
            
            out.on('error', (err) => {
                console.error("❌ Write Error:", err);
                reject(err);
            });
        });
    } catch (error) {
        console.error("❌ Engine Error:", error);
        throw error;
    }
}

// --- 2. MAIN EXECUTION ---
async function runAutoTube() {
    try {
        const script = "Final test of the engine. If this works, the audio system is fully operational.";
        const output = "voiceover.mp3";

        console.log("🚀 Initializing AutoTube Engine...");
        await generateAudio(script, output);
        console.log("🎉 SUCCESS: The engine reached the finish line.");

    } catch (err) {
        console.error("🚨 Critical Failure:", err);
        process.exit(1);
    }
}

runAutoTube();

