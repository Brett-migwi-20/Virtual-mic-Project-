# Virtual Microphone Pro

A Chrome extension that enables persistent audio injection into web applications, simulating a virtual microphone using pre-recorded audio files. This allows you to broadcast custom audio (e.g., voiceovers, sound effects, or loops) as your microphone input in video calls, streaming platforms, or any web app that requests microphone access.

## Features

- **Audio File Upload**: Load audio files (e.g., MP3, WAV) directly from your device.
- **Playback Controls**: Play, pause, stop, seek, and loop audio with a visual progress bar.
- **Volume Control**: Adjust playback volume in real-time.
- **Virtual Microphone Injection**: Override `getUserMedia` to provide virtual audio streams when web apps request microphone access.
- **UI Overlay**: In-page draggable UI for controls, status indicators, and debug logs.
- **Popup Interface**: Quick access via the extension popup for file upload and basic settings.
- **Persistent Injection**: Maintains virtual mic state across page reloads until deactivated.
- **Debug Logging**: Built-in logs for troubleshooting audio loading and injection.

## Installation

1. **Download or Clone the Repository**:
   - Download the ZIP from GitHub or clone the repo: `git clone https://github.com/your-repo/virtual-voice.git`

2. **Load in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable "Developer mode" in the top right.
   - Click "Load unpacked" and select the project folder (`VirtualVoice`).

3. **Verify**:
   - The extension "Virtual Microphone Pro" should appear in your extensions list.
   - Pin the extension icon to your toolbar for easy access.

## Usage

### Via Extension Popup
1. Click the extension icon in the toolbar to open the popup.
2. Upload an audio file using the file input.
3. Adjust volume and toggle loop if desired.
4. Click "Activate Injection" to enable the virtual microphone.
5. The status will show "Virtual Mic Active".
6. Open a web app (e.g., Zoom, Discord) and grant microphone access – it will use your virtual audio.

### Via In-Page UI
1. On a web page, click the extension icon or use the toggle (if set up).
2. A draggable UI overlay will appear.
3. Upload audio, control playback, and activate injection directly from the page.
4. Use the progress bar to seek, buttons to play/pause/stop, and settings for loop/volume.

### Deactivation
- In the popup or UI, click "Stop Injection" to disable and restore normal microphone access.

## How It Works

- **Manifest V3 Extension**: Uses service workers, content scripts, and web accessible resources for injection.
- **Audio Processing**: Decodes uploaded audio into an `AudioBuffer` using the Web Audio API.
- **Stream Creation**: Generates a `MediaStream` from the audio buffer, connected via `GainNode` for volume control.
- **Override Mechanism**: Intercepts `navigator.mediaDevices.getUserMedia` calls when injection is active, returning the virtual stream instead of the physical microphone.
- **Isolation**: Scripts run in isolated worlds to avoid conflicts with page scripts.

## Files Overview

- `manifest.json`: Extension configuration and permissions.
- `background.js`: Handles extension icon clicks to toggle the in-page UI.
- `content.js`: Injects logic and UI scripts into web pages.
- `virtual-mic-logic.js`: Core audio engine and API for playback/injection.
- `virtual-mic-ui.js`: In-page UI component with controls and logs.
- `icons/`: Extension icons in various sizes.

## Requirements

- **Browser**: Google Chrome (or Chromium-based browsers) with Manifest V3 support.
- **Permissions**: The extension requires access to all URLs, storage, active tabs, and scripting – grant these during installation.
- **Audio Formats**: Supports common formats decodable by the Web Audio API (e.g., MP3, WAV, OGG).
- **Audio Context**: Ensure your browser allows audio playback (may need user interaction to resume suspended contexts).

## Troubleshooting

- **Audio Not Playing**: Check browser audio permissions and ensure the page allows autoplay.
- **Injection Not Working**: Verify the extension is loaded and injection is active. Some sites may have strict CSP policies.
- **Logs**: Use the in-page UI logs for error messages.
- **Compatibility**: Tested on Chrome; may not work on Firefox or other browsers without Manifest V3.

## Contributing

Contributions are welcome! Please fork the repo, make changes, and submit a pull request. Ensure code follows the existing style and test on multiple sites.

## License

This project is open-source. See LICENSE file for details (if applicable).

## Disclaimer

Use responsibly. This extension is for educational and personal use. Ensure compliance with terms of service of web applications you use it with.