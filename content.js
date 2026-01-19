// content.js

let isUiInjected = false;

// Listen for toggle command from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "TOGGLE_UI") {
    toggleUi();
  }
});

function toggleUi() {
  const existingFrame = document.getElementById('virtual-mic-container');
  
  if (existingFrame) {
    // If UI exists, remove it
    existingFrame.remove();
    isUiInjected = false;
  } else {
    // If UI doesn't exist, inject Logic and UI
    if (!isUiInjected) {
      injectScript('virtual-mic-logic.js'); // The Audio Engine
      injectScript('virtual-mic-ui.js');    // The Visual Interface
      isUiInjected = true;
    } else {
      // Logic is there, just toggle visibility
      const event = new CustomEvent('vm-toggle-visibility');
      window.dispatchEvent(event);
    }
  }
}

function injectScript(fileName) {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(fileName);
  script.onload = function() { this.remove(); };
  // Append to head to ensure it loads early
  (document.head || document.documentElement).appendChild(script);
}