import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const host = '127.0.0.1';
const port = Number(process.env.DESIGNQR_CONSUMER_PORT ?? 4174);
const url = `http://${host}:${port}`;
let previewLog = '';

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

  const initialViews = await page.$$eval('.designqr-root', (elements) => (
    elements.map((element) => element.classList.contains('view-scan'))
  ));
  if (initialViews.length !== 2 || initialViews[0] || !initialViews[1]) {
    throw new Error(`Independent initial views failed: ${JSON.stringify(initialViews)}.`);
  }

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

  await page.click('button:nth-of-type(1)');
  await page.waitForFunction(
    () => document.querySelectorAll('.designqr-root.view-scan').length === 2,
    { timeout: 15_000 }
  );

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
  console.log('DesignQR React consumer passed: sizing defaults, two instances, views, remount, and WYSIWYG export.');
} finally {
  await browser?.close().catch(() => undefined);
  preview.kill('SIGTERM');
}
