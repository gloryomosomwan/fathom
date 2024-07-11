async function init() {
  try {
    const websocket = createWebSockets();

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const videoElement = document.getElementById("video");
    videoElement.srcObject = stream;

    let audioTrack = stream.getAudioTracks()[0];
    console.log(audioTrack);
    const audioOnlyStream = new MediaStream();
    audioOnlyStream.addTrack(audioTrack);

    createMediaRecorder(audioOnlyStream, websocket);

    const button = document.getElementById("stopPlayback");
    button.onclick = (e) => {
      websocket.close();

      let videoTrack = stream.getVideoTracks()[0];
      let audioTrack = stream.getAudioTracks()[0];
      stream.removeTrack(videoTrack);
      stream.removeTrack(audioTrack);

      let audioOnlyAudioTrack = audioOnlyStream.getAudioTracks()[0];
      audioOnlyStream.removeTrack(audioOnlyAudioTrack);
    };
  }
  catch (error) {
    console.log("Initialization error: ", error);
  }
}

function createWebSockets() {
  // const wsUri = "ws://35.184.118.175";
  const wsUri = "ws://127.0.0.1";
  const websocket = new WebSocket(wsUri);

  websocket.onopen = (e) => {
    console.log("Connected");
  };

  websocket.onclose = (e) => {
    console.log("Disconnected");
  };

  websocket.onmessage = (e) => {
    console.log("Message received:", e.data);

    const ab = e.data;
    const blbo = new Blob([ab], { type: 'audio/mpeg' });

    speechURL = URL.createObjectURL(blbo);
    // audioElement = document.getElementById('audio');
    // audioElement.src = speechURL;
    let audio = new Audio(speechURL);
    // audio.src = speechURL;
    audio.play();
  };

  websocket.onerror = (e) => {
    console.log("WebSocket error: ", e.data);
  };
  return websocket;
}

function createMediaRecorder(stream, websocket) {
  const recorder = new MediaRecorder(stream);
  recorder.start(1000);
  console.log("Media recorder state: ", recorder.state);
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      // console.log("Data sent: ", e.data);
      websocket.send(e.data);
    }
  };
  recorder.onstop = (e) => {
    console.log("Recorder has stopped");
  };
  recorder.onerror = (e) => {
    console.log("Recorder error: ", e.data);
  };
}

init();