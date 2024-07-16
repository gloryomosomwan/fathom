const textToSpeech = require('@google-cloud/text-to-speech');
const client = new textToSpeech.TextToSpeechClient();

async function synthesize(text) {
  const request = {
    input: { text: text },
    voice: {
      languageCode: 'pt-BR',
      // ssmlGender: 'NEUTRAL',
      name: 'pt-BR-Neural2-A'
    },
    audioConfig: { audioEncoding: 'MP3' },
  };
  const [response] = await client.synthesizeSpeech(request);
  return response.audioContent;
}

module.exports = synthesize;