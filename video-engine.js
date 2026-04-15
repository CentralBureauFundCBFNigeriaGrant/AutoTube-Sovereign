const fs = require('fs');
const https = require('https');
const ffmpeg = require('fluent-ffmpeg');

/**
 * 1. AI VISUAL GENERATOR
 * Uses Pollinations.ai (Flux/SDXL) to generate a custom 1080p image.
 */
async function generateAIImage(prompt, dest) {
    return new Promise((resolve, reject) => {
        // Encode the prompt for URL safety
        const encodedPrompt = encodeURIComponent(prompt + ", ultra-realistic, cinematic 8k, highly detailed, professional lighting");
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1920&height=1080&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

        console.log(`🤖 AI is "imagining" your visual: ${prompt}...`);
        
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`AI Generation Failed: Status ${response.statusCode}`));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`📸 AI Visual Ready: (${fs.statSync(dest).size} bytes)`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

/**
 * 2. VIDEO COMPOSER
 * Marries the AI image with the Audio Engine's voiceover.
 */
async function createVideo(imagePath, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log("🎬 FFmpeg: Starting professional render...");

        ffmpeg()
            .input(imagePath)
            .loop() 
            .input(audioPath)
            .outputOptions([
                '-c:v libx264',
                '-preset medium',
                '-tune stillimage',
                // Ensures perfect 1080p YouTube aspect ratio
                '-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
                '-c:a aac',
                '-b:a 192k',
                '-pix_fmt yuv420p',
                '-shortest'
            ])
            .on('end', () => {
                console.log(`✅ AutoTube Video Created: ${outputPath}`);
                resolve();
            })
            .on('error', (err, stdout, stderr) => {
                console.error("❌ Rendering Error:", err.message);
                reject(err);
            })
            .save(outputPath);
    });
}

/**
 * 3. THE ORCHESTRATOR
 */
async function startVideoPhase() {
    const audioInput = "voiceover.mp3";
    const imageInput = "ai_visual.jpg";
    const videoOutput = "final_video.mp4";

    // CHANGE THIS: This is the prompt the AI will use to generate your image
    const visualPrompt = "A futuristic workspace for a software entrepreneur with holographic AI screens, cinematic warm lighting, professional atmosphere";

    try {
        // Safety Check: Ensure Audio Engine finished first
        if (!fs.existsSync(audioInput)) {
            throw new Error(`CRITICAL: Audio file (${audioInput}) missing. Run Audio Engine first.`);
        }

        console.log("🚀 STEP 1: Requesting AI Content...");
        await generateAIImage(visualPrompt, imageInput);
        
        console.log("🎞️ STEP 2: Building Final Video...");
        await createVideo(imageInput, audioInput, videoOutput);
        
        console.log("🎉 SUCCESS: AutoTube Engine has produced a live AI video.");
    } catch (err) {
        console.error("🚨 Video Phase Failed:", err.message);
        process.exit(1);
    }
}

startVideoPhase();
