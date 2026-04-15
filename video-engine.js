const fs = require('fs');
const https = require('https');
const ffmpeg = require('fluent-ffmpeg');

/**
 * 1. AI VISUAL GENERATOR
 */
async function generateAIImage(prompt, dest) {
    return new Promise((resolve, reject) => {
        const encodedPrompt = encodeURIComponent(prompt + ", ultra-realistic, cinematic 8k, highly detailed, masterwork, 16:9 aspect ratio");
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1920&height=1080&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

        console.log(`🤖 AI is imagining: ${prompt}...`);
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) return reject(new Error(`AI Error: ${response.statusCode}`));
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`📸 AI Visual Ready.`);
                resolve();
            });
        }).on('error', (err) => reject(err));
    });
}

/**
 * 2. THE MOTION COMPOSER (Ken Burns Effect)
 */
async function createVideo(imagePath, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log("🎬 FFmpeg: Injecting Motion Engine...");

        ffmpeg()
            .input(imagePath)
            .loop() 
            .input(audioPath)
            .outputOptions([
                '-c:v libx264',
                '-preset ultrafast',
                '-tune stillimage',
                // --- KEN BURNS ZOOM FILTER ---
                // This zooms from 100% to 110% over the duration of the video
                '-vf zoompan=z=\'min(zoom+0.0005,1.1)\':d=1:x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':s=1920x1080',
                '-c:a aac',
                '-b:a 192k',
                '-pix_fmt yuv420p',
                '-shortest'
            ])
            .on('end', () => {
                console.log(`✅ Motion Video Created: ${outputPath}`);
                resolve();
            })
            .on('error', (err) => {
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
    
    // Customize your niche here
    const visualPrompt = "A luxury high-tech office overlooking a cyberpunk city at night, realistic textures, volumetric lighting";

    try {
        if (!fs.existsSync(audioInput)) throw new Error("Audio missing!");

        console.log("🚀 STEP 1: AI Content Gen...");
        await generateAIImage(visualPrompt, imageInput);
        
        console.log("🎞️ STEP 2: Applying Motion & Assembly...");
        await createVideo(imageInput, audioInput, videoOutput);
        
        console.log("🎉 SUCCESS: Your automated video now has motion.");
    } catch (err) {
        console.error("🚨 Failed:", err.message);
        process.exit(1);
    }
}

startVideoPhase();

