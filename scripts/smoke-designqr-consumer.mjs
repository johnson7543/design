import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';
import jsQR from 'jsqr';
import QRCode from 'qrcode';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const host = '127.0.0.1';
const port = Number(process.env.DESIGNQR_CONSUMER_PORT ?? 4174);
const url = `http://${host}:${port}`;
const primaryPlayerSelector = '[data-fixture="primary"] .designqr-root';
const secondaryPlayerSelector = '[data-fixture="secondary"] .designqr-root';
const packageStyleProperties = [
  '--designqr-title-font-family',
  '--designqr-body-font-family',
  '--designqr-content-color',
  '--designqr-border-color',
  '--designqr-border-highlight-color',
  '--designqr-focus-color',
  '--designqr-focus-contrast-color',
];
const fixtureLogoPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAAKUlEQVR4AZXBAQEAMAiAME4ti76tZmB7/lkCiSSSSCKJJJJIIokkkugASykB7A5L0MQAAAAASUVORK5CYII=',
  'base64'
);
let previewLog = '';

async function interceptFixtureLogoRequests(page, includeCorsFailure = false) {
  const state = { sameOriginRequestCount: 0 };
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const requestUrl = new URL(request.url());
    if (
      requestUrl.origin === url
      && requestUrl.pathname === '/fixture-logo.png'
    ) {
      state.sameOriginRequestCount += 1;
      void request.respond({
        status: 200,
        contentType: 'image/png',
        body: fixtureLogoPng,
      });
      return;
    }
    if (
      includeCorsFailure
      && requestUrl.href === 'https://designqr-cors.invalid/logo.png'
    ) {
      void request.respond({
        status: 200,
        contentType: 'image/png',
        body: fixtureLogoPng,
      });
      return;
    }
    void request.continue();
  });
  return state;
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next browser location.
    }
  }
  throw new Error('Chrome was not found for the DesignQR consumer smoke test.');
}

async function waitForPreview(preview, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) {
      throw new Error(`Consumer preview exited with code ${preview.exitCode}.\n${previewLog}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Consumer preview did not become ready at ${url}.`);
}

async function waitForConsumerReady(page, expectedCount = 2) {
  await page.waitForFunction(
    (count) => (
      document.querySelectorAll('.designqr-presentation-canvas').length >= count
      && Number(document.querySelector('.consumer-shell')?.getAttribute('data-ready-count')) >= count
    ),
    { timeout: 15_000 },
    expectedCount
  );
}

async function waitForAnimationFrames(page, count = 2) {
  await page.evaluate((frameCount) => new Promise((resolve) => {
    const next = (remaining) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => next(remaining - 1));
    };
    next(frameCount);
  }), count);
}

async function readPrimaryCanvasState(page) {
  return page.$eval(
    '.consumer-player:first-of-type .designqr-presentation-canvas',
    (canvas) => {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('The primary presentation context is unavailable.');
      const { width, height } = canvas;
      const pixels = context.getImageData(0, 0, width, height).data;
      let hash = 2166136261;
      let greenCount = 0;
      let greenX = 0;
      let greenY = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          if ((index & 63) === 0) {
            hash ^= red;
            hash = Math.imul(hash, 16777619);
            hash ^= green;
            hash = Math.imul(hash, 16777619);
            hash ^= blue;
            hash = Math.imul(hash, 16777619);
          }
          const inCenter = x > width * 0.25
            && x < width * 0.75
            && y > height * 0.25
            && y < height * 0.75;
          if (inCenter && red < 45 && green > 115 && green < 190 && blue < 100) {
            greenCount += 1;
            greenX += x;
            greenY += y;
          }
        }
      }
      return {
        hash: hash >>> 0,
        greenCount,
        greenCenterX: greenCount === 0 ? null : greenX / greenCount / width,
        greenCenterY: greenCount === 0 ? null : greenY / greenCount / height,
      };
    }
  );
}

async function readPrimaryAlphaState(page) {
  return page.$eval(
    '.consumer-player:first-of-type .designqr-presentation-canvas',
    (canvas) => {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('The primary presentation context is unavailable.');
      const { width, height } = canvas;
      const cornerPoints = [
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1],
      ];
      return {
        corners: cornerPoints.map(([x, y]) => (
          context.getImageData(x, y, 1, 1).data[3]
        )),
        center: context.getImageData(
          Math.floor(width / 2),
          Math.floor(height / 2),
          1,
          1
        ).data[3],
      };
    }
  );
}

async function readPrimarySourceGeometry(page) {
  return page.$eval(
    '[data-fixture="primary"] .designqr-webgl-canvas',
    (canvas) => {
      const scratch = document.createElement('canvas');
      scratch.width = canvas.width;
      scratch.height = canvas.height;
      const context = scratch.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('The source geometry context is unavailable.');
      context.drawImage(canvas, 0, 0);

      const { width, height } = scratch;
      const pixels = context.getImageData(0, 0, width, height).data;
      let opaqueCount = 0;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      let hash = 2166136261;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          if ((index & 63) === 0) {
            hash ^= pixels[index];
            hash = Math.imul(hash, 16777619);
            hash ^= pixels[index + 1];
            hash = Math.imul(hash, 16777619);
            hash ^= pixels[index + 2];
            hash = Math.imul(hash, 16777619);
            hash ^= pixels[index + 3];
            hash = Math.imul(hash, 16777619);
          }
          if (pixels[index + 3] < 128) continue;
          opaqueCount += 1;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }

      if (opaqueCount === 0) {
        return {
          hash: hash >>> 0,
          opaqueFraction: 0,
          boundsWidth: 0,
          boundsHeight: 0,
          boundsCenterX: 0,
          boundsCenterY: 0,
          boundsAspect: 0,
        };
      }

      const boundsWidth = (maxX - minX + 1) / width;
      const boundsHeight = (maxY - minY + 1) / height;
      return {
        hash: hash >>> 0,
        opaqueFraction: opaqueCount / (width * height),
        boundsWidth,
        boundsHeight,
        boundsCenterX: (minX + maxX + 1) / 2 / width,
        boundsCenterY: (minY + maxY + 1) / 2 / height,
        boundsAspect: boundsWidth / boundsHeight,
      };
    }
  );
}

