async function startDesignQrCapture(tab) {
  if (!tab.id) return;

  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tab.id,
    consumerTabId: tab.id,
  });
  await chrome.tabs.sendMessage(tab.id, {
    type: 'design-demo-capture-stream',
    streamId,
  });
}

chrome.action.onClicked.addListener((tab) => {
  void startDesignQrCapture(tab).catch(async (error) => {
    if (!tab.id) return;
    await chrome.tabs
      .sendMessage(tab.id, {
        type: 'design-demo-capture-error',
        message: error instanceof Error ? error.message : String(error),
      })
      .catch(() => {});
  });
});
