let recorder = null;
let chunks = [];
let stream = null;

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    if (msg.action === 'start-recording') {
        // Start tab audio capture
        stream = await chrome.tabCapture.capture({ audio: true, video: false });
        recorder = new MediaRecorder(stream);
        chunks = [];

        recorder.ondataavailable = (e) => chunks.push(e.data);

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/mp3' });
            // Save blob for download when user asks
            chrome.storage.local.set({ recordingBlob: blob });
        };

        recorder.start();
        sendResponse({ status: 'recording-started' });
    }

    if (msg.action === 'stop-recording') {
        if (recorder) {
            recorder.stop();
            stream.getTracks().forEach(track => track.stop());
            recorder = null;
            stream = null;
            sendResponse({ status: 'recording-stopped' });
        }
    }

    // To allow async response
    return true;
});
