// Imports the Google Cloud client library
const textToSpeech = require('@google-cloud/text-to-speech');

// Creates a client
const client = new textToSpeech.TextToSpeechClient();
async function synthesize(text) {
  // const text = 'Hello, my name is John. What is your name?';

  // Construct the request
  const request = {
    input: { text: text },
    // Select the language and SSML voice gender (optional)
    // voice: {languageCode: 'en-US', ssmlGender: 'NEUTRAL'},
    voice: {
      languageCode: 'pt-BR',
      // ssmlGender: 'NEUTRAL',
      name: 'pt-BR-Neural2-A'
    },
    // select the type of audio encoding
    audioConfig: { audioEncoding: 'MP3' },
  };

  // Performs the text-to-speech request
  const [response] = await client.synthesizeSpeech(request);
  return response.audioContent;
}

module.exports = synthesize;