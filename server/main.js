const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const fs = require('fs');
const speech = require('@google-cloud/speech');
const client = new speech.SpeechClient();
const translate = require('./translate.js');
const synthesize = require('./synthesize.js');

const request = {
  config: {
    encoding: 'WEBM_OPUS',
    sampleRateHertz: 16000,
    languageCode: 'en-US',
  }
};

// const server = https.createServer({
//   cert: fs.readFileSync('fullchain.pem'),
//   key: fs.readFileSync('privkey.pem')
// });

const server = http.createServer({});

const wss = new WebSocket.Server({ server });
wss.on('connection', function connection(ws) {
  console.log('WebSocket connected');
  let activeTimer = false;
  let buffer = "";
  let timer = null;
  const recognizeStream = client
    .streamingRecognize(request)
    .on('error', console.error)
    .on('data', data => {
      if (data.results[0] && data.results[0].alternatives[0] && (data.results[0].alternatives[0].transcript != "")) {
        result = data.results[0].alternatives[0].transcript;
        buffer = buffer + result;
        if (!activeTimer) {
          activeTimer = true;
          timer = setTimeout(async () => {
            let translation = await translate(buffer);
            console.log(translation);
            let speech = await synthesize(translation);
            const speechBlob = Buffer.from(speech, 'binary');
            ws.send(speechBlob);
            buffer = "";
            activeTimer = false;
          }, 3000);
        }
        else if (activeTimer) {
          clearTimeout(timer);
          timer = setTimeout(() => {
            console.log(buffer);
            buffer = "";
            activeTimer = false;
          }, 3000);
        }
      }
      else {
        console.log("Unidentified output");
        // console.log("Unidentified output:", data);
      }
    });

  ws.on('message', function incoming(data) {
    recognizeStream.write(data);
  });

  ws.onclose = (e) => {
    console.log("Disconnected");
  };
});
wss.on('close', () => {
  console.log('WebSocket closed (server side)');
});

// server.listen(443);
server.listen(80);