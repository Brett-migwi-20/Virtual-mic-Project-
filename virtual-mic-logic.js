// virtual-mic-logic.js

(function() {
  'use strict';

  const state = {
    audioBuffer: null,
    audioContext: null,
    sourceNode: null,
    gainNode: null,
    destinationNode: null,
    stream: null,
    
    // Playback Control State
    isPlaying: false,
    startTime: 0,
    pausedAt: 0,
    isVirtualActive: false,
    
    volume: 1.0,
    loop: false,
    
    // Folder/Library State
    folderHandles: [], // Stores lightweight FileSystemHandle objects
    currentHandle: null
  };

  function log(msg, type = 'info') {
    const event = new CustomEvent('vm-log', { detail: { msg, type } });
    window.dispatchEvent(event);
  }

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
    state.gainNode.connect(state.destinationNode);
    state.stream = state.destinationNode.stream;
    return state.stream;
  }

  function stopSource() {
    if (state.sourceNode) {
      try { state.sourceNode.stop(); state.sourceNode.disconnect(); } catch (e) {}
      state.sourceNode = null;
    }
    state.isPlaying = false;
  }

  // --- Public API ---

  window.VirtualMicAPI = {
    
    // 1. FOLDER MANAGEMENT
    openFolder: async () => {
      try {
        // Request folder access
        const dirHandle = await window.showDirectoryPicker();
        state.folderHandles = [];
        let count = 0;
        
        // Iterate through folder to get names (Fast)
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
            const name = entry.name.toLowerCase();
            // Filter for audio types
            if (name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg') || name.endsWith('.m4a')) {
              state.folderHandles.push(entry);
              count++;
            }
          }
        }
        
        log(`Folder loaded: ${count} recordings found.`, 'success');
        
        // Send list to UI
        const listEvent = new CustomEvent('vm-folder-loaded', { detail: {
          count: count,
          handles: state.folderHandles.map(h => h.name) // Send only names for display
        }});
        window.dispatchEvent(listEvent);
        
        return true;
      } catch (err) {
        if (err.name !== 'AbortError') {
          log("Error opening folder: " + err.message, 'error');
        }
        return false;
      }
    },

    // 2. AUDIO LOADING (Lazy Load)
    loadByHandle: async (fileName) => {
      try {
        initContext();
        // Find the handle by name (fast lookup)
        const handle = state.folderHandles.find(h => h.name === fileName);
        if (!handle) {
          log("File handle not found.", 'error');
          return false;
        }

        // UI Feedback: Loading
        const loadingEvent = new CustomEvent('vm-loading');
        window.dispatchEvent(loadingEvent);

        // Load file data from disk (Slow, only happens now)
        const file = await handle.getFile();
        const arrayBuffer = await file.arrayBuffer();
        
        // Decode
        const decodedBuffer = await state.audioContext.decodeAudioData(arrayBuffer);
        state.audioBuffer = decodedBuffer;
        state.currentHandle = fileName;
        state.pausedAt = 0;
        
        log(`Loaded: ${fileName}`, 'success');
        
        // Notify UI duration and success
        const durationEvent = new CustomEvent('vm-duration', { detail: state.audioBuffer.duration });
        window.dispatchEvent(durationEvent);
        
        const doneEvent = new CustomEvent('vm-loading-done', { detail: fileName });
        window.dispatchEvent(doneEvent);

        return true;
      } catch (e) {
        log("Error loading audio: " + e.message, 'error');
        const failEvent = new CustomEvent('vm-loading-fail');
        window.dispatchEvent(failEvent);
        return false;
      }
    },

    // 3. PLAYBACK CONTROLS
    play: () => {
      if (!state.audioBuffer) return;
      stopSource();
      
      state.sourceNode = state.audioContext.createBufferSource();
      state.sourceNode.buffer = state.audioBuffer;
      state.sourceNode.loop = state.loop;
      state.sourceNode.connect(state.gainNode);
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
      if (wasPlaying) window.VirtualMicAPI.play();
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
      log("INJECTION ACTIVE.", "success");
      const statusEvent = new CustomEvent('vm-status', { detail: true });
      window.dispatchEvent(statusEvent);
    },

    deactivateInjection: () => {
      state.isVirtualActive = false;
      stopSource();
      log("INJECTION STOPPED.", "info");
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
      log("Intercepted getUserMedia.", "info");
      if (!state.isPlaying && state.audioBuffer) window.VirtualMicAPI.play();
      return Promise.resolve(state.stream || createStream());
    }
    return originalGetUserMedia(constraints);
  };

})();