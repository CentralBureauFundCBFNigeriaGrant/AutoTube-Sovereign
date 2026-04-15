const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');

// This part handles your credentials properly
let clientOptions = {};
try {
    // We check if the secret is a JSON string and parse it
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    clientOptions = { credentials };
    console.log("Credentials parsed successfully from environment variable.");
} catch (e) {
    // If it's not JSON (like a file path), we let the library try its default way
    console.log("Using default credential path or file.");
}

// Initialize the client with our options
const client = new textToSpeech.TextToSpeechClient(clientOptions);

async function quickStart() {
  // The text to synthesize
  const text = 'hello, world!';

  // Construct the request
  const request = {
    input: {text: text},
    // Select the language and SSML voice gender (optional)
    voice: {languageCode: 'en-US', ssmlGender: 'NEUTRAL'},
    // select the type of audio encoding
    audioConfig: {audioEncoding: 'MP3'},
  };

  // Performs the text-to-speech request
  const [response] = await client.synthesizeSpeech(request);
  
  // Write the binary audio content to a local file
  const writeFile = util.promisify(fs.writeFile);
  await writeFile('output.mp3', response.audioContent, 'binary');
  console.log('Audio content written to file: output.mp3');
}

quickStart();