async function storePrimarySourceSnapshot(page) {
  await page.$eval(
    '.consumer-player:first-of-type .designqr-webgl-canvas',
    (canvas) => {
      const scratch = document.createElement('canvas');
      scratch.width = canvas.width;
      scratch.height = canvas.height;
      const context = scratch.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('The source snapshot context is unavailable.');
      context.drawImage(canvas, 0, 0);
      globalThis.__designQrLogoColorSnapshot = {
        width: canvas.width,
        height: canvas.height,
        pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
      };
    }
  );
}

async function comparePrimarySourceSnapshot(page) {
  return page.$eval(
    '.consumer-player:first-of-type .designqr-webgl-canvas',
    (canvas) => {
      const baseline = globalThis.__designQrLogoColorSnapshot;
      if (!baseline || baseline.width !== canvas.width || baseline.height !== canvas.height) {
        throw new Error('The source snapshot is missing or changed dimensions.');
      }
      const scratch = document.createElement('canvas');
      scratch.width = canvas.width;
      scratch.height = canvas.height;
      const context = scratch.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('The source comparison context is unavailable.');
      context.drawImage(canvas, 0, 0);
      const current = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let comparedPixels = 0;
      let changedPixels = 0;
      let totalChannelDelta = 0;

      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const inLogoArea = x > canvas.width * 0.33
            && x < canvas.width * 0.67
            && y > canvas.height * 0.33
            && y < canvas.height * 0.67;
          if (inLogoArea) continue;
          const index = (y * canvas.width + x) * 4;
          if (baseline.pixels[index + 3] <= 240 && current[index + 3] <= 240) continue;
          const redDelta = Math.abs(baseline.pixels[index] - current[index]);
          const greenDelta = Math.abs(baseline.pixels[index + 1] - current[index + 1]);
          const blueDelta = Math.abs(baseline.pixels[index + 2] - current[index + 2]);
          comparedPixels += 1;
          totalChannelDelta += (redDelta + greenDelta + blueDelta) / 3;
          if (Math.max(redDelta, greenDelta, blueDelta) > 4) changedPixels += 1;
        }
      }

      return {
        meanChannelDelta: comparedPixels === 0
          ? Number.POSITIVE_INFINITY
          : totalChannelDelta / comparedPixels,
        changedFraction: comparedPixels === 0
          ? 1
          : changedPixels / comparedPixels,
      };
    }
  );
}

async function inspectPrimaryQR(page, hostBackground = '#ffffff') {
  const snapshot = await page.$eval(
    '.consumer-player:first-of-type .designqr-presentation-canvas',
    (canvas, backgroundColor) => {
      const composite = document.createElement('canvas');
      composite.width = canvas.width;
      composite.height = canvas.height;
      const context = composite.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('The primary composite context is unavailable.');
      // Transparent artwork delegates any surrounding quiet area to its host.
      // Composite over the requested host before asking the independent decoder.
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, composite.width, composite.height);
      context.drawImage(canvas, 0, 0);
      return {
        width: composite.width,
        height: composite.height,
        pixels: Array.from(
          context.getImageData(0, 0, composite.width, composite.height).data
        ),
      };
    },
    hostBackground
  );
  return jsQR(
    Uint8ClampedArray.from(snapshot.pixels),
    snapshot.width,
    snapshot.height,
    { inversionAttempts: 'attemptBoth' }
  );
}

async function decodePrimaryQR(page, hostBackground) {
  return (await inspectPrimaryQR(page, hostBackground))?.data ?? null;
}

async function readPrimaryOpaqueBounds(page) {
  return page.$eval(
    '.consumer-player:first-of-type .designqr-presentation-canvas',
    (canvas) => {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('The primary presentation context is unavailable.');
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          if (pixels[(y * canvas.width + x) * 4 + 3] < 250) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }

      return { minX, minY, maxX, maxY };
    }
  );
}

async function verifyReducedMotionViewer(browser) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });

  try {
    await interceptFixtureLogoRequests(page);
    await page.emulateMediaFeatures([
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ]);
    await page.setViewport({
      width: 1100,
      height: 760,
      deviceScaleFactor: 1,
    });
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });
    await waitForConsumerReady(page);
    await page.waitForFunction(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      { timeout: 15_000 }
    );
    await page.click('[data-action="logo-none"]');
    await page.waitForFunction(
      () => document.querySelector('.consumer-shell')?.getAttribute('data-logo-mode') === 'none',
      { timeout: 15_000 }
    );
    await waitForAnimationFrames(page);
    await page.$eval(primaryPlayerSelector, (element) => element.focus());
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      (selector) => document.querySelector(selector)?.classList.contains('view-scan') === true,
      { timeout: 15_000 },
      primaryPlayerSelector
    );
    await waitForAnimationFrames(page);
    const immediateFrame = await readPrimaryCanvasState(page);
    const immediateSource = await readPrimarySourceGeometry(page);
    await new Promise((resolve) => setTimeout(resolve, 900));
    const settledFrame = await readPrimaryCanvasState(page);
    const settledSource = await readPrimarySourceGeometry(page);
    if (
      immediateFrame.hash !== settledFrame.hash
      || immediateSource.hash !== settledSource.hash
    ) {
      throw new Error(
        'Reduced-motion did not commit the settled scan frame immediately: '
        + `presentation ${immediateFrame.hash}/${settledFrame.hash}; `
        + `source ${immediateSource.hash}/${settledSource.hash}.`
      );
    }
    const hasScanEndpointGeometry = immediateSource.opaqueFraction > 0.03
      && immediateSource.boundsWidth > 0.25
      && immediateSource.boundsWidth < 0.8
      && immediateSource.boundsHeight > 0.25
      && immediateSource.boundsHeight < 0.8
      && immediateSource.boundsAspect > 0.85
      && immediateSource.boundsAspect < 1.15
      && Math.abs(immediateSource.boundsCenterX - 0.5) < 0.08
      && Math.abs(immediateSource.boundsCenterY - 0.5) < 0.08;
    if (!hasScanEndpointGeometry) {
      throw new Error(
        `Reduced-motion frame does not have centered square scan geometry: ${JSON.stringify(immediateSource)}.`
      );
    }
    if (pageErrors.length > 0) {
      throw new Error(
        `Reduced-motion consumer page raised an exception:\n${pageErrors.join('\n\n')}`
      );
    }
  } finally {
    await page.close();
  }
}

