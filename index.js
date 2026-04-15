// --- 1. THE CRYPTO ENGINE FIX ---
const { webcrypto } = require('node:crypto');
if (!global.crypto) {
    global.crypto = webcrypto;
}

// --- 2. THE TTS ENGINE ---
const { MsEdgeTTS } = require('msedge-tts');
const fs = require('fs');

/**
 * Generates audio by extracting the specific audioStream from the result object.
 */
async function generateAudio(text, outputFileName) {
    const tts = new MsEdgeTTS();
    
    // Voice: en-US-GuyNeural is the standard reliable male voice
    await tts.setMetadata("en-US-GuyNeural", "audio-24khz-48kbitrate-mono-mp3");

    try {
        console.log(`Generating audio for: "${text.substring(0, 30)}..."`);
        
        // FIX: toStream returns { audioStream, metadataStream }. We need the audioStream.
        const result = await tts.toStream(text);
        const audioStream = result.audioStream;

        if (!audioStream) {
            throw new Error("Audio stream could not be initialized.");
        }

        const out = fs.createWriteStream(outputFileName);
        
        return new Promise((resolve, reject) => {
            audioStream.pipe(out);
            
            out.on('finish', () => {
                console.log(`✅ Success: ${outputFileName} generated!`);
                resolve();
            });
            
            out.on('error', (err) => {
                console.error("❌ Stream Write Error:", err);
                reject(err);
            });
        });
    } catch (error) {
        console.error("❌ Engine Runtime Error:", error);
        throw error;
    }
}

// --- 3. MAIN EXECUTION ---
async function runAutoTube() {
    try {
        const script = "Live and direct! The engine is finally bypassing all errors. Ready for YouTube automation.";
        const output = "voiceover.mp3";

        console.log("🚀 Starting AutoTube Engine...");
        await generateAudio(script, output);
        console.log("🎉 MISSION COMPLETE: Check your files for voiceover.mp3");

    } catch (err) {
        console.error("🚨 Critical Failure:", err);
        process.exit(1);
    }
}

runAutoTube();

