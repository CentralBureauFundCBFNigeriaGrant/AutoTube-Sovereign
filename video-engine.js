const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');

// 1. CONFIGURATION
const PIXABAY_KEY = process.env.PIXABAY_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;

/**
 * FETCH DYNAMIC VIDEO FROM PIXABAY
 */
async function getPixabayVideo(query) {
    console.log(`Searching Pixabay for: ${query}...`);
    try {
        const url = `https://pixabay.com/api/videos/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&video_type=film&orientation=vertical`;
        const response = await axios.get(url);
        
        if (response.data.hits.length > 0) {
            // Pick a random video from the top 5 results for variety
            const randomIndex = Math.floor(Math.random() * Math.min(5, response.data.hits.length));
            const videoUrl = response.data.hits[randomIndex].videos.medium.url;
            return videoUrl;
        }
        // Fallback to a generic 'business' video if no results
        return "https://pixabay.com/get/video/generic_fallback.mp4"; 
    } catch (error) {
        console.error("Pixabay Error:", error);
    }
}

/**
 * GENERATE NIGERIAN MALE VOICE (Google TTS Example)
 */
async function generateSpeech(text) {
    console.log("Generating Nigerian Male Voiceover...");
    // Update your TTS request body here:
    // Language: 'en-NG', Voice: 'en-NG-Wavenet-B' (Male) or 'en-NG-Standard-B'
    const ttsData = {
        input: { text: text },
        voice: { languageCode: 'en-NG', name: 'en-NG-Wavenet-B' }, 
        audioConfig: { audioEncoding: 'MP3', pitch: 0, speakingRate: 1.05 }
    };
    // ... (Your existing TTS API call logic here)
}

/**
 * THE MAIN ENGINE
 */
async function runAutoTube() {
    // STEP 1: Generate Script & Keywords via Groq (Llama 3.1)
    // We ask Llama for the script + 3 keywords for background videos
    const prompt = "Write a 50-second viral YouTube Short script about making money with AI. Also provide 3 keywords for background videos.";
    const scriptData = await callGroq(prompt); 

    // STEP 2: Fetch Video Clips
    const videoUrl = await getPixabayVideo(scriptData.keywords[0]);
    execSync(`curl -o background.mp4 "${videoUrl}"`);

    // STEP 3: Generate Voiceover
    await generateSpeech(scriptData.content);

    // STEP 4: FFMPEG - THE HORMOZI STYLE
    // We use uppercase bold fonts and yellow/white colors
    console.log("Encoding video with Hormozi-style captions...");
    const ffmpegCmd = `
        ffmpeg -i background.mp4 -i voiceover.mp3 \
        -vf "drawtext=text='${scriptData.headline.toUpperCase()}':fontcolor=yellow:fontsize=72:fontfile=Arial_Bold.ttf:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,3)',
             subtitles=subs.srt:force_style='Alignment=10,Fontname=Impact,FontSize=24,PrimaryColour=&H00FFFF,OutlineColour=&H000000,BorderStyle=3'" \
        -c:v libx264 -c:a aac -shortest output.mp4
    `;
    
    // Note: The 'Alignment=10' in force_style puts text in the middle.
    // 'Fontname=Impact' gives that thick Hormozi look.
    
    execSync(ffmpegCmd);
    console.log("Video Ready for Upload!");
}

runAutoTube();