async function verifyScannableLogoSizes(browser) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });

  try {
    const logoRequests = await interceptFixtureLogoRequests(page);
    await page.setViewport({ width: 1100, height: 760, deviceScaleFactor: 1 });
    await page.goto(`${url}?scan-test`, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });
    await waitForConsumerReady(page);
    const initialBorderState = await page.$eval('.consumer-shell', (element) => ({
      enabled: element.getAttribute('data-border-enabled'),
      pressed: document.querySelector('[data-action="toggle-border"]')
        ?.getAttribute('aria-pressed'),
    }));
    if (initialBorderState.enabled !== 'true' || initialBorderState.pressed !== 'true') {
      throw new Error(
        `The primary Border toggle did not initialize enabled: ${JSON.stringify(initialBorderState)}.`
      );
    }
    await page.click('[data-action="toggle-border"]');
    await page.waitForFunction(
      () => {
        const shell = document.querySelector('.consumer-shell');
        const toggle = document.querySelector('[data-action="toggle-border"]');
        return shell?.getAttribute('data-border-enabled') === 'false'
          && toggle?.getAttribute('aria-pressed') === 'false';
      },
      { timeout: 15_000 }
    );
    for (const [action, attribute] of [
      ['toggle-title', 'data-title-enabled'],
      ['toggle-content', 'data-content-enabled'],
    ]) {
      await page.click(`[data-action="${action}"]`);
      await page.waitForFunction(
        (stateAttribute, actionName) => {
          const shell = document.querySelector('.consumer-shell');
          const toggle = document.querySelector(`[data-action="${actionName}"]`);
          return shell?.getAttribute(stateAttribute) === 'false'
            && toggle?.getAttribute('aria-pressed') === 'false';
        },
        { timeout: 15_000 },
        attribute,
        action
      );
    }
    await page.$eval(primaryPlayerSelector, (element) => element.focus());
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      (selector) => document.querySelector(selector)?.classList.contains('view-scan') === true,
      { timeout: 15_000 },
      primaryPlayerSelector
    );
    await new Promise((resolve) => setTimeout(resolve, 900));

    await page.click('[data-action="toggle-transparent"]');
    await page.waitForFunction(
      () => document.querySelector('.consumer-shell')
        ?.getAttribute('data-transparent-background') === 'true',
      { timeout: 15_000 }
    );
    await page.waitForFunction(() => {
      const canvas = document.querySelector(
        '.consumer-player:first-of-type .designqr-presentation-canvas'
      );
      if (!(canvas instanceof HTMLCanvasElement)) return false;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      return context?.getImageData(0, 0, 1, 1).data[3] === 0;
    }, { timeout: 15_000 });

    const decoded = await inspectPrimaryQR(page);
    if (decoded?.data !== 'https://example.com/primary') {
      throw new Error(
        `The transparent QR did not preserve its exact payload: ${decoded?.data ?? 'no result'}.`
      );
    }
    const matrixBounds = await readPrimaryOpaqueBounds(page);
    const location = decoded.location;
    const distance = (from, to) => Math.hypot(to.x - from.x, to.y - from.y);
    const gridSize = QRCode.create('https://example.com/primary', {
      errorCorrectionLevel: 'H',
    }).modules.size;
    const moduleWidth = (
      distance(location.topLeftCorner, location.topRightCorner)
      + distance(location.bottomLeftCorner, location.bottomRightCorner)
    ) / (2 * gridSize);
    const moduleHeight = (
      distance(location.topLeftCorner, location.bottomLeftCorner)
      + distance(location.topRightCorner, location.bottomRightCorner)
    ) / (2 * gridSize);
    const matrixFillMargins = [
      ((location.topLeftCorner.x + location.bottomLeftCorner.x) * 0.5
        - matrixBounds.minX) / moduleWidth,
      (matrixBounds.maxX + 1
        - (location.topRightCorner.x + location.bottomRightCorner.x) * 0.5)
        / moduleWidth,
      ((location.topLeftCorner.y + location.topRightCorner.y) * 0.5
        - matrixBounds.minY) / moduleHeight,
      (matrixBounds.maxY + 1
        - (location.bottomLeftCorner.y + location.bottomRightCorner.y) * 0.5)
        / moduleHeight,
    ];
    if (
      Math.abs(
        (matrixBounds.maxX - matrixBounds.minX)
        - (matrixBounds.maxY - matrixBounds.minY)
      ) > 2
      || matrixFillMargins.some((margin) => Math.abs(margin) > 0.75)
    ) {
      throw new Error(
        'The transparent QR fill extends beyond the matrix footprint: '
        + JSON.stringify({ matrixBounds, gridSize, matrixFillMargins })
      );
    }

    await page.click('[data-action="toggle-border"]');
    await page.waitForFunction(
      () => {
        const shell = document.querySelector('.consumer-shell');
        const toggle = document.querySelector('[data-action="toggle-border"]');
        return shell?.getAttribute('data-border-enabled') === 'true'
          && toggle?.getAttribute('aria-pressed') === 'true';
      },
      { timeout: 15_000 }
    );
    await waitForAnimationFrames(page);
    const borderedDecoded = await inspectPrimaryQR(page, '#000000');
    if (borderedDecoded?.data !== 'https://example.com/primary') {
      throw new Error(
        'The enabled Border did not preserve the exact payload over a dark host: '
        + `${borderedDecoded?.data ?? 'no result'}.`
      );
    }
    const borderBounds = await readPrimaryOpaqueBounds(page);
    const borderedLocation = borderedDecoded.location;
    const borderMargins = [
      ((borderedLocation.topLeftCorner.x + borderedLocation.bottomLeftCorner.x) * 0.5
        - borderBounds.minX) / moduleWidth,
      (borderBounds.maxX + 1
        - (borderedLocation.topRightCorner.x + borderedLocation.bottomRightCorner.x) * 0.5)
        / moduleWidth,
      ((borderedLocation.topLeftCorner.y + borderedLocation.topRightCorner.y) * 0.5
        - borderBounds.minY) / moduleHeight,
      (borderBounds.maxY + 1
        - (borderedLocation.bottomLeftCorner.y + borderedLocation.bottomRightCorner.y) * 0.5)
        / moduleHeight,
    ];
    if (borderMargins.some((margin) => margin < 3.5)) {
      throw new Error(
        'The enabled Border does not keep four clear modules around the matrix: '
        + JSON.stringify({ borderBounds, gridSize, borderMargins })
      );
    }

    await page.click('[data-action="toggle-border"]');
    await page.waitForFunction(
      () => document.querySelector('.consumer-shell')
        ?.getAttribute('data-border-enabled') === 'false',
      { timeout: 15_000 }
    );

    for (const [action, size] of [
      ['logo-size-min', '0.08'],
      ['logo-size-default', '0.16'],
      ['logo-size-max', '0.2'],
    ]) {
      await page.click(`[data-action="${action}"]`);
      await page.waitForFunction(
        (expectedSize) => document.querySelector('.consumer-shell')
          ?.getAttribute('data-logo-size') === expectedSize,
        { timeout: 15_000 },
        size
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
      const logoState = await readPrimaryCanvasState(page);
      if (logoState.greenCount <= 100) {
        throw new Error(
          `The path-loaded logo is missing at size ${size}: ${JSON.stringify(logoState)}.`
        );
      }
      const decodedValue = await decodePrimaryQR(page);
      if (decodedValue !== 'https://example.com/primary') {
        throw new Error(
          `High-contrast QR decode failed at logo size ${size}: ${decodedValue ?? 'no result'}.`
        );
      }
    }

    if (logoRequests.sameOriginRequestCount < 1) {
      throw new Error('The scanability page did not request the same-origin logo path.');
    }
    const logoError = await page.$eval(
      '.consumer-shell',
      (element) => element.getAttribute('data-logo-error')
    );
    if (logoError) {
      throw new Error(`The same-origin logo path failed to load: ${logoError}.`);
    }

    if (pageErrors.length > 0) {
      throw new Error(
        `High-contrast consumer page raised an exception:\n${pageErrors.join('\n\n')}`
      );
    }
  } finally {
    await page.close();
  }
}

