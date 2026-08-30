const messageSource = 'design-demo-local-recorder';
let activeCapture;

function postToPage(type, detail = {}) {
  window.postMessage({ source: messageSource, type, ...detail }, '*');
}

async function startCapture(streamId) {
  if (activeCapture) throw new Error('A product demo tab capture is already active.');

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
        minFrameRate: 60,
        maxFrameRate: 60,
      },
    },
  });
  const mimeType = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
  if (!mimeType) throw new Error('Chrome does not expose a supported WebM recorder.');

  const chunks = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 5_000_000,
  });
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });
  recorder.start(250);
  activeCapture = { chunks, mimeType, recorder, stream };

  postToPage('capture-started', {
    mimeType,
    settings: stream.getVideoTracks()[0]?.getSettings(),
  });
}

async function stopCapture() {
  const capture = activeCapture;
  if (!capture) throw new Error('The product demo tab capture was not started.');

  const stopped = new Promise((resolve) => {
    capture.recorder.addEventListener('stop', resolve, { once: true });
  });
  capture.recorder.stop();
  await stopped;
  capture.stream.getTracks().forEach((track) => track.stop());

  const blob = new Blob(capture.chunks, { type: capture.mimeType });
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result), { once: true });
    reader.addEventListener('error', () => reject(reader.error), { once: true });
    reader.readAsDataURL(blob);
  });
  activeCapture = undefined;
  postToPage('capture-complete', {
    byteLength: blob.size,
    base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'design-demo-capture-stream') {
    void startCapture(message.streamId).catch((error) => {
      postToPage('capture-error', {
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }

  if (message.type === 'design-demo-capture-error') {
    postToPage('capture-error', { message: message.message });
  }
});

document.addEventListener('design-demo-recorder-stop', () => {
  void stopCapture().catch((error) => {
    postToPage('capture-error', {
      message: error instanceof Error ? error.message : String(error),
    });
  });
});
