mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));

const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

const wsUri = "wss://www.fathomapp.xyz";
// const wsUri = "ws://127.0.0.1";

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let dataChannel = null;
let roomDialog = null;
let languageDialog = null;
let selectedLanguage;
let roomId = null;
let websocket = null;
let mediaRecorder = null;
let translating = true;
let muted = false;
let playback = true;
let urlParams = new URLSearchParams(window.location.search);
let pendingRoomId = null;
let inviteLink = null;

function init() {
  document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
  document.querySelector('#hangupBtn').addEventListener('click', hangUp);
  document.querySelector('#createBtn').addEventListener('click', createRoom);
  document.querySelector('#joinBtn').addEventListener('click', joinRoom);
  document.querySelector('#videoBtn').addEventListener('click', toggleVideo);
  document.querySelector('#muteBtn').addEventListener('click', toggleMute);
  document.querySelector('#translateBtn').addEventListener('click', toggleTranslation);
  document.querySelector('#playbackBtn').addEventListener('click', togglePlayback);
  document.querySelector('#inviteBtn').addEventListener('click', () => invite(inviteLink));
  roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));
  languageDialog = new mdc.dialog.MDCDialog(document.querySelector('#lang-dialog'));

  languageDialog.open();
  makeDraggable();
  const selectLangButton = document.getElementById('select-lang-button');
  selectLangButton.addEventListener('click', function () {
    const radios = document.querySelectorAll('input[name="test-dialog-baseline-confirmation-radio-group"]');
    radios.forEach(radio => {
      if (radio.checked) {
        const label = document.querySelector(`label[for="${radio.id}"]`);
        selectedLanguage = label.textContent;
      }
    });
    console.log(selectedLanguage);
  });

  const roomIdFromUrl = urlParams.get('room');
  if (roomIdFromUrl) {
    pendingRoomId = roomIdFromUrl;
    if (localStream) {
      joinRoomById(roomIdFromUrl);
    }
  }
}

async function createRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;
  document.querySelector('#translateBtn').disabled = false;
  document.querySelector('#playbackBtn').disabled = false;
  document.querySelector('#hangupBtn').disabled = false;

  const db = firebase.firestore();
  const roomRef = await db.collection('rooms').doc();

  console.log('Create PeerConnection with configuration: ', configuration);
  peerConnection = new RTCPeerConnection(configuration);

  dataChannel = peerConnection.createDataChannel('sendDataChannel');
  registerDataChannelListeners();

  registerPeerConnectionListeners();

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  createWebSockets();
  createMediaRecorder();

  // Code for collecting ICE candidates below
  const callerCandidatesCollection = roomRef.collection('callerCandidates');

  peerConnection.addEventListener('icecandidate', event => {
    if (!event.candidate) {
      console.log('Got final candidate!');
      return;
    }
    console.log('Got candidate: ', event.candidate);
    callerCandidatesCollection.add(event.candidate.toJSON());
  });
  // Code for collecting ICE candidates above

  // Code for creating a room below
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  console.log('Created offer:', offer);

  const roomWithOffer = {
    'offer': {
      type: offer.type,
      sdp: offer.sdp,
    },
  };
  await roomRef.set(roomWithOffer);
  roomId = roomRef.id;
  console.log(`New room created with SDP offer. Room ID: ${roomRef.id}`);
  // Code for creating a room above

  peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track);
      remoteStream.addTrack(track);
    });
  });

  // Listening for remote session description below
  roomRef.onSnapshot(async snapshot => {
    const data = snapshot.data();
    if (!peerConnection.currentRemoteDescription && data && data.answer) {
      console.log('Got remote description: ', data.answer);
      const rtcSessionDescription = new RTCSessionDescription(data.answer);
      await peerConnection.setRemoteDescription(rtcSessionDescription);
    }
  });
  // Listening for remote session description above

  // Listen for remote ICE candidates below
  roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type === 'added') {
        let data = change.doc.data();
        console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
  // Listen for remote ICE candidates above

  inviteLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
  console.log('Invite link: ', inviteLink);

  document.querySelector('#inviteBtn').disabled = false;
}

function joinRoom() {
  document.querySelector('#confirmJoinBtn').
    addEventListener('click', async () => {
      roomId = document.querySelector('#room-id').value;
      console.log('Join room: ', roomId);
      await joinRoomById(roomId);
    }, { once: true });
  roomDialog.open();
}

