// virtual-mic-logic.js

(function() {
  'use strict';

  // --- State ---
  const state = {
    audioBuffer: null,
    audioContext: null,
    sourceNode: null,
    gainNode: null,
    destinationNode: null,
    stream: null,
    
    // Playback Control State
    isPlaying: false,
    startTime: 0,      // When the current play started (context time)
    pausedAt: 0,       // How many seconds into the buffer we are
    isVirtualActive: false,
    
    volume: 1.0,
    loop: false
  };

  // --- Logger ---
  function log(msg, type = 'info') {
    const event = new CustomEvent('vm-log', { detail: { msg, type } });
    window.dispatchEvent(event);
  }

  // --- Audio Engine ---
  function initContext() {
    if (!state.audioContext) {
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioContext.state === 'suspended') {
      state.audioContext.resume();
    }
  }

  function createStream() {
    initContext();
    state.destinationNode = state.audioContext.createMediaStreamDestination();
    state.gainNode = state.audioContext.createGain();
    state.gainNode.gain.value = state.volume;
    
    // Connect Gain -> Destination
    state.gainNode.connect(state.destinationNode);
    state.stream = state.destinationNode.stream;
    return state.stream;
  }

  function stopSource() {
    if (state.sourceNode) {
      try {
        state.sourceNode.stop();
        state.sourceNode.disconnect();
      } catch (e) {} // Ignore if already stopped
      state.sourceNode = null;
    }
    state.isPlaying = false;
  }

  // --- Playback Controls (Exposed to UI) ---

  window.VirtualMicAPI = {
    loadAudio: async (base64Data) => {
      try {
        initContext();
        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        
        state.audioBuffer = await state.audioContext.decodeAudioData(bytes.buffer);
        log("Audio loaded successfully.", "success");
        
        // Notify UI duration
        const durationEvent = new CustomEvent('vm-duration', { detail: state.audioBuffer.duration });
        window.dispatchEvent(durationEvent);
        
        return true;
      } catch (e) {
        log("Error decoding audio: " + e.message, "error");
        return false;
      }
    },

    play: () => {
      if (!state.audioBuffer) return;
      stopSource(); // Ensure no overlap
      
      state.sourceNode = state.audioContext.createBufferSource();
      state.sourceNode.buffer = state.audioBuffer;
      state.sourceNode.loop = state.loop;
      
      state.sourceNode.connect(state.gainNode);
      // Also connect to destination (speakers) if you want to hear it, 
      // but for a virtual mic, usually we only want it going to the stream.
      // Uncomment below to hear it yourself (Monitoring):
      // state.gainNode.connect(state.audioContext.destination); 

      state.sourceNode.start(0, state.pausedAt);
      state.startTime = state.audioContext.currentTime - state.pausedAt;
      state.isPlaying = true;
      
      log("Playback started.", "info");
    },

    pause: () => {
      if (state.isPlaying && state.sourceNode) {
        state.sourceNode.stop();
        state.pausedAt = state.audioContext.currentTime - state.startTime;
        state.isPlaying = false;
        log("Playback paused.", "warning");
      }
    },

    stop: () => {
      stopSource();
      state.pausedAt = 0;
      log("Playback stopped.", "warning");
    },

    seek: (percent) => {
      const wasPlaying = state.isPlaying;
      if (wasPlaying) stopSource();
      
      state.pausedAt = percent * state.audioBuffer.duration;
      
      if (wasPlaying) {
         // Restart immediately at new position
         window.VirtualMicAPI.play();
      }
      log(`Seeked to ${Math.round(percent * 100)}%.`, "info");
    },

    setVolume: (val) => {
      state.volume = val;
      if (state.gainNode) state.gainNode.gain.value = val;
    },

    setLoop: (isLoop) => {
      state.loop = isLoop;
      if (state.sourceNode) state.sourceNode.loop = isLoop;
    },

    activateInjection: () => {
      state.isVirtualActive = true;
      createStream();
      log("INJECTION ACTIVE: Physical Mic Blocked.", "success");
      
      const statusEvent = new CustomEvent('vm-status', { detail: true });
      window.dispatchEvent(statusEvent);
    },

    deactivateInjection: () => {
      state.isVirtualActive = false;
      stopSource();
      log("INJECTION STOPPED: Physical Mic Available.", "info");
      
      const statusEvent = new CustomEvent('vm-status', { detail: false });
      window.dispatchEvent(statusEvent);
    },

    getProgress: () => {
      if (!state.isPlaying || !state.audioBuffer) return 0;
      const current = state.audioContext.currentTime - state.startTime;
      return Math.min(current / state.audioBuffer.duration, 1.0);
    }
  };

  // --- getUserMedia Override ---
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices.getUserMedia);
  
  navigator.mediaDevices.getUserMedia = function(constraints) {
    if (state.isVirtualActive && constraints.audio) {
      log("Intercepted getUserMedia request.", "info");
      
      // If audio is paused/stopped, we play it so the site gets audio
      if (!state.isPlaying && state.audioBuffer) {
        window.VirtualMicAPI.play();
      }

      // Return the virtual stream
      return Promise.resolve(state.stream || createStream());
    }
    return originalGetUserMedia(constraints);
  };

})();