// virtual-mic.js

(function() {
  'use strict';

  // State variables
  let audioBuffer = null;
  let audioContext = null;
  let sourceNode = null;
  let destinationNode = null;
  let gainNode = null;
  let isVirtualMicActive = false;
  let stream = null;

  // 1. Override getUserMedia
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices.getUserMedia);

  navigator.mediaDevices.getUserMedia = function(constraints) {
    console.log("[VirtualMic] getUserMedia called", constraints);

    // If virtual mic is active and audio is requested
    if (isVirtualMicActive && constraints.audio && audioBuffer) {
      console.log("[VirtualMic] Intercepting audio request.");
      return createVirtualStream(constraints);
    }

    // Otherwise, proceed normally
    return originalGetUserMedia(constraints);
  };

  // 2. Create the Virtual Media Stream
  async function createVirtualStream(constraints) {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Resume context if suspended (browser policy)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Setup graph: Source -> Gain -> Destination
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.loop = true; // Default to looping for virtual mic

    gainNode = audioContext.createGain();
    // We read volume from storage or keep local state. 
    // For simplicity, default 1.0 here, can be updated via messages.
    gainNode.gain.value = 1.0; 

    destinationNode = audioContext.createMediaStreamDestination();

    sourceNode.connect(gainNode);
    gainNode.connect(destinationNode);

    // Start playing
    sourceNode.start(0);

    // Add audio tracks to stream
    stream = destinationNode.stream;

    // If video was requested, we might need to handle it (usually return empty or prompt real camera)
    // For this example, we only focus on Audio.
    if (constraints.video) {
      const realVideoStream = await originalGetUserMedia({ video: true });
      const videoTracks = realVideoStream.getVideoTracks();
      videoTracks.forEach(track => stream.addTrack(track));
    }

    return Promise.resolve(stream);
  }

  // 3. Handle Messages from Content Script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data.type && event.data.type === "FROM_EXTENSION") {
      handleExtensionMessage(event.data.data);
    }
  });

  function handleExtensionMessage(data) {
    if (data.command === "LOAD_AUDIO") {
      // Convert base64 back to ArrayBuffer
      const base64 = data.audioData; 
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtx.decodeAudioData(bytes.buffer).then((decodedBuffer) => {
        audioBuffer = decodedBuffer;
        console.log("[VirtualMic] Audio loaded and decoded.");
      }).catch(e => console.error("[VirtualMic] Decode error", e));
    }

    if (data.command === "START_INJECTION") {
      isVirtualMicActive = true;
      console.log("[VirtualMic] Injection Activated");
    }

    if (data.command === "STOP_INJECTION") {
      isVirtualMicActive = false;
      if (sourceNode) {
        try { sourceNode.stop(); } catch(e){}
      }
      console.log("[VirtualMic] Injection Stopped");
    }
    
    if (data.command === "SET_VOLUME") {
      if (gainNode) {
        gainNode.gain.value = data.volume;
      }
    }
  }

})();