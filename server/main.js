const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const fs = require('fs');
const speech = require('@google-cloud/speech');
const client = new speech.SpeechClient();
const translate = require('./translate.js');
const synthesize = require('./synthesize.js');
let recognizeStream = null;

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
  ws.on('message', function incoming(data) {
    if (data.toString() == 'english') {
      console.log('english!');
      startRecognizeStream(ws);
    }
    else {
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

function startRecognizeStream(socket) {
  let activeTimer = false;
  let buffer = "";
  let timer = null;
  console.log('streaming started...');
  recognizeStream = client
    .streamingRecognize(request)
    .on('error', console.error)
    .on('close', () => console.log('Closed recognizeStream'))
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
            socket.send(speechBlob);
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
}

// server.listen(443);
server.listen(80);