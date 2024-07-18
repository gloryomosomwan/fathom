const textToSpeech = require('@google-cloud/text-to-speech');
const client = new textToSpeech.TextToSpeechClient();

async function synthesize(text, languageCode) {
  console.log('Language code:', languageCode);
  let name = null;
  if (languageCode == 'pt-BR') {
    name = 'pt-BR-Neural2-A';
  }
  else if (languageCode == 'en-US') {
    name = 'en-US-Neural2-J';
  }
  else {
    console.log('Invalid lang (synthesis)');
  }
  const request = {
    input: { text: text },
    voice: {
      languageCode: languageCode,
      // ssmlGender: 'NEUTRAL',
      name: name
    },
    audioConfig: { audioEncoding: 'MP3' },
  };
  const [response] = await client.synthesizeSpeech(request);
  return response.audioContent;
}

module.exports = synthesize;