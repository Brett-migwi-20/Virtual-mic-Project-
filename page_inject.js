// page_inject.js
// This file runs in the page context (not the content script isolated world).
(() => {
  if (window.__virtualMicInjected) return;
  window.__virtualMicInjected = true;

  window.__virtualMicStreams__ = window.__virtualMicStreams__ || {};

  // Helper to request a new stream ID from page scripts
  function requestVirtualStream(constraints) {
    return new Promise((resolve, reject) => {
      const id = 'vm_' + Math.random().toString(36).slice(2);
      function handler(e) {
        if (e.source !== window) return;
        const d = e.data;
        if (!d || !d.__virtualMicResponse) return;
        if (d.requestId !== id) return;
        window.removeEventListener('message', handler);
        if (d.success) resolve({ id, stream: window.__virtualMicStreams__[id] });
        else reject(new Error(d.error || 'virtual-mic-failed'));
      }
      window.addEventListener('message', handler);

      // ask the page/content script to prepare the audio stream for this id
      window.postMessage({ __virtualMic: true, action: 'REQUEST_STREAM', requestId: id, constraints }, '*');

      // Note: the content script or extension UI should respond by posting back
      // a message that triggers decode & creation of the stream into window.__virtualMicStreams__[id].
    });
  }

  // Save original
  const origGetUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  // Override getUserMedia
  if (navigator.mediaDevices && origGetUserMedia) {
    navigator.mediaDevices.getUserMedia = function(constraints) {
      const wantsAudio = constraints && (constraints.audio === true || typeof constraints.audio === 'object');
      // If an extension-set flag is present, handle
      if (wantsAudio && window.__virtualMicEnabled) {
        // Return a stream prepared by the extension/page flow
        return requestVirtualStream(constraints).then(({stream}) => stream);
      }
      // otherwise fallback to original behavior
      return origGetUserMedia(constraints);
    };
  }

  // Listen for extension->page messages to load audio and create MediaStream
  window.addEventListener('message', async (ev) => {
    if (ev.source !== window) return;
    const msg = ev.data;
    if (!msg || !msg.__virtualMic) return;

    if (msg.action === 'LOAD_AUDIO') {
      // A message containing audio ArrayBuffer: place it somewhere ready to be used
      // The extension may forward this to the page when a REQUEST_STREAM occurs.
      // For simplicity, store the raw buffer and options
      window.__virtualMicPendingAudio = msg.payload;
      // optionally notify UI
      window.postMessage({ __virtualMicResponse: true, ok: true });
    }

    if (msg.action === 'REQUEST_STREAM') {
      const requestId = msg.requestId;
      // Build stream using pending audio (or send error)
      try {
        const payload = window.__virtualMicPendingAudio;
        if (!payload || !payload.audioBuffer) {
          window.postMessage({ __virtualMicResponse: true, requestId, success: false, error: 'no-audio-loaded' });
          return;
        }
        const audioBuffer = payload.audioBuffer; // structured clone ArrayBuffer
        const loop = payload.loop;
        const volume = payload.volume ?? 1.0;

        const ac = new AudioContext();
        // decodeAudioData expects an ArrayBuffer
        const decoded = await ac.decodeAudioData(audioBuffer.slice(0)); // copy safe
        const src = ac.createBufferSource();
        src.buffer = decoded;
        src.loop = !!loop;

        const gain = ac.createGain();
        gain.gain.value = volume;

        const dest = ac.createMediaStreamDestination();
        src.connect(gain).connect(dest);
        src.start(0);

        // store stream on window keyed by the requestId (the getUserMedia override will resolve to this)
        window.__virtualMicStreams__[requestId] = dest.stream;

        // reply success
        window.postMessage({ __virtualMicResponse: true, requestId, success: true });

        // Optionally, stop the source when stream tracks are ended
        dest.stream.getTracks().forEach(t => {
          t.onended = () => {
            try { src.stop(); } catch(e) {}
            try { ac.close(); } catch(e) {}
            delete window.__virtualMicStreams__[requestId];
          };
        });
      } catch (err) {
        window.postMessage({ __virtualMicResponse: true, requestId, success: false, error: err.message });
      }
    }
  });

  // Allow toggling virtual mic on/off (UI can set this flag)
  window.__enableVirtualMic = (enable) => {
    window.__virtualMicEnabled = !!enable;
  };
})();
