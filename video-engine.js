const fs = require('fs');
const https = require('https');
const ffmpeg = require('fluent-ffmpeg');

// --- 1. ROBUST IMAGE DOWNLOADER ---
async function downloadTestImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            // Check if we actually got a 'Success' code (200)
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download image: Status ${response.statusCode}`));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`📸 Image downloaded successfully (${fs.statSync(dest).size} bytes)`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

// --- 2. VIDEO COMPOSER ---
async function createVideo(imagePath, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log("🎬 FFmpeg: Starting render...");

        ffmpeg()
            .input(imagePath)
            .loop() 
            .input(audioPath)
            // Added flags to force FFmpeg to handle weird image sizes
            .outputOptions([
                '-c:v libx264',
                '-preset ultrafast', // Faster rendering for testing
                '-tune stillimage',
                '-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2', // Ensures perfect 1080p
                '-c:a aac',
                '-b:a 192k',
                '-pix_fmt yuv420p',
                '-shortest'
            ])
            .on('end', () => {
                console.log(`✅ Video Ready: ${outputPath}`);
                resolve();
            })
            .on('error', (err, stdout, stderr) => {
                console.error("❌ FFmpeg Error:", err.message);
                console.error("FFmpeg StdErr:", stderr); // This will show us EXACTLY why it failed
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
        // Verification Step: Does the audio from index.js actually exist?
        if (!fs.existsSync(audioInput)) {
            throw new Error(`CRITICAL: ${audioInput} not found! Did the Audio Engine fail?`);
        }

        console.log("🖼️ Step 1: Fetching Reliable Visual...");
        // Using a more direct source for the image
        await downloadTestImage("https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80", imageInput);
        
        console.log("🎞️ Step 2: Assembling Video...");
        await createVideo(imageInput, audioInput, videoOutput);
        
        console.log("🎉 MISSION COMPLETE: Video engine finished successfully.");
    } catch (err) {
        console.error("🚨 Video Phase Failed:", err.message);
        process.exit(1);
    }
}

startVideoPhase();
