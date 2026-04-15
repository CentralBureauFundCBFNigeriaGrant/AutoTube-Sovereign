const fs = require('fs');
const gTTS = require('gtts');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function generateAIContent() {
    const activeNiche = process.env.INPUT_NICHE || "How to Go Viral on YouTube";
    const channelHandle = "@RichDaddyYo";

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are a viral YouTube strategist for @RichDaddyYo. Write aggressive, high-energy, and motivating scripts. NO stage directions, just spoken text." },
                { role: "user", content: `Write a 60-second YouTube Short script about ${activeNiche}. Mentions ${channelHandle}. Exactly 150 words.` }
            ],
            model: "llama-3.1-8b-instant",
        });

        const scriptText = chatCompletion.choices[0]?.message?.content || "";

        // IMPORTANT: We save the scriptText here so video-engine.js can find it!
        const metadata = {
            title: `${activeNiche.toUpperCase()} SECRET`,
            description: `Mastering ${activeNiche} with ${channelHandle}. #Shorts #RichDaddyYo`,
            tags: [activeNiche.replace(/\s+/g, ''), "RichDaddyYo", "Viral"],
            duration: 60,
            fullScript: scriptText // The video engine will look for this
        };

        fs.writeFileSync('metadata.json', JSON.stringify(metadata, null, 2));

        const gtts = new gTTS(scriptText, 'en');
        return new Promise((resolve, reject) => {
            gtts.save('voiceover.mp3', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } catch (error) {
        process.exit(1);
    }
}
generateAIContent();
