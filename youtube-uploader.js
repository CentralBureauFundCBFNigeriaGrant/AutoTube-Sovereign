const fs = require('fs');
const { google } = require('googleapis');

// Using the exact environment variable names from your workflow/secrets
const oauth2Client = new google.auth.OAuth2(
    process.env.YT_CLIENT_ID,
    process.env.YT_CLIENT_SECRET
);

oauth2Client.setCredentials({ refresh_token: process.env.YT_REFRESH_TOKEN });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

async function upload() {
    if (!fs.existsSync('metadata.json')) throw new Error("metadata.json not found!");
    if (!fs.existsSync('final_video.mp4')) throw new Error("final_video.mp4 not found!");

    const metadata = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));

    console.log("📤 Starting YouTube Upload...");
    const res = await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: {
                title: metadata.title,
                description: metadata.description,
                tags: metadata.tags,
                categoryId: '28' // Tech & Science
            },
            status: { privacyStatus: 'public' }
        },
        media: { body: fs.createReadStream('final_video.mp4') }
    });

    console.log(`✅ SUCCESS! Video is live: https://youtu.be/${res.data.id}`);

    // Optional: Set thumbnail using the generated AI visual
    if (fs.existsSync('ai_visual.jpg')) {
        console.log("🖼️ Setting Thumbnail...");
        await youtube.thumbnails.set({
            videoId: res.data.id,
            media: { body: fs.createReadStream('ai_visual.jpg') }
        });
        console.log("✅ Thumbnail updated.");
    }
}

upload().catch(err => {
    console.error("🚨 Upload Failed:", err.message);
    process.exit(1);
});

