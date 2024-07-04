const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 80 });
const speech = require('@google-cloud/speech');
const client = new speech.SpeechClient();
const { translateText } = require('./translate');

const request = {
  config: {
    encoding: 'WEBM_OPUS',
    sampleRateHertz: 16000,
    languageCode: 'en-US',
  }
};

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
        // buffer = buffer + result + " ";
        buffer = buffer + result;
        if (!activeTimer) {
          activeTimer = true;
          timer = setTimeout(async () => {
            // console.log(buffer);
            translation = await translateText(buffer);
            console.log(translation);

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
      }
    });

  ws.on('message', function incoming(data) {
    recognizeStream.write(data);
  });

  ws.onclose = (e) => {
    console.log("Disconnected");
  };
});