async function joinRoomById(roomId) {
  if (!localStream) {
    console.log('Please enable camera first');
    document.querySelector('#cameraBtn').click();
    return;
  }

  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;
  document.querySelector('#hangupBtn').disabled = false;

  const db = firebase.firestore();
  const roomRef = db.collection('rooms').doc(`${roomId}`);
  const roomSnapshot = await roomRef.get();
  console.log('Got room:', roomSnapshot.exists);

  if (roomSnapshot.exists) {
    console.log('Create PeerConnection with configuration: ', configuration);
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
    peerConnection.addEventListener('datachannel', event => {
      console.log('Got data channel');
      dataChannel = event.channel;
      dataChannel.send('ping');
      registerDataChannelListeners();
    });
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    createWebSockets();
    createMediaRecorder();

    // Code for collecting ICE candidates below
    const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
    peerConnection.addEventListener('icecandidate', event => {
      if (!event.candidate) {
        console.log('Got final candidate!');
        return;
      }
      console.log('Got candidate: ', event.candidate);
      calleeCandidatesCollection.add(event.candidate.toJSON());
    });
    // Code for collecting ICE candidates above

    peerConnection.addEventListener('track', event => {
      console.log('Got remote track:', event.streams[0]);
      event.streams[0].getTracks().forEach(track => {
        console.log('Add a track to the remoteStream:', track);
        remoteStream.addTrack(track);
      });
    });

    // Code for creating SDP answer below
    const offer = roomSnapshot.data().offer;
    console.log('Got offer:', offer);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    console.log('Created answer:', answer);
    await peerConnection.setLocalDescription(answer);

    const roomWithAnswer = {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    };
    await roomRef.update(roomWithAnswer);
    // Code for creating SDP answer above

    // Listening for remote ICE candidates below
    roomRef.collection('callerCandidates').onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          let data = change.doc.data();
          console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
          await peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
    // Listening for remote ICE candidates above
  }
}

async function openUserMedia(e) {
  const stream = await navigator.mediaDevices.getUserMedia(
    { video: true, audio: true });
  document.querySelector('#localVideo').srcObject = stream;
  localStream = stream;
  remoteStream = new MediaStream();
  document.querySelector('#remoteVideo').srcObject = remoteStream;

  console.log('Stream:', document.querySelector('#localVideo').srcObject);
  document.querySelector('#cameraBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = false;
  document.querySelector('#createBtn').disabled = false;
  document.querySelector('#videoBtn').disabled = false;
  document.querySelector('#muteBtn').disabled = false;

  if (pendingRoomId) {
    await joinRoomById(pendingRoomId);
    pendingRoomId = null;
  }
}

async function hangUp(e) {
  mediaRecorder.stop();

  const tracks = document.querySelector('#localVideo').srcObject.getTracks();
  tracks.forEach(track => {
    track.stop();
  });

  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
  }

  if (peerConnection) {
    peerConnection.close();
  }

  document.querySelector('#localVideo').srcObject = null;
  document.querySelector('#remoteVideo').srcObject = null;
  document.querySelector('#cameraBtn').disabled = false;
  document.querySelector('#joinBtn').disabled = true;
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#videoBtn').disabled = true;
  document.querySelector('#muteBtn').disabled = true;
  document.querySelector('#translateBtn').disabled = true;
  document.querySelector('#playbackBtn').disabled = true;
  document.querySelector('#hangupBtn').disabled = true;
  document.querySelector('#inviteBtn').disabled = true;

  // Delete room on hangup
  if (roomId) {
    const db = firebase.firestore();
    const roomRef = db.collection('rooms').doc(roomId);
    const calleeCandidates = await roomRef.collection('calleeCandidates').get();
    calleeCandidates.forEach(async candidate => {
      await candidate.ref.delete();
    });
    const callerCandidates = await roomRef.collection('callerCandidates').get();
    callerCandidates.forEach(async candidate => {
      await candidate.ref.delete();
    });
    await roomRef.delete();
  }

  // document.location.reload(true);
}

function registerPeerConnectionListeners() {
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
      `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
  });
  peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${peerConnection.connectionState}`);
    if (peerConnection.connectionState == 'disconnected') {
      remoteStream = null;
      document.querySelector('#remoteVideo').srcObject = null;
    }
  });
  peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });
  peerConnection.addEventListener('iceconnectionstatechange ', () => {
    console.log(
      `ICE connection state change: ${peerConnection.iceConnectionState}`);
  });
}

function createWebSockets() {
  websocket = new WebSocket(wsUri);
  websocket.onopen = (e) => {
    console.log("Connected to WebSocket server");
    websocket.send(selectedLanguage);
  };
  websocket.onclose = (e) => {
    console.log("Disconnected from WebSocket server");
  };
  websocket.onmessage = async (e) => {
    console.log("Message received from WebSocket server:", e.data);
    let ab = await e.data.arrayBuffer();
    if (playback) {
      console.log('playing audio back');
      playAudio(ab);
    }
    dataChannel.send(ab);
  };
  websocket.onerror = (e) => {
    console.log("WebSocket error: ", e.data);
  };
}

