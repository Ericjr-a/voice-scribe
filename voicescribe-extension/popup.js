document.getElementById('injectBtn').addEventListener('click', async () => {
    // Get the current active tab
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // Inject content.js into the page
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
    });
    window.close(); // Close the popup after injection (optional)
});
