const { MsEdgeTTS } = require('msedge-tts');
const fs = require('fs');

/**
 * Generates audio from text using Microsoft Edge's free TTS engine.
 */
async function generateAudio(text, outputFileName) {
    const tts = new MsEdgeTTS();
    
    // Voice: en-US-GuyNeural (Male)
    await tts.setMetadata("en-US-GuyNeural", "audio-24khz-48kbitrate-mono-mp3");

    try {
        console.log(`Generating audio: "${text.substring(0, 30)}..."`);
        
        // This method saves the file directly
        await tts.toFile(outputFileName, text);
        
        console.log(`✅ Success: ${outputFileName} created.`);
        return true;
    } catch (error) {
        console.error("❌ Edge-TTS Error:", error);
        throw error;
    }
}

// --- MAIN ENGINE ---
async function runAutoTube() {
    try {
        const script = "Checking the connection. If you hear this, the automation is finally working without the billing error.";
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