function createMediaRecorder() {
  let audioTrack = localStream.getAudioTracks()[0];
  const audioOnlyStream = new MediaStream();
  audioOnlyStream.addTrack(audioTrack);
  const recorder = new MediaRecorder(audioOnlyStream);
  recorder.start(1000);
  // console.log("Media recorder state: ", recorder.state);
  recorder.onstart = (e) => console.log('Recorder has started');
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      websocket.send(e.data);
      // console.log('Sent audio data into the ether');
    }
  };
  recorder.onstop = (e) => {
    console.log("Recorder has stopped");
    websocket.close();
    // console.log('Recorder closed websocket')
  };
  recorder.onerror = (e) => {
    console.log("Recorder error: ", e.data);
  };
  mediaRecorder = recorder;
}

function registerDataChannelListeners() {
  dataChannel.addEventListener('open', event => {
    console.log('Data channel is open');
  });
  dataChannel.addEventListener('close', event => {
    console.log('Data channel is closed');
  });
  dataChannel.addEventListener('message', event => {
    console.log('Message received from DataChannel:', event.data);
    playAudio(event.data);
  });
}

function toggleVideo() {
  let button = document.getElementById('videoBtn');
  let icon = button.querySelector('i');
  if (localStream.getVideoTracks()[0].enabled === true) {
    localStream.getVideoTracks()[0].enabled = false;
    button.classList.remove('btn-secondary');
    button.classList.add('btn-light');
    icon.classList.remove('bi-camera-video-fill');
    icon.classList.add('bi-camera-video-off-fill');
  } else {
    localStream.getVideoTracks()[0].enabled = true;
    button.classList.remove('btn-light');
    button.classList.add('btn-secondary');
    icon.classList.remove('bi-camera-video-off-fill');
    icon.classList.add('bi-camera-video-fill');
  }
}

function toggleMute() {
  let button = document.getElementById('muteBtn');
  let icon = button.querySelector('i');
  if (muted) {
    localStream.getAudioTracks()[0].enabled = true;
    if (peerConnection) {
      startTranslation();
      document.querySelector('#translateBtn').disabled = false;
    }
    muted = false;
    button.classList.remove('btn-light');
    button.classList.add('btn-secondary');
    icon.classList.remove('bi-mic-mute-fill');
    icon.classList.add('bi-mic-fill');
    console.log('Unmuted');
  }
  else {
    localStream.getAudioTracks()[0].enabled = false;
    if (peerConnection) {
      if (translating) {
        stopTranslation();
        document.querySelector('#translateBtn').disabled = true;
      }
      else {
        console.log('Muted but translation already inactive');
      }
    }
    muted = true;
    button.classList.remove('btn-secondary');
    button.classList.add('btn-light');
    icon.classList.remove('bi-mic-fill');
    icon.classList.add('bi-mic-mute-fill');
    console.log('Muted');
  }
}

function toggleTranslation() { translating ? stopTranslation() : startTranslation(); }

function stopTranslation() {
  document.querySelector('#playbackBtn').disabled = true;
  mediaRecorder.stop();    // The media recorder is stopped and it closes the websocket on its own 
  translating = false;
  console.log('Translation stopped');
}

function startTranslation() {
  document.querySelector('#playbackBtn').disabled = false;
  createWebSockets();
  createMediaRecorder();
  translating = true;
  console.log('Translation started');
}

function playAudio(data) {
  const blob = new Blob([data], { type: 'audio/mpeg' });
  url = URL.createObjectURL(blob);
  let audio = new Audio(url);
  audio.play();
}

function togglePlayback() {
  playback = !playback;
  // if (playback) {
  //   playback = false;
  // }
  // else {
  //   playback = true;
  // }
}

async function invite(url) {
  try {
    await navigator.share({
      title: 'Join my Fathom room',
      text: 'Click this link to join my video call:',
      url: url
    });
    console.log('Successfully invited');
  } catch (err) {
    // Fallback for desktop or browsers that don't support sharing
    navigator.clipboard.writeText(url);
    // alert('Link copied to clipboard!');
    console.log('Invite failed:', err);
  }
}

function makeDraggable() {
  const localVideo = document.getElementById('localVideo');
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  localVideo.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  // Touch events for mobile
  localVideo.addEventListener('touchstart', dragStart);
  document.addEventListener('touchmove', drag);
  document.addEventListener('touchend', dragEnd);

  function dragStart(e) {
    if (e.type === 'touchstart') {
      initialX = e.touches[0].clientX - xOffset;
      initialY = e.touches[0].clientY - yOffset;
    } else {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
    }

    if (e.target === localVideo) {
      isDragging = true;
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();

      if (e.type === 'touchmove') {
        currentX = e.touches[0].clientX - initialX;
        currentY = e.touches[0].clientY - initialY;
      } else {
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
      }

      xOffset = currentX;
      yOffset = currentY;

      setTranslate(currentX, currentY, localVideo);
    }
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }
}

init();