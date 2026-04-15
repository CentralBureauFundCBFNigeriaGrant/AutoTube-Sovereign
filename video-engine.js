const fs = require('fs');
const https = require('https');
const ffmpeg = require('fluent-ffmpeg');

/**
 * THE IMAGE DOWNLOADER
 */
async function downloadTestImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

/**
 * THE VIDEO COMPOSER
 */
async function createVideo(imagePath, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log("🎬 Video Engine: Rendering starting...");
        
        // Check if audio exists before starting
        if (!fs.existsSync(audioPath)) {
            return reject(new Error(`Audio file not found: ${audioPath}`));
        }

        ffmpeg()
            .input(imagePath)
            .loop() 
            .input(audioPath)
            .outputOptions([
                '-c:v libx264',
                '-tune stillimage',
                '-c:a aac',
                '-b:a 192k',
                '-pix_fmt yuv420p',
                '-shortest'
            ])
            .on('end', () => {
                console.log(`✅ Video Engine: ${outputPath} created.`);
                resolve();
            })
            .on('error', (err) => {
                console.error("❌ Video Engine Error:", err);
                reject(err);
            })
            .save(outputPath);
    });
}

// --- EXECUTION ---
async function startVideoPhase() {
    const audioInput = "voiceover.mp3";
    const imageInput = "background.jpg";
    const videoOutput = "final_video.mp4";

    try {
        console.log("🖼️ Step 1: Fetching Visuals...");
        await downloadTestImage("https://picsum.photos/1920/1080", imageInput);
        
        console.log("🎞️ Step 2: Assembling Video...");
        await createVideo(imageInput, audioInput, videoOutput);
        
        console.log("🎉 Video Phase Complete.");
    } catch (err) {
        console.error("🚨 Video Phase Failed:", err);
        process.exit(1);
    }
}

startVideoPhase();
  
