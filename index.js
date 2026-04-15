const fs = require('fs');
const gTTS = require('gtts');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function generateAIContent() {
    const activeNiche = process.env.INPUT_NICHE || "How to Go Viral on YouTube";
    const channelHandle = "@RichDaddyYo";

    console.log(`🧠 Consulting Llama 3.1 for niche: ${activeNiche}...`);

    try {
        // 1. CALL THE AI FOR A HIGH-ENGAGEMENT SCRIPT
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a viral YouTube strategist. You write aggressive, high-energy, and motivating scripts for YouTube Shorts. Your goal is 100% audience retention."
                },
                {
                    role: "user",
                    content: `Write a 60-second YouTube Short script about ${activeNiche}. 
                    Requirements:
                    - Mention the channel handle ${channelHandle} naturally.
                    - Start with a massive hook that stops the scroll.
                    - Use short, punchy sentences.
                    - Total length: exactly 150 words.
                    - Tone: Wealthy, ambitious, and direct.
                    - Do not include stage directions like (Music fades) or [Host speaks], ONLY output the spoken text.`
                }
            ],
            model: "llama-3.1-8b-instant",
        });

        const scriptText = chatCompletion.choices[0]?.message?.content || "";
        console.log("🔥 AI Script Generated!");

        // 2. GENERATE DYNAMIC METADATA
        // We ask the AI to summarize a title and tags based on its own script
        const metadata = {
            title: `${activeNiche.toUpperCase()} SECRET #Shorts`,
            description: `${scriptText.substring(0, 100)}... \n\nFollow ${channelHandle} for the blueprint. #Wealth #Automation #RichDaddyYo`,
            tags: [activeNiche.replace(/\s+/g, ''), "RichDaddyYo", "Viral", "Algorithm", "Success"],
            duration: 60
        };

        fs.writeFileSync('metadata.json', JSON.stringify(metadata, null, 2));

        // 3. CONVERT AI SCRIPT TO SPEECH
        const gtts = new gTTS(scriptText, 'en');
        return new Promise((resolve, reject) => {
            gtts.save('voiceover.mp3', (err) => {
                if (err) reject(err);
                else {
                    console.log("🎙️ AI Voiceover saved.");
                    resolve();
                }
            });
        });

    } catch (error) {
        console.error("🚨 AI Generation Failed:", error);
        process.exit(1);
    }
}

generateAIContent();

