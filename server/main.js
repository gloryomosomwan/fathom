const WebSocket = require('ws');

const http = require('http');
const https = require('https');
const fs = require('fs');

const speech = require('@google-cloud/speech');
const client = new speech.SpeechClient();
const translate = require('./translate.js');
const synthesize = require('./synthesize.js');

// const server = https.createServer({
//   cert: fs.readFileSync('fullchain.pem'),
//   key: fs.readFileSync('privkey.pem')
// });
const server = http.createServer({});

const wss = new WebSocket.Server({ server });
wss.on('connection', function connection(ws) {
  console.log('WebSocket connected');
  let recognizeStream = null;
  let synthesisLanguageCode = null;
  let target = null;

  const request = {
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 16000,
      languageCode: '',
      model: 'telephony'
    }
  };

  const speechCallback = async (stream) => {
    if (stream.results[0] && stream.results[0].alternatives[0] && (stream.results[0].alternatives[0].transcript != "")) {
      result = stream.results[0].alternatives[0].transcript;

      console.log('Transcription:', result);
      let translation = await translate(result, target);

      console.log('Translation:', translation);
      let speech = await synthesize(translation, synthesisLanguageCode);

      const speechBlob = Buffer.from(speech, 'binary');
      ws.send(speechBlob);
    }
    else {
      console.log("Unidentified output");
      // console.log("Unidentified output:", data);
    }
  };

  function startRecognizeStream() {
    console.log('streaming started...');
    let recognizeStream = client
      .streamingRecognize(request)
      .on('error', console.error)
      .on('data', speechCallback)
      .on('close', () => console.log('Closed recognizeStream'));
    return recognizeStream;
  }

  ws.on('message', function incoming(data) {
    if (data.toString() == 'Portuguese') {
      // we speak portuguese but want to output english
      request.config.languageCode = 'pt-BR';
      target = 'en';
      synthesisLanguageCode = 'en-US';
      console.log('recognizing portuguese, speaking english...');
      recognizeStream = startRecognizeStream();
    }
    else if (data.toString() == 'English') {
      request.config.languageCode = 'en-US';
      target = 'pt';
      synthesisLanguageCode = 'pt-BR';
      console.log('recognizing english, speaking portuguese...');
      recognizeStream = startRecognizeStream();
    }
    else {
      // console.log('writing to stream');
      recognizeStream.write(data);
    }
  });
  ws.onclose = (e) => {
    console.log("Disconnected");
  };
});

wss.on('close', () => {
  console.log('WebSocket Server closed');
});

// server.listen(443);
server.listen(80);