const viteBin = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const configPath = join(
  projectRoot,
  'examples',
  'react-vite-consumer',
  'vite.config.ts'
);
const preview = spawn(
  process.execPath,
  [
    viteBin,
    'preview',
    '--config',
    configPath,
    '--host',
    host,
    '--port',
    String(port),
    '--strictPort',
  ],
  { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] }
);
preview.stdout.on('data', (chunk) => { previewLog += chunk.toString(); });
preview.stderr.on('data', (chunk) => { previewLog += chunk.toString(); });

let browser;
try {
  await waitForPreview(preview);
  browser = await puppeteer.launch({
    executablePath: await findChrome(),
    headless: true,
    protocolTimeout: 15_000,
    args: [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--enable-unsafe-swiftshader',
    ],
  });
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  const logoRequests = await interceptFixtureLogoRequests(page, true);
  await page.setViewport({ width: 1100, height: 760, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.waitForFunction(
    () => document.querySelectorAll('.designqr-presentation-canvas').length === 2,
    { timeout: 15_000 }
  );
  try {
    await page.waitForFunction(
      () => Number(document.querySelector('.consumer-shell')?.getAttribute('data-ready-count')) >= 2,
      { timeout: 15_000 }
    );
  } catch (cause) {
    const readyCount = await page.$eval(
      '.consumer-shell',
      (element) => element.getAttribute('data-ready-count')
    );
    throw new Error(
      `DesignQR ready callbacks stalled at ${readyCount}. `
      + `Console: ${consoleErrors.join(' | ') || 'none'}. `
      + `Page errors: ${pageErrors.join(' | ') || 'none'}.`,
      { cause }
    );
  }

  await page.waitForFunction(
    () => document.querySelector('.consumer-shell')
      ?.getAttribute('data-failure-error-code') === 'QR_GENERATION_FAILED',
    { timeout: 15_000 }
  );
  const generationFailure = await page.$eval(
    '[data-fixture="generation-failure"]',
    (fixture) => {
      const alert = fixture.querySelector('[role="alert"]');
      return {
        errorCode: alert?.getAttribute('data-designqr-error-code'),
        failureReadyCount: document.querySelector('.consumer-shell')
          ?.getAttribute('data-failure-ready-count'),
        webglCanvasCount: fixture.querySelectorAll('.designqr-webgl-canvas').length,
        presentationCanvasCount: fixture.querySelectorAll(
          '.designqr-presentation-canvas'
        ).length,
        text: alert?.textContent?.trim(),
        substitutedHomepage: fixture.textContent?.includes(
          'https://design.johnson7543.com'
        ),
      };
    }
  );
  if (
    generationFailure.errorCode !== 'QR_GENERATION_FAILED'
    || generationFailure.failureReadyCount !== '0'
    || generationFailure.webglCanvasCount !== 0
    || generationFailure.presentationCanvasCount !== 0
    || generationFailure.text !== 'Unable to generate this DesignQR'
    || generationFailure.substitutedHomepage
  ) {
    throw new Error(
      `The QR generation failure contract failed: ${JSON.stringify(generationFailure)}.`
    );
  }

  const initialViews = await page.$$eval(
    '[data-fixture="primary"] .designqr-root, [data-fixture="secondary"] .designqr-root',
    (elements) => elements.map((element) => element.classList.contains('view-scan'))
  );
  if (initialViews.length !== 2 || initialViews[0] || !initialViews[1]) {
    throw new Error(`Independent initial views failed: ${JSON.stringify(initialViews)}.`);
  }

  const initialDetailsControls = await page.$eval('.consumer-shell', (shell) => ({
    titleEnabled: shell.getAttribute('data-title-enabled'),
    titleScale: shell.getAttribute('data-title-scale'),
    contentEnabled: shell.getAttribute('data-content-enabled'),
    contentScale: shell.getAttribute('data-content-scale'),
    titlePressed: document.querySelector('[data-action="toggle-title"]')
      ?.getAttribute('aria-pressed'),
    contentPressed: document.querySelector('[data-action="toggle-content"]')
      ?.getAttribute('aria-pressed'),
    title: document.querySelector('[data-field="primary-title"]')?.value,
    value: document.querySelector('[data-field="primary-value"]')?.value,
    titleScaleControl: (() => {
      const input = document.querySelector('[data-field="primary-title-scale"]');
      return input instanceof HTMLInputElement
        ? { value: input.value, min: input.min, max: input.max, step: input.step }
        : null;
    })(),
    contentScaleControl: (() => {
      const input = document.querySelector('[data-field="primary-content-scale"]');
      return input instanceof HTMLInputElement
        ? { value: input.value, min: input.min, max: input.max, step: input.step }
        : null;
    })(),
  }));
  if (
    initialDetailsControls.titleEnabled !== 'true'
    || initialDetailsControls.contentEnabled !== 'true'
    || initialDetailsControls.titlePressed !== 'true'
    || initialDetailsControls.contentPressed !== 'true'
    || initialDetailsControls.titleScale !== '1'
    || initialDetailsControls.contentScale !== '1'
    || initialDetailsControls.title !== 'Primary DesignQR'
    || initialDetailsControls.value !== 'https://example.com/primary'
    || JSON.stringify(initialDetailsControls.titleScaleControl)
      !== JSON.stringify({ value: '1', min: '0.75', max: '1.5', step: '0.05' })
    || JSON.stringify(initialDetailsControls.contentScaleControl)
      !== JSON.stringify({ value: '1', min: '0.75', max: '1.5', step: '0.05' })
  ) {
    throw new Error(
      `The title/content controls did not initialize correctly: ${JSON.stringify(initialDetailsControls)}.`
    );
  }

  await page.click('[data-action="details-long"]');
  await page.waitForFunction(
    () => {
      const shell = document.querySelector('.consumer-shell');
      const primary = document.querySelector('[data-fixture="primary"] .designqr-root');
      return Number(shell?.getAttribute('data-primary-title-length')) > 40
        && Number(shell?.getAttribute('data-primary-value-byte-length')) > 70
        && primary !== null
        && !primary.classList.contains('designqr-error');
    },
    { timeout: 15_000 }
  );
  const longDetailsControls = await page.$eval('.consumer-shell', (shell) => ({
    titleLength: Number(shell.getAttribute('data-primary-title-length')),
    valueByteLength: Number(shell.getAttribute('data-primary-value-byte-length')),
    titleCounter: document.querySelector('[data-output="primary-title-length"]')
      ?.textContent?.trim(),
    valueCounter: document.querySelector('[data-output="primary-value-length"]')
      ?.textContent?.trim(),
  }));
  if (
    longDetailsControls.titleLength <= 40
    || longDetailsControls.valueByteLength <= 70
    || !longDetailsControls.titleCounter?.includes('package maximum 40')
    || !longDetailsControls.valueCounter?.includes('config maximum 2048')
  ) {
    throw new Error(
      `The detail length fixture did not expose its boundaries: ${JSON.stringify(longDetailsControls)}.`
    );
  }

  for (const [action, attribute] of [
    ['toggle-title', 'data-title-enabled'],
    ['toggle-content', 'data-content-enabled'],
  ]) {
    await page.click(`[data-action="${action}"]`);
    await page.waitForFunction(
      (stateAttribute, actionName) => {
        const shell = document.querySelector('.consumer-shell');
        const toggle = document.querySelector(`[data-action="${actionName}"]`);
        return shell?.getAttribute(stateAttribute) === 'false'
          && toggle?.getAttribute('aria-pressed') === 'false';
      },
      { timeout: 15_000 },
      attribute,
      action
    );
    await page.click(`[data-action="${action}"]`);
    await page.waitForFunction(
      (stateAttribute, actionName) => {
        const shell = document.querySelector('.consumer-shell');
        const toggle = document.querySelector(`[data-action="${actionName}"]`);
        return shell?.getAttribute(stateAttribute) === 'true'
          && toggle?.getAttribute('aria-pressed') === 'true';
      },
      { timeout: 15_000 },
      attribute,
      action
    );
  }

  await page.click('[data-action="details-reset"]');
  await page.waitForFunction(
    () => document.querySelector('[data-field="primary-title"]')?.value === 'Primary DesignQR'
      && document.querySelector('[data-field="primary-value"]')?.value
        === 'https://example.com/primary',
    { timeout: 15_000 }
  );

  const viewerContract = await page.evaluate((selectors, styleProperties) => {
    const primary = document.querySelector(selectors.primary);
    const secondary = document.querySelector(selectors.secondary);
    const presentation = primary?.querySelector('.designqr-presentation-canvas');
    if (!(primary instanceof HTMLElement)) throw new Error('The primary viewer root is missing.');
    if (!(secondary instanceof HTMLElement)) throw new Error('The secondary viewer root is missing.');
    if (!(presentation instanceof HTMLCanvasElement)) {
      throw new Error('The primary presentation canvas is missing.');
    }

    const primaryStyle = getComputedStyle(primary);
    const secondaryStyle = getComputedStyle(secondary);
    const presentationStyle = getComputedStyle(presentation);
    return {
      primary: {
        role: primary.getAttribute('role'),
        ariaLabel: primary.getAttribute('aria-label'),
        tabIndex: primary.tabIndex,
        cursor: primaryStyle.cursor,
      },
      secondary: {
        role: secondary.getAttribute('role'),
        tabIndex: secondary.tabIndex,
        cursor: secondaryStyle.cursor,
      },
      packageStyles: Object.fromEntries(styleProperties.map((property) => [
        property,
        presentationStyle.getPropertyValue(property).trim(),
      ])),
    };
  }, {
    primary: primaryPlayerSelector,
    secondary: secondaryPlayerSelector,
  }, packageStyleProperties);

  if (
    viewerContract.primary.role !== 'button'
    || viewerContract.primary.ariaLabel !== 'Primary interactive DesignQR'
    || viewerContract.primary.tabIndex !== 0
    || viewerContract.primary.cursor !== 'grab'
  ) {
    throw new Error(`Interactive viewer semantics failed: ${JSON.stringify(viewerContract.primary)}.`);
  }
  if (
    viewerContract.secondary.role === 'button'
    || viewerContract.secondary.tabIndex !== -1
    || viewerContract.secondary.cursor !== 'default'
  ) {
    throw new Error(`Disabled viewer semantics failed: ${JSON.stringify(viewerContract.secondary)}.`);
  }
  const missingPackageStyles = Object.entries(viewerContract.packageStyles)
    .filter(([, value]) => value.length === 0)
    .map(([property]) => property);
  if (missingPackageStyles.length > 0) {
    throw new Error(
      `Published DesignQR CSS is missing package-owned values: ${missingPackageStyles.join(', ')}.`
    );
  }

  const opaqueAlpha = await readPrimaryAlphaState(page);
  if (opaqueAlpha.corners.some((alpha) => alpha !== 255)) {
    throw new Error(`The default presentation background is not opaque: ${JSON.stringify(opaqueAlpha)}.`);
  }

  await page.click('[data-action="pause-primary"]');
  await page.waitForFunction(
    () => document.querySelector('.consumer-shell')
      ?.getAttribute('data-primary-paused') === 'true',
    { timeout: 15_000 }
  );
  await page.click('[data-action="toggle-transparent"]');
  await page.waitForFunction(
    () => document.querySelector('.consumer-shell')
      ?.getAttribute('data-transparent-background') === 'true',
    { timeout: 15_000 }
  );
  await page.waitForFunction(() => {
    const canvas = document.querySelector(
      '.consumer-player:first-of-type .designqr-presentation-canvas'
    );
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    return context?.getImageData(0, 0, 1, 1).data[3] === 0;
  }, { timeout: 15_000 });
  const transparentAlpha = await readPrimaryAlphaState(page);
  if (
    transparentAlpha.corners.some((alpha) => alpha !== 0)
    || transparentAlpha.center === 0
  ) {
    throw new Error(
      `Transparent mode did not preserve artwork over zero-alpha corners while paused: ${JSON.stringify(transparentAlpha)}.`
    );
  }

  await page.click('[data-action="verify-export"]');
  await page.waitForFunction(
    () => document.querySelector('.consumer-shell')
      ?.getAttribute('data-export-status') !== 'idle',
    { timeout: 15_000 }
  );
  const transparentExport = await page.$eval('.consumer-shell', (element) => ({
    status: element.getAttribute('data-export-status'),
    cornerAlpha: element.getAttribute('data-export-corner-alpha'),
  }));
  if (transparentExport.status !== 'matched' || transparentExport.cornerAlpha !== '0') {
    throw new Error(
      `Transparent PNG export did not match the visible alpha surface: ${JSON.stringify(transparentExport)}.`
    );
  }

  await page.click('[data-action="toggle-transparent"]');
  await page.waitForFunction(() => {
    const shell = document.querySelector('.consumer-shell');
    const canvas = document.querySelector(
      '.consumer-player:first-of-type .designqr-presentation-canvas'
    );
    if (
      shell?.getAttribute('data-transparent-background') !== 'false'
      || !(canvas instanceof HTMLCanvasElement)
    ) return false;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    return context?.getImageData(0, 0, 1, 1).data[3] === 255;
  }, { timeout: 15_000 });
  await page.click('[data-action="resume-primary"]');

  // Set keyboard modality before programmatically selecting the viewer target.
  await page.keyboard.press('Tab');
  await page.$eval(primaryPlayerSelector, (element) => element.focus());
  const focusState = await page.$eval(primaryPlayerSelector, (element) => {
    const style = getComputedStyle(element);
    const outlineVisible = style.outlineStyle !== 'none'
      && Number.parseFloat(style.outlineWidth) > 0;
    return {
      active: document.activeElement === element,
      focusVisible: element.matches(':focus-visible'),
      visual: outlineVisible || style.boxShadow !== 'none',
      outline: `${style.outlineStyle} ${style.outlineWidth}`,
      boxShadow: style.boxShadow,
    };
  });
  if (!focusState.active || !focusState.focusVisible || !focusState.visual) {
    throw new Error(`Viewer keyboard focus is not visible: ${JSON.stringify(focusState)}.`);
  }

  await page.keyboard.press('Enter');
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.classList.contains('view-scan') === true,
    { timeout: 15_000 },
    primaryPlayerSelector
  );
  const scanCursor = await page.$eval(
    primaryPlayerSelector,
    (element) => getComputedStyle(element).cursor
  );
  if (scanCursor !== 'pointer') {
    throw new Error(`Interactive scan cursor should be pointer, received ${scanCursor}.`);
  }

  const scrollBeforeSpace = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Space');
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.classList.contains('view-scan') === false,
    { timeout: 15_000 },
    primaryPlayerSelector
  );
  const scrollAfterSpace = await page.evaluate(() => window.scrollY);
  if (Math.abs(scrollAfterSpace - scrollBeforeSpace) > 1) {
    throw new Error(
      `Space toggled the viewer but also scrolled the page: ${scrollBeforeSpace} -> ${scrollAfterSpace}.`
    );
  }

  await page.$eval(secondaryPlayerSelector, (element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));
    element.dispatchEvent(new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    }));
  });
  await waitForAnimationFrames(page);
  const secondaryStayedInScan = await page.$eval(
    secondaryPlayerSelector,
    (element) => element.classList.contains('view-scan')
  );
  if (!secondaryStayedInScan) {
    throw new Error('The non-interactive viewer responded to a keyboard toggle.');
  }
  await verifyReducedMotionViewer(browser);
  await verifyScannableLogoSizes(browser);

  const defaultSizing = await page.evaluate(() => {
    const host = document.createElement('div');
    host.style.width = '240px';
    const probe = document.createElement('div');
    probe.className = 'designqr-root';
    host.appendChild(probe);
    document.body.appendChild(host);

    const defaultRect = probe.getBoundingClientRect();
    probe.style.aspectRatio = '2 / 1';
    const customRect = probe.getBoundingClientRect();
    host.remove();
    return {
      defaultWidth: defaultRect.width,
      defaultHeight: defaultRect.height,
      customWidth: customRect.width,
      customHeight: customRect.height,
    };
  });
  if (
    Math.abs(defaultSizing.defaultWidth - 240) > 0.75
    || Math.abs(defaultSizing.defaultHeight - 240) > 0.75
    || Math.abs(defaultSizing.customWidth - 240) > 0.75
    || Math.abs(defaultSizing.customHeight - 120) > 0.75
  ) {
    throw new Error(`Default/custom component sizing failed: ${JSON.stringify(defaultSizing)}.`);
  }

  await page.waitForFunction(() => {
    const canvas = document.querySelector(
      '.consumer-player:first-of-type .designqr-presentation-canvas'
    );
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (
        pixels[index] < 45
        && pixels[index + 1] > 115
        && pixels[index + 1] < 190
        && pixels[index + 2] < 100
      ) count += 1;
    }
    return count > 100;
  }, { timeout: 15_000 });
  const treeLogoState = await readPrimaryCanvasState(page);
  if (treeLogoState.greenCount <= 100) {
    throw new Error(`The 3D logo did not render: ${JSON.stringify(treeLogoState)}.`);
  }
  if (logoRequests.sameOriginRequestCount < 1) {
    throw new Error('The same-origin logo path was not requested.');
  }

  await page.click('button:nth-of-type(1)');
  await new Promise((resolve) => setTimeout(resolve, 350));
  const midTurnLogoState = await readPrimaryCanvasState(page);
  if (midTurnLogoState.greenCount <= 100) {
    throw new Error(`The logo disappeared during the forward turn: ${JSON.stringify(midTurnLogoState)}.`);
  }
  await page.waitForFunction(
    () => document.querySelectorAll('.designqr-root.view-scan').length === 2,
    { timeout: 15_000 }
  );
  await new Promise((resolve) => setTimeout(resolve, 650));
  const qrLogoState = await readPrimaryCanvasState(page);
  if (
    qrLogoState.greenCount <= 100
    || qrLogoState.greenCenterX === null
    || qrLogoState.greenCenterY === null
    || Math.abs(qrLogoState.greenCenterX - 0.5) > 0.06
    || Math.abs(qrLogoState.greenCenterY - 0.5) > 0.06
  ) {
    throw new Error(`The 2D logo is not centered on the QR: ${JSON.stringify(qrLogoState)}.`);
  }

  await page.click('button:nth-of-type(1)');
  await new Promise((resolve) => setTimeout(resolve, 350));
  const reverseTurnLogoState = await readPrimaryCanvasState(page);
  if (reverseTurnLogoState.greenCount <= 100) {
    throw new Error(`The logo disappeared during the reverse turn: ${JSON.stringify(reverseTurnLogoState)}.`);
  }
  await page.waitForFunction(
    () => document.querySelectorAll('.designqr-root.view-scan').length === 1,
    { timeout: 15_000 }
  );
  await new Promise((resolve) => setTimeout(resolve, 650));
  await page.click('button:nth-of-type(1)');
  await page.waitForFunction(
    () => document.querySelectorAll('.designqr-root.view-scan').length === 2,
    { timeout: 15_000 }
  );
  await new Promise((resolve) => setTimeout(resolve, 900));

  const logoSizeStates = [];
  for (const [action, size] of [
    ['logo-size-min', '0.08'],
    ['logo-size-default', '0.16'],
    ['logo-size-max', '0.2'],
  ]) {
    await page.click(`[data-action="${action}"]`);
    await page.waitForFunction(
      (expectedSize) => document.querySelector('.consumer-shell')
        ?.getAttribute('data-logo-size') === expectedSize,
      { timeout: 15_000 },
      size
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    logoSizeStates.push({ size, state: await readPrimaryCanvasState(page) });
  }
  if (
    logoSizeStates[0].state.greenCount <= 100
    || logoSizeStates[0].state.greenCount >= logoSizeStates[1].state.greenCount
    || logoSizeStates[1].state.greenCount >= logoSizeStates[2].state.greenCount
  ) {
    throw new Error(`Logo size changes were not visible: ${JSON.stringify(logoSizeStates)}.`);
  }
  await page.click('[data-action="logo-size-default"]');

  const logoBeforeRemoval = await readPrimaryCanvasState(page);
  await page.click('[data-action="logo-none"]');
  await page.waitForFunction(
    () => document.querySelector('.consumer-shell')?.getAttribute('data-logo-mode') === 'none',
    { timeout: 15_000 }
  );
  await new Promise((resolve) => setTimeout(resolve, 150));
  const logoAfterRemoval = await readPrimaryCanvasState(page);
  if (logoBeforeRemoval.hash === logoAfterRemoval.hash) {
    throw new Error('Removing the logo did not update the rendered frame.');
  }

  await page.click('[data-action="logo-pink"]');
  await page.waitForFunction(
    () => document.querySelector('.consumer-shell')?.getAttribute('data-logo-mode') === 'pink',
    { timeout: 15_000 }
  );
  await page.waitForFunction(
    (withoutLogoHash) => {
      const canvas = document.querySelector(
        '.consumer-player:first-of-type .designqr-presentation-canvas'
      );
      if (!(canvas instanceof HTMLCanvasElement)) return false;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return false;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261;
      for (let index = 0; index < pixels.length; index += 64) {
        hash ^= pixels[index];
        hash = Math.imul(hash, 16777619);
        hash ^= pixels[index + 1];
        hash = Math.imul(hash, 16777619);
        hash ^= pixels[index + 2];
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0) !== withoutLogoHash;
    },
    { timeout: 15_000 },
    logoAfterRemoval.hash
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  await storePrimarySourceSnapshot(page);
  await page.click('button:nth-of-type(1)');
  await page.waitForFunction(
    () => document.querySelectorAll('.designqr-root.view-scan').length === 1,
    { timeout: 15_000 }
  );
  await new Promise((resolve) => setTimeout(resolve, 650));
  await page.click('button:nth-of-type(1)');
  await page.waitForFunction(
    () => document.querySelectorAll('.designqr-root.view-scan').length === 2,
    { timeout: 15_000 }
  );
  await new Promise((resolve) => setTimeout(resolve, 900));
  const roundTripLogoColors = await comparePrimarySourceSnapshot(page);
  if (
    roundTripLogoColors.meanChannelDelta >= 0.5
    || roundTripLogoColors.changedFraction >= 0.005
  ) {
    throw new Error(
      `Logo-enabled 2D colors changed after a view round trip: ${JSON.stringify(roundTripLogoColors)}.`
    );
  }

  await page.click('[data-action="logo-rapid"]');
  await page.waitForFunction(
    () => document.querySelector('.consumer-shell')?.getAttribute('data-logo-mode') === 'green',
    { timeout: 15_000 }
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  const rapidReplacementState = await readPrimaryCanvasState(page);
  if (rapidReplacementState.greenCount <= 100) {
    throw new Error(`Rapid logo replacement left a stale frame: ${JSON.stringify(rapidReplacementState)}.`);
  }

  await page.click('[data-action="logo-cors-failure"]');
  await page.waitForFunction(
    () => document.querySelector('.consumer-shell')?.getAttribute('data-logo-error') === 'LOGO_LOAD_FAILED',
    { timeout: 15_000 }
  );
  if (await page.$eval(
    '.consumer-player:first-of-type',
    (element) => element.querySelectorAll('.designqr-presentation-canvas').length !== 1
  )) {
    throw new Error('A failed logo load removed the usable DesignQR presentation.');
  }
  await page.click('[data-action="logo-green"]');
  await page.waitForFunction(
    () => document.querySelector('.consumer-shell')?.getAttribute('data-logo-error') === '',
    { timeout: 15_000 }
  );
  await new Promise((resolve) => setTimeout(resolve, 300));

  await page.click('button:nth-of-type(3)');
  await page.waitForFunction(
    () => document.querySelectorAll('.designqr-presentation-canvas').length === 1,
    { timeout: 15_000 }
  );
  await page.click('button:nth-of-type(3)');
  await page.waitForFunction(
    () => document.querySelectorAll('.designqr-presentation-canvas').length === 2,
    { timeout: 15_000 }
  );

  await page.click('button:nth-of-type(4)');
  await page.waitForFunction(
    () => document.querySelector('.consumer-shell')?.getAttribute('data-export-status') !== 'idle',
    { timeout: 15_000 }
  );
  const exportStatus = await page.$eval(
    '.consumer-shell',
    (element) => element.getAttribute('data-export-status')
  );
  if (exportStatus !== 'matched') {
    throw new Error(`Public export comparison finished with status ${exportStatus}.`);
  }
  if (pageErrors.length > 0) {
    throw new Error(`Consumer page raised an exception:\n${pageErrors.join('\n\n')}`);
  }

  await page.close();
  console.log('DesignQR React consumer passed: package styling, keyboard and pointer semantics, reduced motion, sizing, animated logo lifecycle, two instances, views, remount, and WYSIWYG export.');
} finally {
  await browser?.close().catch(() => undefined);
  preview.kill('SIGTERM');
}
