// --- 1. THE CRYPTO FIX (Solves 'digest' error) ---
const { webcrypto } = require('node:crypto');
if (!global.crypto) {
    global.crypto = webcrypto;
}

const { MsEdgeTTS } = require('msedge-tts');
const fs = require('fs');

/**
 * Generates audio using a stream to ensure the file saves correctly.
 */
async function generateAudio(text, outputFileName) {
    const tts = new MsEdgeTTS();
    
    // Using a clear neural voice
    await tts.setMetadata("en-US-GuyNeural", "audio-24khz-48kbitrate-mono-mp3");

    try {
        console.log(`Generating audio for: "${text.substring(0, 30)}..."`);
        
        // Push the text to get the audio stream
        const readable = tts.push(text);
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
        // Change this text to whatever you want your script to be
        const script = "System check. The audio engine is now fully integrated and bypassing the billing requirements.";
        const output = "voiceover.mp3";

        console.log("🚀 Starting AutoTube...");
        await generateAudio(script, output);
        console.log("🎉 Process Finished Successfully!");

    } catch (err) {
        console.error("🚨 Critical Failure:", err);
        process.exit(1);
    }
}

runAutoTube();

