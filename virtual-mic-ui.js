// virtual-mic-ui.js

(function() {
  'use strict';

  const container = document.createElement('div');
  container.id = 'virtual-mic-container';
  document.body.appendChild(container);
  
  const shadow = container.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 360px;
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

    .body { padding: 15px; max-height: 550px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }

    /* Device Status Bar */
    .device-status-row {
      display: flex;
      justify-content: space-between;
      background: #25252e;
      padding: 10px;
      border-radius: 6px;
      border: 1px solid #444;
    }
    .device-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      font-size: 0.75rem;
      color: #aaa;
      width: 45%;
    }
    .badge {
      font-size: 0.7rem;
      font-weight: bold;
      padding: 3px 8px;
      border-radius: 10px;
      text-transform: uppercase;
    }
    .status-available { background: rgba(46, 204, 113, 0.2); color: #2ecc71; border: 1px solid #2ecc71; }
    .status-blocked { background: rgba(231, 76, 60, 0.2); color: #e74c3c; border: 1px solid #e74c3c; }
    .status-off { background: rgba(255, 255, 255, 0.1); color: #999; border: 1px solid #555; }
    .status-on { background: rgba(46, 204, 113, 0.2); color: #2ecc71; border: 1px solid #2ecc71; box-shadow: 0 0 5px rgba(46, 204, 113, 0.4); }

    /* Folder Section */
    .folder-section {
      border: 1px solid #444;
      border-radius: 6px;
      background: #25252e;
    }
    .folder-header {
      padding: 10px;
      background: #2b2b36;
      font-size: 0.8rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .count-badge {
      background: #4a90e2; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;
    }
    .folder-controls { padding: 10px; display: flex; gap: 5px; }
    
    input.search-bar {
      width: 100%;
      padding: 8px;
      background: #111;
      border: 1px solid #444;
      color: white;
      border-radius: 4px;
      outline: none;
    }
    input.search-bar:focus { border-color: #4a90e2; }
    
    button.folder-btn {
      padding: 8px;
      background: #3a3a45;
      border: none;
      color: white;
      border-radius: 4px;
      cursor: pointer;
      flex: 1;
      font-size: 0.8rem;
    }
    button.folder-btn:hover { background: #4a4a58; }

    /* File List */
    .file-list {
      max-height: 100px;
      overflow-y: auto;
      border-top: 1px solid #444;
      background: #1a1a1f;
    }
    .file-item {
      padding: 8px 10px;
      font-size: 0.85rem;
      cursor: pointer;
      border-bottom: 1px solid #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-item:hover { background: #3a3a45; }
    .file-item.active { background: #4a90e2; color: white; }
    .file-item.loading { color: #f1c40f; font-style: italic; }

    /* Player Controls */
    .current-track {
      font-weight: bold; color: #fff; margin-bottom: 5px; font-size: 0.9rem; min-height: 20px; text-align: center;
    }
    
    .control-row { display: flex; gap: 10px; margin-bottom: 5px; }
    .btn {
      flex: 1; padding: 8px; background: #3a3a45; border: none; color: white;
      border-radius: 4px; cursor: pointer; font-size: 0.8rem;
    }
    .btn:hover:not(:disabled) { background: #4a4a58; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: #4a90e2; }
    .btn-danger { background: #c0392b; }

    .progress-container { height: 4px; background: #333; border-radius: 2px; margin: 5px 0; cursor: pointer; }
    .progress-bar { height: 100%; background: #4a90e2; width: 0%; border-radius: 2px; }

    .settings-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; }
    
    .logs {
      background: #000; height: 80px; font-family: monospace; font-size: 0.7rem;
      padding: 5px; overflow-y: auto; color: #aaa; margin-top: 10px; border-radius: 4px;
    }
    .log-entry { margin-bottom: 2px; border-bottom: 1px solid #222; }
    .log-success { color: #2ecc71; }
    .log-error { color: #e74c3c; }
  `;
  shadow.appendChild(style);

  const ui = document.createElement('div');
  ui.innerHTML = `
    <div class="header" id="dragHandle">
      <span class="title">🎙️ Virtual Mic Library</span>
      <span class="close-btn">&times;</span>
    </div>
    <div class="body">
      
      <!-- 1. DEVICE STATUS (New Section) -->
      <div class="device-status-row">
        <div class="device-item">
          <span class="label">Physical Mic</span>
          <span id="physStatus" class="badge status-available">Available</span>
        </div>
        <div class="device-item">
          <span class="label">Virtual Mic</span>
          <span id="virtStatus" class="badge status-off">Inactive</span>
        </div>
      </div>

      <!-- 2. Library/Folder Section -->
      <div class="folder-section">
        <div class="folder-header">
          <span>Recordings</span>
          <span class="count-badge" id="countBadge">0</span>
        </div>
        <div class="folder-controls">
          <button id="btnOpenFolder" class="folder-btn">📂 Open Folder</button>
          <input type="text" id="searchInput" class="search-bar" placeholder="Search recordings...">
        </div>
        <div class="file-list" id="fileList">
          <div style="padding:10px; text-align:center; color:#666; font-size:0.8rem;">
            Open a folder to load recordings
          </div>
        </div>
      </div>

      <!-- 3. Current Player Input -->
      <div class="current-track" id="trackName">No file selected</div>

      <!-- 4. Playback -->
      <div class="progress-container" id="progressContainer"><div class="progress-bar" id="progressBar"></div></div>
      <div class="control-row">
        <button id="btnPlayPause" class="btn btn-primary" disabled>Play</button>
        <button id="btnStop" class="btn" disabled>Stop</button>
      </div>

      <div class="settings-row">
        <span>Loop</span><input type="checkbox" id="loopCheck" checked>
      </div>
      <div class="settings-row">
        <span>Vol</span><input type="range" id="volRange" min="0" max="2" step="0.1" value="1">
      </div>

      <button id="btnInject" class="btn btn-danger" style="margin-top:10px;">Activate Injection</button>

      <!-- 5. Debug Logs -->
      <div class="logs" id="logArea"><div class="log-entry">System Ready...</div></div>
    </div>
  `;
  shadow.appendChild(ui);

  // --- Elements ---
  const els = {
    closeBtn: shadow.querySelector('.close-btn'),
    btnOpenFolder: shadow.querySelector('#btnOpenFolder'),
    searchInput: shadow.querySelector('#searchInput'),
    fileList: shadow.querySelector('#fileList'),
    countBadge: shadow.querySelector('#countBadge'),
    trackName: shadow.querySelector('#trackName'),
    
    // Status Elements
    physStatus: shadow.querySelector('#physStatus'),
    virtStatus: shadow.querySelector('#virtStatus'),

    btnPlayPause: shadow.querySelector('#btnPlayPause'),
    btnStop: shadow.querySelector('#btnStop'),
    btnInject: shadow.querySelector('#btnInject'),
    progressBar: shadow.querySelector('#progressBar'),
    progressContainer: shadow.querySelector('#progressContainer'),
    loopCheck: shadow.querySelector('#loopCheck'),
    volRange: shadow.querySelector('#volRange'),
    logArea: shadow.querySelector('#logArea'),
    host: container
  };

  let isInjected = false;
  let isPlaying = false;
  let progressInterval = null;
  let audioDuration = 0;
  let loadedFileName = null;

  // Cached file names from folder
  let allFiles = []; 

  // --- Logic Functions ---

  function addLog(msg, type='info') {
    const div = document.createElement('div');
    div.className = `log-entry log-${type}`;
    div.textContent = `[${new Date().toLocaleTimeString().split(' ')[0]}] ${msg}`;
    els.logArea.appendChild(div);
    els.logArea.scrollTop = els.logArea.scrollHeight;
  }

  // Updates the Status Badges based on injection state
  function updateDeviceStatus(isVirtualActive) {
    if (isVirtualActive) {
      // Virtual Mic Active
      els.virtStatus.textContent = "Active";
      els.virtStatus.className = "badge status-on";
      
      // Physical Mic Blocked
      els.physStatus.textContent = "BLOCKED";
      els.physStatus.className = "badge status-blocked";
    } else {
      // Virtual Mic Inactive
      els.virtStatus.textContent = "Inactive";
      els.virtStatus.className = "badge status-off";
      
      // Physical Mic Available
      els.physStatus.textContent = "Available";
      els.physStatus.className = "badge status-available";
    }
  }

  function renderFileList(filesToRender) {
    els.fileList.innerHTML = '';
    if (filesToRender.length === 0) {
      els.fileList.innerHTML = `<div style="padding:10px; text-align:center; color:#666;">No matches found</div>`;
      return;
    }

    filesToRender.forEach(name => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.textContent = name;
      if (name === loadedFileName) item.classList.add('active');
      
      item.addEventListener('click', () => {
        selectFile(name);
      });
      els.fileList.appendChild(item);
    });
  }

  function selectFile(name) {
    if (name === loadedFileName) return; // Already selected
    
    els.trackName.textContent = "Loading...";
    
    // Visual feedback in list
    const items = els.fileList.querySelectorAll('.file-item');
    items.forEach(i => {
      if (i.textContent === name) i.classList.add('loading');
      else i.classList.remove('active');
    });

    // Trigger API load
    window.VirtualMicAPI.loadByHandle(name);
  }

  // --- Event Listeners ---

  els.btnOpenFolder.addEventListener('click', () => {
    window.VirtualMicAPI.openFolder();
  });

  els.searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allFiles.filter(f => f.toLowerCase().includes(term));
    renderFileList(filtered);
  });

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
      updateDeviceStatus(true);
    } else {
      window.VirtualMicAPI.deactivateInjection();
      els.btnInject.textContent = "Activate Injection";
      els.btnInject.classList.add('btn-danger');
      els.btnInject.classList.remove('btn-primary');
      isInjected = false;
      updateDeviceStatus(false);
    }
  });

  els.progressContainer.addEventListener('click', (e) => {
    if (audioDuration === 0) return;
    const rect = els.progressContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    window.VirtualMicAPI.seek(percent);
  });

  els.loopCheck.addEventListener('change', (e) => window.VirtualMicAPI.setLoop(e.target.checked));
  els.volRange.addEventListener('input', (e) => window.VirtualMicAPI.setVolume(parseFloat(e.target.value)));

  els.closeBtn.addEventListener('click', () => els.host.style.display = 'none');

  // --- Custom Event Responses ---

  window.addEventListener('vm-log', (e) => addLog(e.detail.msg, e.detail.type));
  
  window.addEventListener('vm-folder-loaded', (e) => {
    allFiles = e.detail.handles; // Store the array of strings (names)
    els.countBadge.textContent = e.detail.count;
    renderFileList(allFiles);
  });

  window.addEventListener('vm-loading', () => {
    // UI updated inside selectFile immediately
  });

  window.addEventListener('vm-loading-done', (e) => {
    loadedFileName = e.detail;
    els.trackName.textContent = loadedFileName;
    els.btnPlayPause.disabled = false;
    els.btnStop.disabled = false;
    
    // Re-render list to update active state
    const currentSearch = els.searchInput.value.toLowerCase();
    const filtered = allFiles.filter(f => f.toLowerCase().includes(currentSearch));
    renderFileList(filtered);
  });
  
  window.addEventListener('vm-loading-fail', () => {
    els.trackName.textContent = "Error loading file";
  });

  window.addEventListener('vm-duration', (e) => {
    audioDuration = e.detail;
    addLog(`Duration: ${audioDuration.toFixed(2)}s`);
  });

  // Listen for status updates from logic script (e.g. if it starts automatically)
  window.addEventListener('vm-status', (e) => {
    const isActive = e.detail;
    updateDeviceStatus(isActive);
    
    // Sync button text if changed externally (rare but possible)
    if (isActive && !isInjected) {
        els.btnInject.textContent = "Stop Injection";
        els.btnInject.classList.remove('btn-danger');
        els.btnInject.classList.add('btn-primary');
        isInjected = true;
    } else if (!isActive && isInjected) {
        els.btnInject.textContent = "Activate Injection";
        els.btnInject.classList.add('btn-danger');
        els.btnInject.classList.remove('btn-primary');
        isInjected = false;
    }
    
    addLog(isActive ? "Injection Started" : "Injection Stopped", "success");
  });

  window.addEventListener('vm-toggle-visibility', () => {
    els.host.style.display = (els.host.style.display === 'none') ? 'block' : 'none';
  });

  function startProgressLoop() {
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      const p = window.VirtualMicAPI.getProgress();
      els.progressBar.style.width = `${p * 100}%`;
      if (p >= 0.99 && !els.loopCheck.checked) {
        isPlaying = false;
        els.btnPlayPause.textContent = "Play";
        clearInterval(progressInterval);
      }
    }, 100);
  }

  // Dragging
  let isDragging = false, offset = { x: 0, y: 0 };
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