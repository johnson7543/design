import {
  connectDesignQREmbed,
  createDesignQREmbedUrl,
} from 'designqr/embed';
import './style.css';

const TRANSPARENT_SCAN_THEME = {
  foliageColor: '#000000',
  qrFoliageColor: '#000000',
  qrFoliageHighlightColor: '#000000',
  qrFoliageShadowColor: '#000000',
  qrFoliageMidtoneColor: '#000000',
  qrFoliagePaletteColors: [
    '#000000',
    '#000000',
    '#000000',
    '#000000',
  ],
  qrFoliageColorVariation: 0,
  groundColor: '#FFFFFF',
  groundFeature: 'none',
  qrFinderColor: '#000000',
  qrFinderHighlightColor: '#000000',
  qrFinderShadowColor: '#000000',
  qrFinderEyeColor: '#000000',
  qrFinderPaletteColors: [
    '#000000',
    '#000000',
    '#000000',
    '#000000',
  ],
  qrFinderColorVariation: 0,
  skyTop: '#FFFFFF',
  skyBottom: '#FFFFFF',
  titleColor: '#000000',
  particleType: 'none',
  particleAmount: 0,
} as const;

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

async function cornerAlpha(blob: Blob): Promise<number> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('The exported PNG context is unavailable.');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return context.getImageData(0, 0, 1, 1).data[3];
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
  return cornerAlpha(blob).then((alpha) => {
    shell.dataset.earlyExportCornerAlpha = String(alpha);
    shell.dataset.earlyExportStatus = 'complete';
  });
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
    theme: TRANSPARENT_SCAN_THEME,
    view: 'qr',
    transparentBackground: true,
    details: {
      title: 'Winter invitation',
      showValue: true,
      border: { padding: 20 },
    },
    logo: {
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAAKUlEQVR4AZXBAQEAMAiAME4ti76tZmB7/lkCiSSSSCKJJJJIIokkkugASykB7A5L0MQAAAAASUVORK5CYII=',
      alt: 'Green iframe fixture logo',
      size: 0.16,
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
    shell.dataset.exportCornerAlpha = String(await cornerAlpha(blob));
    shell.dataset.exportStatus = 'complete';
    status.value = 'PNG exported';
  } catch (cause) {
    shell.dataset.exportStatus = 'error';
    status.value = cause instanceof Error ? cause.message : 'Export failed';
  }
});

window.addEventListener('pagehide', () => controller.destroy(), { once: true });
