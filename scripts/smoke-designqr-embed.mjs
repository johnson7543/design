import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const host = '127.0.0.1';
const appPort = Number(process.env.DESIGNQR_EMBED_APP_PORT ?? 4175);
const consumerPort = Number(process.env.DESIGNQR_EMBED_CONSUMER_PORT ?? 4176);
const appOrigin = `http://${host}:${appPort}`;
const consumerOrigin = `http://${host}:${consumerPort}`;
const wranglerState = await mkdtemp(join(tmpdir(), 'designqr-wrangler-'));
const logs = { app: '', consumer: '' };

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  throw new Error('Chrome was not found for the DesignQR iframe smoke test.');
}

async function waitForServer(process, url, readLog, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`Preview exited with code ${process.exitCode}.\n${readLog()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Preview did not become ready at ${url}.\n${readLog()}`);
}

async function responseHeaders(path) {
  const response = await fetch(new URL(path, appOrigin));
  assert(response.ok, `${path} returned ${response.status}.`);
  return response.headers;
}

async function verifyHeaders() {
  for (const path of ['/', '/qr']) {
    const headers = await responseHeaders(path);
    assert(
      headers.get('x-frame-options')?.toLowerCase() === 'sameorigin',
      `${path} must keep X-Frame-Options: SAMEORIGIN.`
    );
    assert(
      headers.get('content-security-policy')?.includes("frame-ancestors 'self'"),
      `${path} must keep the self-only CSP frame policy.`
    );
  }

  const embedHeaders = await responseHeaders('/qr/embed?config=invalid');
  const embedCsp = embedHeaders.get('content-security-policy') ?? '';
  assert(
    embedHeaders.get('x-frame-options') === null,
    '/qr/embed must detach X-Frame-Options.'
  );
  assert(
    embedCsp.includes('frame-ancestors *')
      && !embedCsp.includes("frame-ancestors 'self'"),
    '/qr/embed must use only the public CSP frame policy.'
  );
  assert(
    embedHeaders.get('referrer-policy') === 'no-referrer',
    '/qr/embed must use Referrer-Policy: no-referrer.'
  );
  assert(
    embedHeaders.get('permissions-policy')?.includes('camera=()'),
    '/qr/embed must keep browser permissions disabled.'
  );
}

function allowLocalRequests(page) {
  void page.setRequestInterception(true);
  page.on('request', (request) => {
    const requestUrl = new URL(request.url());
    if (
      requestUrl.origin === appOrigin
      || requestUrl.origin === consumerOrigin
      || requestUrl.protocol === 'data:'
    ) {
      void request.continue();
    } else {
      void request.abort();
    }
  });
}

