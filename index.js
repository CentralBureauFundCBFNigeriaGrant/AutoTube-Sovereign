const { MsEdgeTTS } = require('ms-edge-tts');
const fs = require('fs');

/**
 * Generates audio from text using Microsoft Edge's free TTS engine.
 * No API Key or Billing required.
 */
async function generateAudio(text, outputFileName) {
    const tts = new MsEdgeTTS();
    
    // Voice: en-US-GuyNeural (Male) or en-US-AvaNeural (Female)
    await tts.setMetadata("en-US-GuyNeural", "audio-24khz-48kbitrate-mono-mp3");

    try {
        console.log(`Starting audio generation for: "${text.substring(0, 30)}..."`);
        
        const readable = tts.push(text);
        const out = fs.createWriteStream(outputFileName);
        
        readable.pipe(out);

        return new Promise((resolve, reject) => {
            out.on('finish', () => {
                console.log(`✅ Success: Audio saved to ${outputFileName}`);
                resolve();
            });
            out.on('error', (err) => {
                console.error("❌ Stream Error:", err);
                reject(err);
            });
        });
    } catch (error) {
        console.error("❌ Edge-TTS Runtime Error:", error);
        throw error;
    }
}

// --- MAIN ENGINE START ---
async function runAutoTube() {
    try {
        const script = "Hello! This is a test of the new free text to speech engine for our YouTube automation.";
        const output = "voiceover.mp3";

        console.log("🚀 Initializing AutoTube Engine...");
        await generateAudio(script, output);
        console.log("🎉 Process Complete!");

    } catch (err) {
        console.error("🚨 Critical Failure:", err);
        process.exit(1);
    }
}

runAutoTube();

