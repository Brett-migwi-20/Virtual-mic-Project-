// virtual-mic-ui.js

(function() {
  'use strict';

  // --- Shadow DOM Container ---
  const container = document.createElement('div');
  container.id = 'virtual-mic-container';
  document.body.appendChild(container);
  
  const shadow = container.attachShadow({ mode: 'open' });

  // --- CSS Styles (Scoped) ---
  const style = document.createElement('style');
  style.textContent = `
    :host {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 320px;
      background: #1e1e24;
      color: #e0e0e0;
      font-family: 'Segoe UI', sans-serif;
      border-radius: 8px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.5);
      z-index: 999999;
      border: 1px solid #444;
      overflow: hidden;
      display: block;
      transition: opacity 0.3s;
    }
    :host([hidden]) { display: none; }
    
    .header {
      background: #2b2b36;
      padding: 10px 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #444;
      cursor: move;
      user-select: none;
    }
    .title { font-weight: bold; font-size: 0.9rem; color: #4a90e2; }
    .close-btn { cursor: pointer; font-size: 1.2rem; color: #aaa; }
    .close-btn:hover { color: #fff; }

    .body { padding: 15px; max-height: 500px; overflow-y: auto; }

    .status-bar {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
      font-size: 0.8rem;
      background: #111;
      padding: 8px;
      border-radius: 4px;
    }
    .status-indicator span { font-weight: bold; }
    .status-active { color: #2ecc71; }
    .status-inactive { color: #e74c3c; }

    .control-row { display: flex; gap: 10px; margin-bottom: 10px; }
    .btn {
      flex: 1;
      padding: 8px;
      background: #3a3a45;
      border: none;
      color: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
    }
    .btn:hover:not(:disabled) { background: #4a4a58; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: #4a90e2; }
    .btn-danger { background: #c0392b; }

    input[type="file"] { font-size: 0.75rem; width: 100%; margin-bottom: 10px; }

    .progress-container {
      height: 6px;
      background: #333;
      border-radius: 3px;
      margin: 10px 0;
      cursor: pointer;
      position: relative;
    }
    .progress-bar {
      height: 100%;
      background: #4a90e2;
      width: 0%;
      border-radius: 3px;
      transition: width 0.1s linear;
    }

    .logs {
      background: #000;
      height: 100px;
      font-family: monospace;
      font-size: 0.7rem;
      padding: 5px;
      overflow-y: auto;
      color: #aaa;
      margin-top: 10px;
      border-radius: 4px;
    }
    .log-entry { margin-bottom: 2px; border-bottom: 1px solid #222; }
    .log-success { color: #2ecc71; }
    .log-error { color: #e74c3c; }
    .log-info { color: #3498db; }
    .log-warn { color: #f1c40f; }

    .settings-row { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 0.8rem; }
    input[type="range"] { flex: 1; margin-left: 10px; }
  `;
  shadow.appendChild(style);

  // --- HTML Structure ---
  const ui = document.createElement('div');
  ui.innerHTML = `
    <div class="header" id="dragHandle">
      <span class="title">🎙️ Virtual Mic Pro</span>
      <span class="close-btn">&times;</span>
    </div>
    <div class="body">
      
      <div class="status-bar">
        <div>Phys Mic: <span class="status-inactive">Blocked</span></div>
        <div>Virt Mic: <span id="virtStatus" class="status-inactive">OFF</span></div>
      </div>

      <input type="file" id="fileInput" accept="audio/*" />
      
      <div class="progress-container" id="progressContainer">
        <div class="progress-bar" id="progressBar"></div>
      </div>

      <div class="control-row">
        <button id="btnPlayPause" class="btn btn-primary" disabled>Play</button>
        <button id="btnStop" class="btn" disabled>Stop</button>
      </div>

      <div class="settings-row">
        <span>Loop</span>
        <input type="checkbox" id="loopCheck" checked>
      </div>
      
      <div class="settings-row">
        <span>Vol</span>
        <input type="range" id="volRange" min="0" max="2" step="0.1" value="1">
      </div>

      <hr style="border-color: #333; margin: 10px 0;">

      <button id="btnInject" class="btn btn-danger">Activate Injection</button>

      <div class="logs" id="logArea">
        <div class="log-entry">System Ready...</div>
      </div>
    </div>
  `;
  shadow.appendChild(ui);

  // --- Elements ---
  const els = {
    closeBtn: shadow.querySelector('.close-btn'),
    fileInput: shadow.querySelector('#fileInput'),
    btnPlayPause: shadow.querySelector('#btnPlayPause'),
    btnStop: shadow.querySelector('#btnStop'),
    btnInject: shadow.querySelector('#btnInject'),
    progressBar: shadow.querySelector('#progressBar'),
    progressContainer: shadow.querySelector('#progressContainer'),
    virtStatus: shadow.querySelector('#virtStatus'),
    logArea: shadow.querySelector('#logArea'),
    loopCheck: shadow.querySelector('#loopCheck'),
    volRange: shadow.querySelector('#volRange'),
    host: container // The host element to hide
  };

  let isInjected = false;
  let isPlaying = false;
  let progressInterval = null;
  let audioDuration = 0;

  // --- Logic ---

  function addLog(msg, type='info') {
    const div = document.createElement('div');
    div.className = `log-entry log-${type}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    els.logArea.appendChild(div);
    els.logArea.scrollTop = els.logArea.scrollHeight;
  }

  // File Loading
  els.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    addLog(`Loading ${file.name}...`);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target.result.split(',')[1];
      window.VirtualMicAPI.loadAudio(base64).then((success) => {
        if (success) {
          els.btnPlayPause.disabled = false;
          els.btnStop.disabled = false;
        }
      });
    };
    reader.readAsDataURL(file);
  });

  // Controls
  els.btnPlayPause.addEventListener('click', () => {
    if (isPlaying) {
      window.VirtualMicAPI.pause();
      els.btnPlayPause.textContent = "Play";
      isPlaying = false;
    } else {
      window.VirtualMicAPI.play();
      els.btnPlayPause.textContent = "Pause";
      isPlaying = true;
      startProgressLoop();
    }
  });

  els.btnStop.addEventListener('click', () => {
    window.VirtualMicAPI.stop();
    els.btnPlayPause.textContent = "Play";
    isPlaying = false;
    els.progressBar.style.width = '0%';
  });

  els.btnInject.addEventListener('click', () => {
    if (!isInjected) {
      window.VirtualMicAPI.activateInjection();
      els.btnInject.textContent = "Stop Injection";
      els.btnInject.classList.remove('btn-danger');
      els.btnInject.classList.add('btn-primary');
      isInjected = true;
    } else {
      window.VirtualMicAPI.deactivateInjection();
      els.btnInject.textContent = "Activate Injection";
      els.btnInject.classList.add('btn-danger');
      els.btnInject.classList.remove('btn-primary');
      isInjected = false;
    }
  });

  // Seek
  els.progressContainer.addEventListener('click', (e) => {
    if (audioDuration === 0) return;
    const rect = els.progressContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    window.VirtualMicAPI.seek(percent);
  });

  // Volume & Loop
  els.loopCheck.addEventListener('change', (e) => {
    window.VirtualMicAPI.setLoop(e.target.checked);
  });
  els.volRange.addEventListener('input', (e) => {
    window.VirtualMicAPI.setVolume(parseFloat(e.target.value));
  });

  // Close
  els.closeBtn.addEventListener('click', () => {
    els.host.style.display = 'none';
  });

  // --- Global Event Listeners (from Logic) ---
  
  window.addEventListener('vm-log', (e) => addLog(e.detail.msg, e.detail.type));
  
  window.addEventListener('vm-duration', (e) => {
    audioDuration = e.detail;
    addLog(`Duration: ${audioDuration.toFixed(2)}s`);
  });

  window.addEventListener('vm-status', (e) => {
    const isActive = e.detail;
    if (isActive) {
      els.virtStatus.textContent = "ON";
      els.virtStatus.className = "status-active";
    } else {
      els.virtStatus.textContent = "OFF";
      els.virtStatus.className = "status-inactive";
    }
  });

  window.addEventListener('vm-toggle-visibility', () => {
    if (els.host.style.display === 'none') {
      els.host.style.display = 'block';
    } else {
      els.host.style.display = 'none';
    }
  });

  // --- Progress Loop ---
  function startProgressLoop() {
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      const p = window.VirtualMicAPI.getProgress();
      els.progressBar.style.width = `${p * 100}%`;
      
      // Auto-reset if ended and not looping
      if (p >= 0.99 && !els.loopCheck.checked) {
        isPlaying = false;
        els.btnPlayPause.textContent = "Play";
        clearInterval(progressInterval);
      }
    }, 100);
  }

  // Simple Drag Logic
  let isDragging = false;
  let offset = { x: 0, y: 0 };
  
  const header = shadow.querySelector('.header');
  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    offset.x = e.clientX - els.host.getBoundingClientRect().left;
    offset.y = e.clientY - els.host.getBoundingClientRect().top;
  });
  
  window.addEventListener('mouseup', () => isDragging = false);
  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      els.host.style.right = 'auto';
      els.host.style.bottom = 'auto';
      els.host.style.left = `${e.clientX - offset.x}px`;
      els.host.style.top = `${e.clientY - offset.y}px`;
    }
  });

})();