async function canvasHash(frame) {
  return frame.evaluate(async () => {
    const canvas = document.querySelector('.designqr-presentation-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('The embed presentation canvas is missing.');
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The embed presentation canvas did not encode PNG.');
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return Array.from(
      new Uint8Array(digest),
      (byte) => byte.toString(16).padStart(2, '0')
    ).join('');
  });
}

async function verifyCrossOriginEmbed(browser) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  allowLocalRequests(page);

  try {
    await page.setViewport({ width: 1120, height: 760, deviceScaleFactor: 1 });
    const url = new URL(consumerOrigin);
    url.searchParams.set('embedOrigin', appOrigin);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForFunction(
      () => document.querySelector('.iframe-consumer')?.getAttribute('data-ready') === 'true',
      { timeout: 20_000 }
    );
    await page.waitForFunction(
      () => document.querySelector('.iframe-consumer')
        ?.getAttribute('data-early-export-status') === 'complete',
      { timeout: 20_000 }
    );
    const earlyExportMime = await page.$eval(
      '.iframe-consumer',
      (element) => element.getAttribute('data-early-export-mime')
    );
    assert(earlyExportMime === 'image/png', 'An export queued before ready did not resolve.');

    const embedFrame = page.frames().find((frame) => {
      try {
        const frameUrl = new URL(frame.url());
        return frameUrl.origin === appOrigin && frameUrl.pathname === '/qr/embed';
      } catch {
        return false;
      }
    });
    assert(embedFrame, 'The external page did not load the hosted DesignQR frame.');
    await embedFrame.waitForSelector('.designqr-presentation-canvas', { timeout: 20_000 });

    const shell = await embedFrame.evaluate(() => ({
      playerCount: document.querySelectorAll('.designqr-root').length,
      hasEditor: Boolean(document.querySelector('.app-root, .app-header, .design-home')),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }));
    assert(shell.playerCount === 1, 'The embed route must render one DesignQR player.');
    assert(!shell.hasEditor, 'The embed route exposed platform or editor chrome.');
    assert(!shell.overflow, 'The embed route has horizontal overflow.');

    await page.click('#set-config');
    await page.waitForFunction(
      () => document.querySelector('.iframe-consumer')?.getAttribute('data-view') === 'qr',
      { timeout: 20_000 }
    );
    await embedFrame.waitForSelector('.designqr-root.view-scan', { timeout: 20_000 });
    await new Promise((resolve) => setTimeout(resolve, 1_200));

    await page.click('#pause-player');
    await new Promise((resolve) => setTimeout(resolve, 250));
    const displayedHash = await canvasHash(embedFrame);

    await page.click('#export-image');
    await page.waitForFunction(
      () => document.querySelector('.iframe-consumer')
        ?.getAttribute('data-export-status') === 'complete',
      { timeout: 20_000 }
    );
    const exported = await page.$eval('.iframe-consumer', (element) => ({
      mime: element.getAttribute('data-export-mime'),
      bytes: Number(element.getAttribute('data-export-bytes')),
      hash: element.getAttribute('data-export-hash'),
      view: element.getAttribute('data-view'),
      errorCode: element.getAttribute('data-error-code'),
    }));
    assert(exported.mime === 'image/png', 'The iframe export did not return image/png.');
    assert(exported.bytes > 100, 'The iframe export returned an empty PNG.');
    assert(exported.hash === displayedHash, 'The iframe export differs from its visible canvas.');
    assert(exported.view === 'qr', 'Exporting changed the iframe view.');
    assert(!exported.errorCode, `The iframe reported ${exported.errorCode}.`);

    await embedFrame.click('.designqr-root');
    await page.waitForFunction(
      () => document.querySelector('.iframe-consumer')
        ?.getAttribute('data-view') === 'design',
      { timeout: 20_000 }
    );

    assert(pageErrors.length === 0, `Embed page errors:\n${pageErrors.join('\n\n')}`);
    console.log('DesignQR cross-origin iframe, protocol, and WYSIWYG export passed.');
  } finally {
    await page.close();
  }
}

async function verifyInvalidFallback(browser) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  allowLocalRequests(page);

  try {
    await page.goto(`${appOrigin}/qr/embed?config=not_base64!`, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    await page.waitForSelector('.designqr-embed-error', { timeout: 20_000 });
    const message = await page.$eval(
      '.designqr-embed-error',
      (element) => element.textContent?.trim()
    );
    assert(message === 'Invalid DesignQR configuration', 'Invalid config fallback changed.');
    assert(pageErrors.length === 0, `Invalid embed page errors:\n${pageErrors.join('\n\n')}`);
    console.log('DesignQR malformed embed fallback passed.');
  } finally {
    await page.close();
  }
}

const wranglerBin = join(projectRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const viteBin = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const consumerConfig = join(projectRoot, 'examples', 'iframe-consumer', 'vite.config.ts');

const appPreview = spawn(process.execPath, [
  wranglerBin,
  'dev',
  '--local',
  '--ip',
  host,
  '--port',
  String(appPort),
  '--persist-to',
  wranglerState,
  '--log-level',
  'error',
  '--show-interactive-dev-session=false',
], {
  cwd: projectRoot,
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: join(wranglerState, 'logs'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
appPreview.stdout.on('data', (chunk) => { logs.app += chunk.toString(); });
appPreview.stderr.on('data', (chunk) => { logs.app += chunk.toString(); });

const consumerPreview = spawn(process.execPath, [
  viteBin,
  'preview',
  '--config',
  consumerConfig,
  '--host',
  host,
  '--port',
  String(consumerPort),
  '--strictPort',
], { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] });
consumerPreview.stdout.on('data', (chunk) => { logs.consumer += chunk.toString(); });
consumerPreview.stderr.on('data', (chunk) => { logs.consumer += chunk.toString(); });

let browser;
try {
  await Promise.all([
    waitForServer(appPreview, appOrigin, () => logs.app),
    waitForServer(consumerPreview, consumerOrigin, () => logs.consumer),
  ]);
  await verifyHeaders();

  browser = await puppeteer.launch({
    executablePath: await findChrome(),
    headless: true,
    protocolTimeout: 20_000,
    args: [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--enable-unsafe-swiftshader',
    ],
  });
  await verifyCrossOriginEmbed(browser);
  await verifyInvalidFallback(browser);
  console.log('DesignQR hosted-player smoke test passed, including Wrangler headers.');
} finally {
  await browser?.close().catch(() => undefined);
  appPreview.kill('SIGTERM');
  consumerPreview.kill('SIGTERM');
  await rm(wranglerState, { recursive: true, force: true });
}
