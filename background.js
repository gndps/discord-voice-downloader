chrome.runtime.onMessage.addListener((message, sender) => {
  if (message && message.type === 'download') {
    const url = message.url;
    const filename = message.filename || 'voice-message.ogg';
    // Use chrome.downloads API to save the file
    chrome.downloads.download({ url, filename, conflictAction: 'uniquify' }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download failed:', chrome.runtime.lastError.message);
        chrome.tabs.sendMessage(sender.tab.id, { type: 'download-error', error: chrome.runtime.lastError.message });
      } else {
        chrome.tabs.sendMessage(sender.tab.id, { type: 'download-started', id: downloadId });
      }
    });
  }
});