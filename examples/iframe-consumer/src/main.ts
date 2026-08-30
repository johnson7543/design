import {
  connectDesignQREmbed,
  createDesignQREmbedUrl,
} from 'designqr/embed';
import './style.css';

function requiredElement<TElement extends Element>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);
  if (!element) throw new Error(`Missing iframe consumer element: ${selector}`);
  return element;
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0')
  ).join('');
}

const shell = requiredElement<HTMLElement>('.iframe-consumer');
const frame = requiredElement<HTMLIFrameElement>('#designqr-frame');
const status = requiredElement<HTMLOutputElement>('#status');
const query = new URLSearchParams(window.location.search);
const embedOrigin = query.get('embedOrigin') ?? 'https://design.johnson7543.com';

frame.src = createDesignQREmbedUrl(
  {
    value: 'https://example.com/iframe-consumer',
    design: { type: 'tree', options: { shape: 'dome', seed: 0.42 } },
    theme: 'spring',
    view: 'design',
    interaction: {
      dragToRotate: true,
      tapToToggleView: true,
      autoRotate: false,
      motionBlur: true,
    },
  },
  { origin: embedOrigin }
);

const controller = connectDesignQREmbed(frame, {
  origin: embedOrigin,
  onReady(event) {
    shell.dataset.ready = 'true';
    shell.dataset.instanceId = event.instanceId;
    shell.dataset.view = event.view;
    status.value = 'Ready';
  },
  onViewChange(view) {
    shell.dataset.view = view;
    status.value = `View: ${view}`;
  },
  onError(error) {
    shell.dataset.errorCode = error.code;
    status.value = error.message;
  },
});

void controller.exportImage().then((blob) => {
  shell.dataset.earlyExportMime = blob.type;
  shell.dataset.earlyExportStatus = 'complete';
}).catch((cause: unknown) => {
  shell.dataset.earlyExportStatus = 'error';
  status.value = cause instanceof Error ? cause.message : 'Early export failed';
});

requiredElement<HTMLButtonElement>('#show-qr').addEventListener('click', () => {
  controller.setView('qr');
});

requiredElement<HTMLButtonElement>('#set-config').addEventListener('click', () => {
  controller.setConfig({
    value: 'https://example.com/updated-iframe',
    design: { type: 'tree', options: { shape: 'pine', seed: 0.7 } },
    theme: 'winter',
    view: 'qr',
    details: {
      title: 'Winter invitation',
      showValue: true,
      border: { padding: 20 },
    },
    interaction: {
      dragToRotate: true,
      tapToToggleView: true,
      autoRotate: false,
      motionBlur: true,
    },
  });
  shell.dataset.configSent = 'true';
});

requiredElement<HTMLButtonElement>('#pause-player').addEventListener('click', () => {
  controller.pause();
  shell.dataset.paused = 'true';
  status.value = 'Paused';
});

requiredElement<HTMLButtonElement>('#export-image').addEventListener('click', async () => {
  shell.dataset.exportStatus = 'working';
  try {
    const blob = await controller.exportImage();
    shell.dataset.exportMime = blob.type;
    shell.dataset.exportBytes = String(blob.size);
    shell.dataset.exportHash = await sha256(blob);
    shell.dataset.exportStatus = 'complete';
    status.value = 'PNG exported';
  } catch (cause) {
    shell.dataset.exportStatus = 'error';
    status.value = cause instanceof Error ? cause.message : 'Export failed';
  }
});

window.addEventListener('pagehide', () => controller.destroy(), { once: true });
