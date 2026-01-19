// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const audioInput = document.getElementById('audioFile');
  const toggleBtn = document.getElementById('toggleBtn');
  const volumeRange = document.getElementById('volumeRange');
  const volumeVal = document.getElementById('volumeVal');
  const statusText = document.getElementById('statusText');
  const statusIndicator = document.getElementById('statusIndicator');
  
  let isInjectionActive = false;
  let loadedBase64 = null;

  // 1. Handle File Upload
  audioInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      loadedBase64 = event.target.result.split(',')[1]; // Get base64 part
      toggleBtn.disabled = false;
      toggleBtn.textContent = "Activate Injection";
      
      // Send audio data to page script immediately to prepare
      sendMessage({
        command: "LOAD_AUDIO",
        audioData: loadedBase64
      });
    };
    reader.readAsDataURL(file);
  });

  // 2. Toggle Injection
  toggleBtn.addEventListener('click', () => {
    if (!isInjectionActive) {
      // Start
      sendMessage({ command: "START_INJECTION" });
      isInjectionActive = true;
      toggleBtn.textContent = "Stop Injection";
      toggleBtn.classList.add('btn-stop');
      statusIndicator.classList.add('active');
      statusText.textContent = "Virtual Mic Active";
    } else {
      // Stop
      sendMessage({ command: "STOP_INJECTION" });
      isInjectionActive = false;
      toggleBtn.textContent = "Activate Injection";
      toggleBtn.classList.remove('btn-stop');
      statusIndicator.classList.remove('active');
      statusText.textContent = "Inactive";
    }
  });

  // 3. Volume Control
  volumeRange.addEventListener('input', (e) => {
    const val = e.target.value;
    volumeVal.textContent = val + '%';
    sendMessage({
      command: "SET_VOLUME",
      volume: val / 100
    });
  });

  // Helper: Send message to active tab's content script
  function sendMessage(data) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, data, (response) => {
          if (chrome.runtime.lastError) {
            console.log("Could not send message (content script might not be ready yet)");
          }
        });
      }
    });
  }
});