import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TREE_THEME_PRESETS } from 'designqr';
import puppeteer from 'puppeteer-core';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const host = '127.0.0.1';
const port = Number(process.env.PREVIEW_PORT ?? 4173);
const url = `http://${host}:${port}`;
const fullThemeParameterNames = Object.keys(TREE_THEME_PRESETS.spring);
const expectedSpringThemeParameterLines = Object.entries(TREE_THEME_PRESETS.spring)
  .map(([parameter, value]) => `  ${parameter}: ${formatSnippetValue(value)},`);
const expectedDefaultAdvancedReactCode = `import { useState } from 'react';
import { DesignQR, type DesignQRView } from 'designqr';
import 'designqr/style.css';

export function InteractiveQRCode() {
  const [view, setView] = useState<DesignQRView>("design");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <>
      <DesignQR
        value="https://design.johnson7543.com"
        design="tree"
        tree={{ shape: "dome", seed: 0.5 }}
        theme="spring"
        view={view}
        details={{ title: "", showValue: false, border: false }}
        interaction={{ dragToRotate: true, tapToToggleView: true, autoRotate: false, autoRotateDirection: "clockwise", transitionSpeed: 1, motionBlur: true }}
        logo={false}
        transparentBackground={false}
        style={{ width: "100%", maxWidth: 480 }}
        ariaLabel="Interactive DesignQR"
        onReady={() => setErrorMessage(null)}
        onViewChange={setView}
        onError={(error) => setErrorMessage(error.message)}
      />
      <button
        type="button"
        onClick={() => setView((current) => current === "design" ? "qr" : "design")}
      >
        {view === "design" ? "Show QR" : "Show tree"}
      </button>
      {errorMessage && <p role="alert">{errorMessage}</p>}
    </>
  );
}`;
const requestedLayoutScenarios = new Set(
  (process.env.DESIGNQR_SMOKE_SCENARIOS ?? '')
    .split(',')
    .map((scenario) => scenario.trim())
    .filter(Boolean)
);
const skipLayout = process.env.DESIGNQR_SMOKE_SKIP_LAYOUT === '1';
const skipWysiwyg = process.env.DESIGNQR_SMOKE_SKIP_WYSIWYG === '1';
let previewLog = '';

function formatSnippetValue(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(formatSnippetValue).join(', ')}]`;
  }
  return `{ ${Object.entries(value).map(
    ([key, child]) => `${key}: ${formatSnippetValue(child)}`
  ).join(', ')} }`;
}

function readCustomThemeParameterLines(code) {
  const match = code.match(
    /const customTheme = createTreeTheme\('spring', \{\n([\s\S]*?)\n\} satisfies ResolvedTreeTheme\);/
  );
  return match
    ? match[1].split('\n').filter((line) => line.trim().length > 0)
    : [];
}

function readReactLogo(code) {
  const match = code.match(
    /const brandLogo = \{\s+src: ("(?:\\.|[^"\\])*"),\s+alt: ("(?:\\.|[^"\\])*"),\s+size: ([\d.]+),?\s+\};/
  );
  if (!match) return null;

  try {
    return {
      src: JSON.parse(match[1]),
      alt: JSON.parse(match[2]),
      size: Number(match[3]),
    };
  } catch {
    return null;
  }
}

function expectedCustomThemeComponent({
  view,
  details,
  logo,
  transparentBackground,
  transitionSpeed = 1,
}) {
  return `export function CustomThemeQRCode() {
  return (
    <DesignQR
      value="https://design.johnson7543.com"
      design="tree"
      tree={{ shape: "dome", seed: 0.5 }}
      theme={customTheme}
      defaultView="${view}"
      details={${formatSnippetValue(details)}}
      interaction={{ dragToRotate: true, tapToToggleView: true, autoRotate: false, autoRotateDirection: "clockwise", transitionSpeed: ${transitionSpeed}, motionBlur: true }}
      logo={${logo}}
      transparentBackground={${transparentBackground}}
      style={{ width: "100%", maxWidth: 480 }}
      ariaLabel="Interactive DesignQR"
    />
  );
}`;
}

async function installClipboardCapture(page) {
  const installed = await page.evaluate(() => {
    window.__designQrClipboardText = '';
    const clipboard = {
      writeText(value) {
        window.__designQrClipboardText = String(value);
        return Promise.resolve();
      },
    };

    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: clipboard,
      });
    } catch {
      try {
        navigator.clipboard.writeText = clipboard.writeText;
      } catch {
        return false;
      }
    }
    return navigator.clipboard?.writeText === clipboard.writeText;
  });

  if (!installed) throw new Error('Clipboard capture could not be installed.');
}

async function clickAndCaptureCopyFeedback(page, selector) {
  return page.evaluate((buttonSelector) => new Promise((resolve) => {
    const button = document.querySelector(buttonSelector);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Copy button was not found: ${buttonSelector}`);
    }

    const readState = () => ({
      label: button.getAttribute('aria-label') ?? '',
      disabled: button.disabled,
    });
    if (button.disabled) {
      resolve(readState());
      return;
    }

    let settled = false;
    let timeoutId = 0;
    const observer = new MutationObserver(() => {
      const state = readState();
      if (state.label !== 'Copied!' && state.label !== 'Try again') return;
      settled = true;
      window.clearTimeout(timeoutId);
      observer.disconnect();
      resolve(state);
    });
    observer.observe(button, {
      attributes: true,
      attributeFilter: ['aria-label'],
    });
    timeoutId = window.setTimeout(() => {
      if (settled) return;
      observer.disconnect();
      resolve(readState());
    }, 15_000);

    button.click();
  }), selector);
}

async function readReactExampleState(page) {
  return page.evaluate(() => {
    const switcher = document.querySelector('.react-example-switcher');
    const copyButton = document.querySelector(
      '.react-code-header .share-copy-icon-btn'
    );
    const code = document.querySelector('[aria-label="DesignQR React code"]');
    if (
      !(switcher instanceof HTMLElement)
      || !(copyButton instanceof HTMLButtonElement)
      || !(code instanceof HTMLElement)
    ) {
      throw new Error('React example controls were not found.');
    }

    const buttons = [...switcher.querySelectorAll('[data-react-example]')];
    const active = buttons.filter(
      (button) => button.getAttribute('aria-pressed') === 'true'
    );
    const recommended = buttons.filter(
      (button) => button.getAttribute('data-recommended') === 'true'
    );
    const recommendedIcon = recommended[0]?.querySelector(
      '.react-example-recommended-icon'
    );
    const switcherBox = switcher.getBoundingClientRect();
    const copyButtonBox = copyButton.getBoundingClientRect();

    return {
      active: active.map((button) => button.getAttribute('data-react-example')),
      recommended: recommended.map(
        (button) => button.getAttribute('data-react-example')
      ),
      recommendedClass: recommended[0]?.classList.contains('recommended') ?? false,
      recommendedLabel: recommended[0]?.getAttribute('aria-label') ?? '',
      recommendedHasIcon: recommendedIcon instanceof SVGElement,
      recommendedAnimation: recommendedIcon
        ? getComputedStyle(recommendedIcon).animationName
        : '',
      copyLabel: copyButton.getAttribute('aria-label') ?? '',
      code: code.textContent ?? '',
      switcherFits: switcher.scrollWidth <= switcher.clientWidth + 1
        && buttons.every((button) => {
          const box = button.getBoundingClientRect();
          return box.left >= switcherBox.left - 1
            && box.right <= switcherBox.right + 1;
        })
        && switcherBox.right <= copyButtonBox.left - 1,
    };
  });
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next known browser location.
    }
  }

  throw new Error('Chrome was not found. Set CHROME_BIN to a Chrome or Chromium executable.');
}

async function waitForPreview(preview, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (preview.exitCode !== null) {
      throw new Error(
        `Vite preview exited early with code ${preview.exitCode}.\n${previewLog.trim()}`
      );
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Vite preview did not become ready at ${url}.`);
}

async function verifyRoute(browser, { path, selectors, expectedTitle }) {
  const page = await browser.newPage();
  const pageErrors = [];
  const appOrigin = new URL(url).origin;

  try {
    page.on('pageerror', (error) => {
      pageErrors.push(error.stack ?? error.message);
    });
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const requestUrl = new URL(request.url());
      if (requestUrl.origin === appOrigin || requestUrl.protocol === 'data:') {
        void request.continue();
      } else {
        void request.abort();
      }
    });

    const routeUrl = new URL(path, url).toString();
    await page.goto(routeUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    for (const selector of selectors) {
      await page.waitForSelector(selector, { timeout: 15_000 });
    }
    await new Promise((resolve) => setTimeout(resolve, 500));

    const title = await page.title();
    if (!title.includes(expectedTitle)) {
      throw new Error(`Expected title to include "${expectedTitle}", received "${title}".`);
    }
    if (pageErrors.length > 0) {
      throw new Error(`Page raised an exception:\n${pageErrors.join('\n\n')}`);
    }

    console.log(`Production route passed: ${routeUrl}`);
  } catch (error) {
    throw new Error(`Production smoke test failed for ${path}: ${error.message}`);
  } finally {
    await page.close();
  }
}

async function verifyAppNavigation(browser) {
  const page = await browser.newPage();
  const appOrigin = new URL(url).origin;

  try {
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const requestUrl = new URL(request.url());
      if (requestUrl.origin === appOrigin || requestUrl.protocol === 'data:') {
        void request.continue();
      } else {
        void request.abort();
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.waitForSelector('.design-catalog-card', { timeout: 15_000 });
    await page.click('.design-catalog-card');
    await page.waitForFunction(() => window.location.pathname === '/qr', { timeout: 15_000 });
    await page.waitForSelector('.app-header .site-header-brand .brand-title', { timeout: 15_000 });

    const brandContract = await page.$eval('.app-header .site-header-brand', (element) => ({
      hasLinkAncestor: element.closest('a') !== null,
      title: element.textContent?.trim(),
    }));
    if (brandContract.hasLinkAncestor || brandContract.title !== 'Design QR') {
      throw new Error('Design QR title must be a non-navigating heading.');
    }

    await page.click('.app-header .site-header-brand');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const pathAfterTitleClick = await page.evaluate(() => window.location.pathname);
    if (pathAfterTitleClick !== '/qr') {
      throw new Error(`Clicking the Design QR title navigated to ${pathAfterTitleClick}.`);
    }

    console.log('Production navigation passed: / → /qr; title remains on /qr.');
  } catch (error) {
    throw new Error(`Production navigation smoke test failed: ${error.message}`);
  } finally {
    await page.close();
  }
}

async function setEditorValue(page, value) {
  await page.$eval('.url-input', (input, nextValue) => {
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('The DesignQR content input is missing.');
    }
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;
    setter?.call(input, nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function verifyDesignQrFailureState(browser) {
  const page = await browser.newPage();
  const pageErrors = [];
  const appOrigin = new URL(url).origin;

  try {
    page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const requestUrl = new URL(request.url());
      if (requestUrl.origin === appOrigin || requestUrl.protocol === 'data:') {
        void request.continue();
      } else {
        void request.abort();
      }
    });

    await page.goto(`${url}/qr`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.waitForSelector('.designqr-presentation-canvas', { timeout: 15_000 });
    await page.click('.share-icon-btn');
    await page.waitForSelector('.share-modal-content', { timeout: 15_000 });

    const oversizedValue = 'a'.repeat(220);
    await setEditorValue(page, oversizedValue);
    await page.waitForSelector(
      '.designqr-editor-error[data-designqr-error-code="QR_GENERATION_FAILED"]',
      { timeout: 15_000 }
    );
    const failure = await page.evaluate((expectedValue) => ({
      inputValue: document.querySelector('.url-input') instanceof HTMLInputElement
        ? document.querySelector('.url-input').value
        : '',
      shareDisabled: document.querySelector('.share-icon-btn') instanceof HTMLButtonElement
        ? document.querySelector('.share-icon-btn').disabled
        : false,
      downloadDisabled: document.querySelector('.share-action-item.primary')
        instanceof HTMLButtonElement
        ? document.querySelector('.share-action-item.primary').disabled
        : false,
      canvasCount: document.querySelectorAll(
        '.designqr-webgl-canvas, .designqr-presentation-canvas'
      ).length,
      controlsPresent: Boolean(document.querySelector('.controls-overlay')),
      message: document.querySelector('.designqr-editor-error')?.textContent?.trim(),
      valueMatches: document.querySelector('.url-input') instanceof HTMLInputElement
        && document.querySelector('.url-input').value === expectedValue,
    }), oversizedValue);
    if (
      failure.inputValue !== oversizedValue
      || !failure.valueMatches
      || !failure.shareDisabled
      || !failure.downloadDisabled
      || failure.canvasCount !== 0
      || !failure.controlsPresent
      || !failure.message?.includes('Unable to generate this DesignQR')
    ) {
      throw new Error(`The editor failure state is incomplete: ${JSON.stringify(failure)}.`);
    }

    await page.click('[data-share-mode="embed"]');
    const embedOutput = await page.evaluate(() => ({
      code: document.querySelector('[aria-label="DesignQR iframe code"]')
        ?.textContent ?? '',
      url: document.querySelector('[aria-label="Hosted DesignQR player URL"]')
        instanceof HTMLInputElement
        ? document.querySelector('[aria-label="Hosted DesignQR player URL"]').value
        : '',
    }));
    if (embedOutput.code || embedOutput.url) {
      throw new Error(`The invalid editor emitted embed output: ${JSON.stringify(embedOutput)}.`);
    }

    await page.click('[data-share-mode="react"]');
    const reactOutput = await page.$eval(
      '[aria-label="DesignQR React code"]',
      (element) => element.textContent ?? ''
    );
    if (reactOutput) {
      throw new Error('The invalid editor emitted a React snippet.');
    }

    await page.click('.modal-close-btn');
    await setEditorValue(page, 'https://example.com/recovered');
    await page.waitForSelector('.designqr-presentation-canvas', { timeout: 15_000 });
    await page.waitForFunction(
      () => document.querySelector('.share-icon-btn') instanceof HTMLButtonElement
        && !document.querySelector('.share-icon-btn').disabled,
      { timeout: 15_000 }
    );

    if (pageErrors.length > 0) {
      throw new Error(`Editor failure page errors:\n${pageErrors.join('\n\n')}`);
    }
    console.log('Design QR editor failure and recovery state passed.');
  } catch (error) {
    throw new Error(`Design QR editor failure smoke test failed: ${error.message}`);
  } finally {
    await page.close();
  }
}

function assertLayout(condition, message) {
  if (!condition) throw new Error(message);
}

function nearlyEqual(actual, expected, tolerance = 0.75) {
  return Math.abs(actual - expected) <= tolerance;
}

async function readStageRect(page) {
  return page.$eval('.designqr-canvas-wrapper', (stage) => {
    const box = stage.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  });
}

async function readSpringQrPaletteSignature(page) {
  return page.$eval('.designqr-presentation-canvas', (canvas) => {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('The 2D QR palette context is unavailable.');
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const totals = {
      green: { count: 0, red: 0, green: 0, blue: 0 },
      pink: { count: 0, red: 0, green: 0, blue: 0 },
    };

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const inLogoArea = x > canvas.width * 0.33
          && x < canvas.width * 0.67
          && y > canvas.height * 0.33
          && y < canvas.height * 0.67;
        if (inLogoArea) continue;
        const index = (y * canvas.width + x) * 4;
        if (pixels[index + 3] <= 240) continue;
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const role = green > red + 8 && green > blue + 8
          ? totals.green
          : red > green + 12 && blue > green + 3
            ? totals.pink
            : null;
        if (!role) continue;
        role.count += 1;
        role.red += red;
        role.green += green;
        role.blue += blue;
      }
    }

    const summarize = (role) => ({
      count: role.count,
      mean: role.count === 0
        ? [Number.NaN, Number.NaN, Number.NaN]
        : [role.red / role.count, role.green / role.count, role.blue / role.count],
    });
    return {
      green: summarize(totals.green),
      pink: summarize(totals.pink),
    };
  });
}

async function verifyLogoCropDialog(page, stageBeforeCrop) {
  await page.waitForSelector('.logo-crop-dialog', { timeout: 15_000 });
  await page.waitForSelector('.logo-crop-apply:not([disabled])', { timeout: 15_000 });
  const state = await page.evaluate(() => {
    const dialog = document.querySelector('.logo-crop-dialog');
    const viewport = document.querySelector('.logo-crop-viewport');
    const stage = document.querySelector('.designqr-canvas-wrapper');
    const actions = Array.from(document.querySelectorAll('.logo-crop-actions button'));
    if (
      !(dialog instanceof HTMLElement)
      || !(viewport instanceof HTMLElement)
      || !(stage instanceof HTMLElement)
      || actions.some((action) => !(action instanceof HTMLButtonElement))
    ) throw new Error('The square Logo crop dialog is incomplete.');
    const dialogBox = dialog.getBoundingClientRect();
    const viewportBox = viewport.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    return {
      role: dialog.getAttribute('role'),
      modal: dialog.getAttribute('aria-modal'),
      dialog: {
        left: dialogBox.left,
        top: dialogBox.top,
        right: dialogBox.right,
        bottom: dialogBox.bottom,
      },
      dialogClientWidth: dialog.clientWidth,
      dialogScrollWidth: dialog.scrollWidth,
      viewport: {
        left: viewportBox.left,
        top: viewportBox.top,
        right: viewportBox.right,
        bottom: viewportBox.bottom,
        width: viewportBox.width,
        height: viewportBox.height,
      },
      minimumActionHeight: Math.min(
        ...actions.map((action) => action.getBoundingClientRect().height)
      ),
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      stage: {
        left: stageBox.left,
        top: stageBox.top,
        width: stageBox.width,
        height: stageBox.height,
      },
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    };
  });

  assertLayout(
    state.role === 'dialog'
    && state.modal === 'true'
    && state.dialog.left >= 7
    && state.dialog.top >= 7
    && state.dialog.right <= state.windowWidth - 7
    && state.dialog.bottom <= state.windowHeight - 7
    && state.dialogScrollWidth <= state.dialogClientWidth + 1
    && state.documentScrollWidth <= state.documentClientWidth
    && nearlyEqual(state.viewport.width, state.viewport.height, 1)
    && state.viewport.left >= state.dialog.left
    && state.viewport.right <= state.dialog.right
    && state.minimumActionHeight >= 34,
    'The square Logo crop dialog is inaccessible, non-square, or overflows.'
  );
  assertLayout(
    nearlyEqual(state.stage.left, stageBeforeCrop.left)
    && nearlyEqual(state.stage.top, stageBeforeCrop.top)
    && nearlyEqual(state.stage.width, stageBeforeCrop.width)
    && nearlyEqual(state.stage.height, stageBeforeCrop.height),
    'Opening the Logo crop dialog moved or resized the stage.'
  );
}

async function selectFixtureLogo(page) {
  const fixture = 'iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAAKUlEQVR4AZXBAQEAMAiAME4ti76tZmB7/lkCiSSSSCKJJJJIIokkkugASykB7A5L0MQAAAAASUVORK5CYII=';
  await page.waitForSelector('.floating-logo-file-input', { timeout: 15_000 });
  await page.focus('.floating-logo-file-input');
  await page.$eval('.floating-logo-file-input', (input, base64) => {
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('The logo file input was not found.');
    }
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], 'green-brand.png', { type: 'image/png' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, fixture);
  await page.waitForSelector('.logo-crop-dialog', { timeout: 15_000 });
}

async function applyLogoCrop(page, { exercisePositioning = false } = {}) {
  await page.waitForSelector('.logo-crop-apply:not([disabled])', { timeout: 15_000 });

  if (exercisePositioning) {
    const initial = await page.$eval('.logo-crop-viewport', (viewport) => ({
      centerX: Number(viewport.getAttribute('data-center-x')),
      zoom: Number(viewport.getAttribute('data-zoom')),
    }));
    await page.$eval('.logo-crop-zoom input', (input) => {
      if (!(input instanceof HTMLInputElement)) {
        throw new Error('The Logo crop zoom control was not found.');
      }
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      valueSetter?.call(input, input.max);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(
      (previousZoom) => Number(
        document.querySelector('.logo-crop-viewport')?.getAttribute('data-zoom')
      ) > previousZoom,
      { timeout: 15_000 },
      initial.zoom
    );
    const viewportBox = await page.$eval('.logo-crop-viewport', (viewport) => {
      const box = viewport.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    });
    await page.mouse.move(
      viewportBox.x + viewportBox.width / 2,
      viewportBox.y + viewportBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      viewportBox.x + viewportBox.width * 0.25,
      viewportBox.y + viewportBox.height / 2,
      { steps: 6 }
    );
    await page.mouse.up();
    const positioned = await page.$eval('.logo-crop-viewport', (viewport) => ({
      centerX: Number(viewport.getAttribute('data-center-x')),
      zoom: Number(viewport.getAttribute('data-zoom')),
    }));
    assertLayout(
      positioned.zoom > initial.zoom && positioned.centerX > initial.centerX,
      'The Logo crop zoom or pointer positioning did not update the square crop.'
    );
  }

  await page.click('.logo-crop-apply');
  await page.waitForSelector('.logo-crop-dialog', { hidden: true, timeout: 15_000 });
  await page.waitForFunction(
    () => Boolean(
      document.querySelector('.floating-logo-control.has-logo')
      && document.querySelector('.floating-logo-preview')
      && !document.querySelector('.floating-logo-upload.is-loading')
    ),
    { timeout: 15_000 }
  );
  await new Promise((resolve) => setTimeout(resolve, 350));
}

async function uploadFixtureLogo(page) {
  const stageBeforeCrop = await readStageRect(page);
  await selectFixtureLogo(page);
  await verifyLogoCropDialog(page, stageBeforeCrop);
  await applyLogoCrop(page);
}

async function uploadDetailedFixtureLogo(page) {
  const stageBeforeCrop = await readStageRect(page);
  await page.waitForSelector('.floating-logo-file-input', { timeout: 15_000 });
  await page.$eval('.floating-logo-file-input', async (input) => {
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('The logo file input was not found.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The detailed logo fixture could not create a canvas.');
    const image = context.createImageData(canvas.width, canvas.height);
    let random = 7543;
    for (let index = 0; index < image.data.length; index += 4) {
      random = (random * 1664525 + 1013904223) >>> 0;
      image.data[index] = random & 255;
      image.data[index + 1] = (random >>> 8) & 255;
      image.data[index + 2] = (random >>> 16) & 255;
      image.data[index + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The detailed logo fixture could not encode PNG.');
    // Keep the image valid while taking the upload past the former 5 MiB gate.
    // PNG decoders ignore trailing bytes after IEND, and the editor must still
    // prepare the uploaded original into its bounded canonical representation.
    const formerLimitRegressionPadding = new Uint8Array(6 * 1024 * 1024);
    const transfer = new DataTransfer();
    transfer.items.add(new File(
      [blob, formerLimitRegressionPadding],
      'detailed-brand.png',
      { type: 'image/png' }
    ));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await verifyLogoCropDialog(page, stageBeforeCrop);
  await applyLogoCrop(page, { exercisePositioning: true });
  await page.waitForFunction(
    () => document.querySelector('.floating-logo-preview') instanceof HTMLImageElement
      && document.querySelector('.floating-logo-preview').complete
      && document.querySelector('.floating-logo-preview').naturalWidth > 0,
    { timeout: 15_000 }
  );
  const prepared = await page.$eval(
    '.floating-logo-preview',
    (preview) => preview instanceof HTMLImageElement
      ? {
        source: preview.src,
        width: preview.naturalWidth,
        height: preview.naturalHeight,
        borderWidth: getComputedStyle(preview).borderTopWidth,
      }
      : { source: '', width: 0, height: 0, borderWidth: '' }
  );
  const preparedBase64 = prepared.source.split(',', 2)[1] ?? '';
  const preparedByteLength = Math.floor(preparedBase64.length * 3 / 4)
    - (preparedBase64.endsWith('==') ? 2 : preparedBase64.endsWith('=') ? 1 : 0);
  assertLayout(
    prepared.source.startsWith('data:image/webp;base64,')
    && prepared.source.length <= 8_192
    && preparedByteLength < 1024 * 1024,
    'A formerly oversized editor logo was not compressed below 1 MB and into the canonical source limit.'
  );
  assertLayout(
    prepared.width > 0 && prepared.width === prepared.height,
    'The applied Logo crop did not produce a square raster.'
  );
  assertLayout(
    prepared.borderWidth === '0px',
    'The Logo editor preview still has a visible border.'
  );
  await new Promise((resolve) => setTimeout(resolve, 350));
}

async function verifyDesignQrLayout(browser) {
  const allScenarios = [
    { id: 'desktop', name: 'desktop', width: 1440, height: 900, controlHeight: 38, floatingToolHeight: 34, headerWidth: 760 },
    { id: 'tablet-portrait', name: 'tablet portrait', width: 1022, height: 1217, controlHeight: 38, floatingToolHeight: 34, headerWidth: 760 },
    { id: 'tall-desktop', name: 'tall desktop', width: 1190, height: 1217, controlHeight: 38, floatingToolHeight: 34, headerWidth: 760 },
    { id: 'mobile', name: 'mobile', width: 390, height: 844, controlHeight: 34, floatingToolHeight: 28, headerWidth: 354 },
    { id: 'small-mobile', name: 'small mobile', width: 320, height: 568, controlHeight: 34, floatingToolHeight: 28, headerWidth: 284 },
  ];
  const scenarios = requestedLayoutScenarios.size === 0
    ? allScenarios
    : allScenarios.filter((scenario) => requestedLayoutScenarios.has(scenario.id));
  if (
    requestedLayoutScenarios.size > 0
    && scenarios.length !== requestedLayoutScenarios.size
  ) {
    const knownScenarios = allScenarios.map((scenario) => scenario.id).join(', ');
    throw new Error(`Unknown Design QR layout scenario. Expected one of: ${knownScenarios}.`);
  }
  const appOrigin = new URL(url).origin;

  for (const scenario of scenarios) {
    const page = await browser.newPage();
    let phase = 'opening the editor';
    try {
      await page.setViewport({
        width: scenario.width,
        height: scenario.height,
        deviceScaleFactor: 1,
        isMobile: scenario.width <= 640,
        hasTouch: scenario.width <= 640,
      });
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const requestUrl = new URL(request.url());
        if (requestUrl.origin === appOrigin || requestUrl.protocol === 'data:') {
          void request.continue();
        } else {
          void request.abort();
        }
      });

      await page.goto(`${url}/qr`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await installClipboardCapture(page);
      phase = 'waiting for the initial WebGL canvas';
      await page.waitForSelector('.designqr-webgl-canvas', { timeout: 15_000 });
      await new Promise((resolve) => setTimeout(resolve, 500));

      const layout = await page.evaluate(() => {
        const rect = (selector) => {
          const box = document.querySelector(selector)?.getBoundingClientRect();
          return box && {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
          };
        };
        const blurControl = document.querySelector('[aria-label$="Blur"]');
        const transparentControl = document.querySelector(
          '.transparent-background-btn'
        );
        return {
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          header: rect('.app-header'),
          controls: rect('.controls-overlay'),
          season: rect('.season-chip'),
          addTheme: rect('.add-theme-chip-compact'),
          drawerTool: rect('.drawer-icon-btn'),
          drawerToolCount: document.querySelectorAll('.drawer-icon-btn').length,
          blur: rect('[aria-label$="Blur"]'),
          transparent: rect('.transparent-background-btn'),
          transparentPressed: transparentControl?.getAttribute('aria-pressed'),
          transparentLabel: transparentControl?.getAttribute('aria-label'),
          transparentTitle: transparentControl?.getAttribute('title'),
          transparentActive: transparentControl?.classList.contains('active'),
          transparentFollowsBlur: blurControl?.nextElementSibling === transparentControl,
          transparentPrecedesSpeed: transparentControl?.nextElementSibling
            ?.classList.contains('transition-speed-control'),
          speed: rect('.transition-speed-control'),
          speedSlider: rect('.transition-speed-slider'),
          speedValue: rect('.transition-speed-value'),
          speedValueDisplay: getComputedStyle(
            document.querySelector('.transition-speed-value')
          ).display,
          share: rect('.share-icon-btn'),
          stage: rect('.designqr-canvas-wrapper'),
          floatingRow: rect('.floating-top-tools-row'),
          floatingHint: rect('.floating-center-tools .canvas-hint-badge'),
          floatingRight: rect('.floating-right-tools'),
          logoToggle: rect('.floating-logo-toggle'),
          editToggle: rect('.floating-right-tools .floating-edit-toggle:not(.floating-logo-toggle)'),
          logoToggleLabelDisplay: getComputedStyle(
            document.querySelector('.floating-logo-toggle .floating-stage-tool-label')
          ).display,
          logoToggleLabel: document.querySelector('.floating-logo-toggle')
            ?.getAttribute('aria-label'),
        };
      });

      assertLayout(
        layout.documentWidth === scenario.width && layout.bodyWidth === scenario.width,
        `${scenario.name}: Design QR has horizontal overflow.`
      );
      assertLayout(
        nearlyEqual(layout.header.width, scenario.headerWidth),
        `${scenario.name}: shared header rail width drifted to ${layout.header.width}px.`
      );
      assertLayout(
        nearlyEqual((layout.controls.left + layout.controls.right) / 2, scenario.width / 2),
        `${scenario.name}: bottom control rail is not centered.`
      );

      for (const [name, box] of [
        ['season', layout.season],
        ['Add Theme', layout.addTheme],
        ['drawer tool', layout.drawerTool],
        ['Transparent background', layout.transparent],
        ['speed', layout.speed],
        ['Share', layout.share],
      ]) {
        assertLayout(
          nearlyEqual(box.height, scenario.controlHeight),
          `${scenario.name}: ${name} control height drifted to ${box.height}px.`
        );
      }
      assertLayout(
        nearlyEqual(layout.addTheme.right, layout.share.right),
        `${scenario.name}: Add Theme and Share no longer share a right edge.`
      );
      assertLayout(
        layout.drawerToolCount === 5
        && layout.transparentFollowsBlur
        && layout.transparentPrecedesSpeed
        && layout.transparentPressed === 'false'
        && layout.transparentLabel === 'Transparent background'
        && layout.transparentTitle === 'Enable transparent background'
        && !layout.transparentActive
        && nearlyEqual(layout.transparent.width, layout.blur.width)
        && nearlyEqual(
          layout.transparent.left - layout.blur.right,
          scenario.width <= 360 ? 4 : scenario.width <= 640 ? 5 : 8
        ),
        `${scenario.name}: Transparent background is not an inactive toolbar button beside Blur.`
      );
      if (scenario.width <= 360) {
        assertLayout(
          layout.speedValueDisplay === 'none'
          && layout.speedSlider.left - layout.speed.left >= 8
          && layout.speed.right - layout.speedSlider.right >= 8
          && layout.speedSlider.width >= 36,
          `${scenario.name}: the compact speed slider is too narrow or overflows.`
        );
      } else {
        assertLayout(
          layout.speedValueDisplay !== 'none'
          && layout.speedSlider.left - layout.speed.left >= 8
          && layout.speed.right - layout.speedValue.right >= 8,
          `${scenario.name}: speed control content is too close to its edge.`
        );
      }
      assertLayout(
        layout.logoToggleLabel === 'Add logo'
        && !layout.editToggle
        && nearlyEqual(layout.logoToggle.height, scenario.floatingToolHeight),
        `${scenario.name}: the 3D stage does not expose the correctly sized Logo control.`
      );
      assertLayout(
        nearlyEqual(
          (layout.floatingHint.left + layout.floatingHint.right) / 2,
          scenario.width / 2
        )
        && layout.floatingRight.left >= layout.floatingHint.right + 2
        && layout.floatingRight.right <= layout.floatingRow.right + 1
        && nearlyEqual(layout.logoToggle.right, layout.floatingRow.right),
        `${scenario.name}: the 3D Logo control overlaps or shifts the centered mode hint.`
      );
      assertLayout(
        scenario.width <= 640
          ? layout.logoToggleLabelDisplay === 'none'
          : layout.logoToggleLabelDisplay !== 'none',
        `${scenario.name}: the Logo label does not follow the responsive floating-tool contract.`
      );

      phase = 'opening and closing the 3D logo editor';
      await page.click('.floating-logo-toggle');
      await page.waitForSelector('.floating-logo-editor');
      await new Promise((resolve) => setTimeout(resolve, 450));
      const logoPanel3d = await page.evaluate(() => {
        const panel = document.querySelector('.floating-logo-editor');
        const stage = document.querySelector('.designqr-canvas-wrapper');
        const toggle = document.querySelector('.floating-logo-toggle');
        const upload = document.querySelector('.floating-logo-upload');
        if (
          !(panel instanceof HTMLElement)
          || !(stage instanceof HTMLElement)
          || !(toggle instanceof HTMLButtonElement)
          || !(upload instanceof HTMLLabelElement)
        ) {
          throw new Error('The 3D Logo editor state is incomplete.');
        }
        const stageBox = stage.getBoundingClientRect();
        return {
          panelClientWidth: panel.clientWidth,
          panelScrollWidth: panel.scrollWidth,
          expanded: toggle.getAttribute('aria-expanded'),
          uploadTitle: upload.title,
          stage: {
            left: stageBox.left,
            top: stageBox.top,
            width: stageBox.width,
            height: stageBox.height,
          },
        };
      });
      assertLayout(
        logoPanel3d.expanded === 'true'
        && logoPanel3d.panelScrollWidth <= logoPanel3d.panelClientWidth + 1
        && logoPanel3d.uploadTitle.includes('up to 100 MB')
        && logoPanel3d.uploadTitle.includes('below 1 MB'),
        `${scenario.name}: the 3D Logo editor is inaccessible or overflows.`
      );
      assertLayout(
        nearlyEqual(logoPanel3d.stage.left, layout.stage.left)
        && nearlyEqual(logoPanel3d.stage.top, layout.stage.top)
        && nearlyEqual(logoPanel3d.stage.width, layout.stage.width)
        && nearlyEqual(logoPanel3d.stage.height, layout.stage.height),
        `${scenario.name}: opening Logo moved or resized the 3D stage.`
      );
      await page.click('.floating-logo-toggle');
      await page.waitForSelector('.floating-logo-editor', { hidden: true });

      const directionBefore = await page.$eval(
        '[aria-label="Change spin to counterclockwise"]',
        (element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, top: box.top, width: box.width, height: box.height };
        }
      );
      await page.click('[aria-label="Change spin to counterclockwise"]');
      const directionAfter = await page.$eval(
        '[aria-label="Change spin to clockwise"]',
        (element) => {
          const box = element.getBoundingClientRect();
          return {
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            pressed: element.getAttribute('aria-pressed'),
          };
        }
      );
      assertLayout(
        directionAfter.pressed === 'true'
        && nearlyEqual(directionAfter.left, directionBefore.left)
        && nearlyEqual(directionAfter.width, directionBefore.width)
        && nearlyEqual(directionAfter.height, directionBefore.height),
        `${scenario.name}: changing spin direction moved or resized its control.`
      );
      await page.click('[aria-label="Change spin to clockwise"]');

      phase = 'selecting Pixel foliage in the theme editor';
      await page.click('.add-theme-chip-compact');
      await page.waitForSelector('.custom-theme-aside-panel');
      await new Promise((resolve) => setTimeout(resolve, 350));
      await page.evaluate(() => {
        const pixelButton = document.querySelector('[data-foliage-shape="pixel"]');
        if (!(pixelButton instanceof HTMLButtonElement)) {
          throw new Error('Pixel foliage option was not found.');
        }
        pixelButton.click();
      });
      await page.waitForFunction(
        () => document.querySelector('.custom-theme-aside-panel') instanceof HTMLElement
          && document.querySelector('.aside-theme-form') instanceof HTMLElement
          && document.querySelector('[data-foliage-shape="pixel"]')
            ?.classList.contains('active'),
        { timeout: 15_000 }
      );
      const editor = await page.evaluate(() => {
        const panelElement = document.querySelector('.custom-theme-aside-panel');
        const form = document.querySelector('.aside-theme-form');
        if (
          !(panelElement instanceof HTMLElement)
          || !(form instanceof HTMLElement)
        ) {
          throw new Error('Theme editor state is incomplete.');
        }
        const panel = panelElement.getBoundingClientRect();
        const firstFormLabel = form?.querySelector('.form-group .form-label');
        const pixelButton = document.querySelector('[data-foliage-shape="pixel"]');
        return {
          hasPreviewCard: document.querySelector('.theme-live-preview-card') !== null,
          firstFormLabel: firstFormLabel?.textContent?.trim(),
          panelHeight: panel.height,
          formWidth: form.clientWidth,
          formScrollWidth: form.scrollWidth,
          pixelSelected: pixelButton?.classList.contains('active') ?? false,
        };
      });
      assertLayout(
        !editor.hasPreviewCard && editor.firstFormLabel === 'Theme Name',
        `${scenario.name}: Theme Name is not the first section or the removed preview card returned.`
      );
      assertLayout(
        editor.formScrollWidth <= editor.formWidth + 1,
        `${scenario.name}: theme editor has horizontal overflow (${editor.formScrollWidth}px > ${editor.formWidth}px).`
      );
      assertLayout(
        editor.pixelSelected,
        `${scenario.name}: Pixel foliage was not selected in the theme editor.`
      );
      if (scenario.width <= 640) {
        assertLayout(
          editor.panelHeight >= scenario.height * 0.7,
          `${scenario.name}: theme sheet is too short for mobile editing.`
        );
      }
      await page.click('.custom-theme-aside-panel .modal-close-btn');
      await page.waitForSelector('.custom-theme-aside-panel', { hidden: true });

      phase = 'checking the Share modal modes';
      await page.click('.share-icon-btn');
      await page.waitForSelector('.share-modal-content');
      await page.$eval('.share-modal-content', async (modal) => {
        await Promise.all(
          modal.getAnimations().map((animation) => animation.finished)
        );
      });
      const shareState = await page.evaluate(() => {
        const modal = document.querySelector('.share-modal-content');
        const shareInput = document.querySelector('[aria-label="Editable DesignQR link"]');
        if (!(modal instanceof HTMLElement) || !(shareInput instanceof HTMLInputElement)) {
          throw new Error('Share mode controls were not found.');
        }
        const copyButtons = [...modal.querySelectorAll('.share-copy-icon-btn')];
        return {
          width: modal.getBoundingClientRect().width,
          height: modal.getBoundingClientRect().height,
          clientWidth: modal.clientWidth,
          scrollWidth: modal.scrollWidth,
          shareUrl: shareInput.value,
          copyButtonsValid: copyButtons.length === 1 && copyButtons.every((button) => {
            const box = button.getBoundingClientRect();
            return Boolean(button.querySelector('svg'))
              && button.textContent?.trim() === ''
              && Math.abs(box.width - box.height) <= 0.75;
          }),
        };
      });
      assertLayout(
        shareState.width <= scenario.width - 24,
        `${scenario.name}: Share modal overflows the mobile/desktop gutter.`
      );
      assertLayout(
        shareState.scrollWidth <= shareState.clientWidth + 1,
        `${scenario.name}: Share mode has horizontal overflow.`
      );
      assertLayout(
        shareState.copyButtonsValid,
        `${scenario.name}: Share copy control is not an aligned icon-only button.`
      );

      await page.click('[data-share-mode="embed"]');
      await page.waitForSelector('[aria-label="DesignQR iframe code"]');
      const embedState = await page.evaluate(() => {
        const modal = document.querySelector('.share-modal-content');
        const code = document.querySelector('[aria-label="DesignQR iframe code"]');
        const source = document.querySelector('[aria-label="Hosted DesignQR player URL"]');
        const openLink = document.querySelector('.share-open-btn');
        if (
          !(modal instanceof HTMLElement)
          || !(code instanceof HTMLElement)
          || !(source instanceof HTMLInputElement)
          || !(openLink instanceof HTMLAnchorElement)
        ) {
          throw new Error('Embed mode controls were not found.');
        }
        const copyButtons = [...modal.querySelectorAll('.share-copy-icon-btn')];
        const syntaxColors = new Set(
          [...code.querySelectorAll('.syntax-token')].map(
            (token) => getComputedStyle(token).color
          )
        );
        return {
          height: modal.getBoundingClientRect().height,
          clientWidth: modal.clientWidth,
          scrollWidth: modal.scrollWidth,
          code: code.textContent ?? '',
          embedUrl: source.value,
          openUrl: openLink.href,
          openTarget: openLink.target,
          openRel: openLink.rel,
          syntaxColorCount: syntaxColors.size,
          copyButtonsValid: copyButtons.length === 2 && copyButtons.every((button) => {
            const box = button.getBoundingClientRect();
            return Boolean(button.querySelector('svg'))
              && button.textContent?.trim() === ''
              && Math.abs(box.width - box.height) <= 0.75;
          }),
        };
      });
      const shareConfig = new URL(shareState.shareUrl).searchParams.get('q');
      const embedConfig = new URL(embedState.embedUrl).searchParams.get('config');
      assertLayout(
        shareConfig !== null && embedConfig === shareConfig,
        `${scenario.name}: Share and Embed did not use the same canonical configuration.`
      );
      assertLayout(
        embedState.code.includes('/qr/embed?config=')
        && embedState.code.includes('sandbox="allow-scripts allow-same-origin"'),
        `${scenario.name}: generated iframe markup is incomplete.`
      );
      assertLayout(
        embedState.openUrl === embedState.embedUrl
        && embedState.openTarget === '_blank'
        && embedState.openRel.includes('noreferrer'),
        `${scenario.name}: hosted-player open action is unsafe or points elsewhere.`
      );
      assertLayout(
        embedState.scrollWidth <= embedState.clientWidth + 1,
        `${scenario.name}: Embed mode has horizontal overflow.`
      );
      assertLayout(
        embedState.copyButtonsValid && embedState.syntaxColorCount >= 3,
        `${scenario.name}: Embed code controls or syntax theme are incomplete.`
      );
      assertLayout(
        nearlyEqual(embedState.height, shareState.height),
        `${scenario.name}: Share modal height changed when opening Embed.`
      );

      await page.click('[data-share-mode="react"]');
      await page.waitForSelector('[aria-label="DesignQR React code"]');
      const reactState = await page.evaluate(() => {
        const modal = document.querySelector('.share-modal-content');
        const code = document.querySelector('[aria-label="DesignQR React code"]');
        const install = document.querySelector('[aria-label="DesignQR npm install command"]');
        if (
          !(modal instanceof HTMLElement)
          || !(code instanceof HTMLElement)
          || !(install instanceof HTMLElement)
        ) {
          throw new Error('React mode controls were not found.');
        }
        const copyButtons = [...modal.querySelectorAll('.share-copy-icon-btn')];
        const syntaxColors = new Set(
          [...code.querySelectorAll('.syntax-token')].map(
            (token) => getComputedStyle(token).color
          )
        );
        return {
          height: modal.getBoundingClientRect().height,
          clientWidth: modal.clientWidth,
          scrollWidth: modal.scrollWidth,
          code: code.textContent ?? '',
          installCommand: install.textContent?.trim() ?? '',
          syntaxColorCount: syntaxColors.size,
          copyButtonsValid: copyButtons.length === 2 && copyButtons.every((button) => {
            const box = button.getBoundingClientRect();
            return Boolean(button.querySelector('svg'))
              && button.textContent?.trim() === ''
              && Math.abs(box.width - box.height) <= 0.75;
          }),
        };
      });
      const simpleRecommendationState = await readReactExampleState(page);
      assertLayout(
        reactState.installCommand === 'npm install designqr'
        && reactState.code.includes("import { DesignQR } from 'designqr';")
        && reactState.code.includes('<DesignQR value="https://design.johnson7543.com" />')
        && !reactState.code.includes('design=')
        && !reactState.code.includes('tree=')
        && !reactState.code.includes('theme=')
        && !reactState.code.includes('defaultView=')
        && !reactState.code.includes('details=')
        && !reactState.code.includes('interaction=')
        && !reactState.code.includes('transparentBackground'),
        `${scenario.name}: React installation or minimal component snippet is incorrect.`
      );
      assertLayout(
        simpleRecommendationState.active.length === 1
        && simpleRecommendationState.active[0] === 'simple'
        && simpleRecommendationState.recommended.length === 1
        && simpleRecommendationState.recommended[0] === 'simple'
        && simpleRecommendationState.recommendedClass
        && simpleRecommendationState.recommendedHasIcon
        && simpleRecommendationState.recommendedAnimation
          === 'react-example-recommendation-in'
        && simpleRecommendationState.recommendedLabel
          === 'Simple, recommended for the current editor setup'
        && simpleRecommendationState.copyLabel === 'Copy Simple React code'
        && simpleRecommendationState.switcherFits,
        `${scenario.name}: URL-only editor state did not default to an accessible highlighted Simple example: ${JSON.stringify(simpleRecommendationState)}.`
      );
      assertLayout(
        reactState.scrollWidth <= reactState.clientWidth + 1,
        `${scenario.name}: React mode has horizontal overflow.`
      );
      assertLayout(
        reactState.copyButtonsValid && reactState.syntaxColorCount >= 3,
        `${scenario.name}: React code controls or syntax theme are incomplete.`
      );
      assertLayout(
        nearlyEqual(reactState.height, shareState.height),
        `${scenario.name}: Share modal height changed when opening React.`
      );

      await page.click('[data-react-example="advanced"]');
      const advancedReactState = await page.evaluate(() => {
        const modal = document.querySelector('.share-modal-content');
        const code = document.querySelector('[aria-label="DesignQR React code"]');
        if (!(modal instanceof HTMLElement) || !(code instanceof HTMLElement)) {
          throw new Error('Advanced React example was not found.');
        }
        return {
          height: modal.getBoundingClientRect().height,
          code: code.textContent ?? '',
          label: document.querySelector('[data-react-example="advanced"]')
            ?.textContent?.trim(),
          selected: document.querySelector('[data-react-example="advanced"]')
            ?.getAttribute('aria-pressed'),
        };
      });
      assertLayout(
        advancedReactState.selected === 'true'
        && advancedReactState.label === 'Advanced'
        && advancedReactState.code === expectedDefaultAdvancedReactCode
        && !advancedReactState.code.includes('className=')
        && !advancedReactState.code.includes('console.')
        && !advancedReactState.code.includes('TODO')
        && !/\n\s*\/\//.test(advancedReactState.code)
        && !advancedReactState.code.includes('/*'),
        `${scenario.name}: Advanced React example is not the exact runnable controlled component.`
      );
      const advancedSelectionState = await readReactExampleState(page);
      assertLayout(
        advancedSelectionState.active.length === 1
        && advancedSelectionState.active[0] === 'advanced'
        && advancedSelectionState.recommended.length === 1
        && advancedSelectionState.recommended[0] === 'simple'
        && advancedSelectionState.copyLabel === 'Copy Advanced React code',
        `${scenario.name}: manual Advanced selection changed the Simple recommendation.`
      );
      assertLayout(
        nearlyEqual(advancedReactState.height, shareState.height),
        `${scenario.name}: Share modal height changed between React examples.`
      );

      await page.click('[data-react-example="theme"]');
      const themeReactState = await page.evaluate(() => {
        const modal = document.querySelector('.share-modal-content');
        const code = document.querySelector('[aria-label="DesignQR React code"]');
        const switcher = document.querySelector('.react-example-switcher');
        const copyButton = document.querySelector(
          '.react-code-header .share-copy-icon-btn'
        );
        if (
          !(modal instanceof HTMLElement)
          || !(code instanceof HTMLElement)
          || !(switcher instanceof HTMLElement)
          || !(copyButton instanceof HTMLButtonElement)
        ) {
          throw new Error('Theme customization React example was not found.');
        }

        const switcherBox = switcher.getBoundingClientRect();
        const copyButtonBox = copyButton.getBoundingClientRect();
        const buttons = [...switcher.querySelectorAll('[data-react-example]')];
        return {
          height: modal.getBoundingClientRect().height,
          clientWidth: modal.clientWidth,
          scrollWidth: modal.scrollWidth,
          code: code.textContent ?? '',
          themeLabel: switcher.querySelector('[data-react-example="theme"]')
            ?.textContent?.trim(),
          selectedModes: Object.fromEntries(buttons.map((button) => [
            button.getAttribute('data-react-example'),
            button.getAttribute('aria-pressed'),
          ])),
          switcherFits: switcher.scrollWidth <= switcher.clientWidth + 1
            && buttons.every((button) => {
              const box = button.getBoundingClientRect();
              return box.left >= switcherBox.left - 1
                && box.right <= switcherBox.right + 1;
            })
            && switcherBox.right <= copyButtonBox.left - 1,
        };
      });
      assertLayout(
        themeReactState.selectedModes.simple === 'false'
        && themeReactState.selectedModes.advanced === 'false'
        && themeReactState.selectedModes.theme === 'true'
        && themeReactState.themeLabel === 'Custom Theme',
        `${scenario.name}: Custom Theme React example selection or label is incorrect.`
      );
      const themeSelectionState = await readReactExampleState(page);
      assertLayout(
        themeSelectionState.active.length === 1
        && themeSelectionState.active[0] === 'theme'
        && themeSelectionState.recommended.length === 1
        && themeSelectionState.recommended[0] === 'simple'
        && themeSelectionState.copyLabel === 'Copy Custom Theme React code',
        `${scenario.name}: manual Custom Theme selection changed the Simple recommendation.`
      );
      const themeParameterLines = readCustomThemeParameterLines(themeReactState.code);
      assertLayout(
        themeReactState.code.includes('createTreeTheme,')
        && themeReactState.code.includes('DesignQR,')
        && themeReactState.code.includes('type ResolvedTreeTheme,')
        && themeReactState.code.includes("} from 'designqr';")
        && themeReactState.code.includes("createTreeTheme('spring', {")
        && themeReactState.code.includes('satisfies ResolvedTreeTheme')
        && themeReactState.code.includes('const customTheme =')
        && themeReactState.code.endsWith(expectedCustomThemeComponent({
          view: 'design',
          details: { title: '', showValue: false, border: false },
          logo: 'false',
          transparentBackground: false,
        }))
        && themeParameterLines.length === expectedSpringThemeParameterLines.length
        && themeParameterLines.every(
          (line, index) => line === expectedSpringThemeParameterLines[index]
        )
        && !themeReactState.code.includes('foliageShape: "pixel"')
        && !themeReactState.code.includes('canopyDensity: 80')
        && !themeReactState.code.includes('useRef')
        && !themeReactState.code.includes('DesignQRHandle')
        && !themeReactState.code.includes('ref={')
        && !themeReactState.code.includes('id:')
        && !themeReactState.code.includes('label:')
        && !themeReactState.code.includes('isCustom')
        && !themeReactState.code.includes('TODO')
        && !themeReactState.code.includes('/logo.webp'),
        `${scenario.name}: Custom Theme React example does not exactly resolve the active Spring theme and current component props.`
      );
      const missingThemeParameters = fullThemeParameterNames.filter(
        (parameter) => !themeReactState.code.includes(`\n  ${parameter}:`)
      );
      assertLayout(
        missingThemeParameters.length === 0,
        `${scenario.name}: Custom Theme React example is missing full parameters: ${missingThemeParameters.join(', ')}.`
      );
      assertLayout(
        themeReactState.scrollWidth <= themeReactState.clientWidth + 1
        && themeReactState.switcherFits,
        `${scenario.name}: Custom Theme React example selector has horizontal overflow or overlaps Copy.`
      );
      assertLayout(
        nearlyEqual(themeReactState.height, shareState.height),
        `${scenario.name}: Share modal height changed for the Custom Theme React example.`
      );

      phase = 'copying the Custom Theme React example';
      const themeCopyFeedback = await clickAndCaptureCopyFeedback(
        page,
        '.react-code-header .share-copy-icon-btn'
      );
      assertLayout(
        themeCopyFeedback.label === 'Copied!' && !themeCopyFeedback.disabled,
        `${scenario.name}: Custom Theme copy feedback failed: ${JSON.stringify(themeCopyFeedback)}.`
      );
      const copiedThemeState = await page.evaluate(() => ({
        clipboard: window.__designQrClipboardText,
        code: document.querySelector('[aria-label="DesignQR React code"]')
          ?.textContent ?? '',
      }));
      assertLayout(
        copiedThemeState.clipboard === copiedThemeState.code
        && copiedThemeState.code === themeReactState.code,
        `${scenario.name}: Copy Custom Theme React code did not write the displayed code.`
      );

      await page.click('[data-react-example="advanced"]');
      const resetCopyState = await page.evaluate(() => {
        const copyButton = document.querySelector(
          '.react-code-header .share-copy-icon-btn'
        );
        return {
          label: copyButton?.getAttribute('aria-label'),
          title: copyButton?.getAttribute('title'),
          copied: copyButton?.classList.contains('copied'),
        };
      });
      assertLayout(
        resetCopyState.label === 'Copy Advanced React code'
        && resetCopyState.title === 'Copy Advanced React code'
        && !resetCopyState.copied,
        `${scenario.name}: React copy feedback did not reset after switching examples.`
      );

      await page.click('.share-modal-content .modal-close-btn');
      await page.waitForSelector('.share-modal-content', { hidden: true });

      phase = 'saving and checking a custom theme';
      await page.click('.add-theme-chip-compact');
      await page.waitForSelector('.custom-theme-aside-panel');
      await page.click('[data-foliage-shape="pixel"]');
      await page.waitForFunction(
        () => document.querySelector('[data-foliage-shape="pixel"]')
          ?.classList.contains('active'),
        { timeout: 15_000 }
      );
      await page.click('.custom-theme-aside-panel .btn-primary');
      await page.waitForSelector('.custom-theme-aside-panel', { hidden: true });
      await page.waitForSelector('.custom-theme-chip-wrap.active');

      await page.click('.share-icon-btn');
      await page.waitForSelector('.share-modal-content');
      await page.click('[data-share-mode="react"]');
      await page.waitForSelector('[aria-label="DesignQR React code"]');
      const customRecommendationState = await readReactExampleState(page);
      const missingCurrentCustomThemeParameters = fullThemeParameterNames.filter(
        (parameter) => !customRecommendationState.code.includes(`\n  ${parameter}:`)
      );
      assertLayout(
        customRecommendationState.active.length === 1
        && customRecommendationState.active[0] === 'theme'
        && customRecommendationState.recommended.length === 1
        && customRecommendationState.recommended[0] === 'theme'
        && customRecommendationState.recommendedClass
        && customRecommendationState.recommendedHasIcon
        && customRecommendationState.recommendedLabel
          === 'Custom Theme, recommended for the current editor setup'
        && customRecommendationState.copyLabel === 'Copy Custom Theme React code'
        && customRecommendationState.switcherFits
        && customRecommendationState.code.includes('theme={customTheme}')
        && customRecommendationState.code.includes('foliageShape: "pixel"')
        && missingCurrentCustomThemeParameters.length === 0,
        `${scenario.name}: saved editor theme did not default to the complete highlighted Custom Theme example.`
      );

      await page.click('[data-react-example="advanced"]');
      const customManualSelectionState = await readReactExampleState(page);
      assertLayout(
        customManualSelectionState.active.length === 1
        && customManualSelectionState.active[0] === 'advanced'
        && customManualSelectionState.recommended.length === 1
        && customManualSelectionState.recommended[0] === 'theme',
        `${scenario.name}: manual selection changed the active custom-theme recommendation.`
      );
      await page.click('.share-modal-content .modal-close-btn');
      await page.waitForSelector('.share-modal-content', { hidden: true });
      phase = 'restoring the Spring preset';
      await page.click('.season-tabs > .season-chip:first-child');
      await page.waitForFunction(
        () => document.querySelector('.season-tabs > .season-chip:first-child')
          ?.getAttribute('aria-pressed') === 'true',
        { timeout: 15_000 }
      );

      phase = 'entering the settled 2D view';
      await page.click('.mode-btn[title="2D QR"]');
      await page.waitForFunction(
        () => document.querySelector('.app-root')?.classList.contains('view-scan'),
        { timeout: 15_000 }
      );
      const tools2d = await page.evaluate(() => {
        const rect = (selector) => {
          const box = document.querySelector(selector)?.getBoundingClientRect();
          return box && {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
          };
        };
        const editLabel = document.querySelector(
          '.floating-right-tools .floating-edit-toggle:not(.floating-logo-toggle) .floating-stage-tool-label'
        );
        return {
          hint: rect('.floating-center-tools .canvas-hint-badge'),
          right: rect('.floating-right-tools'),
          row: rect('.floating-top-tools-row'),
          edit: rect('.floating-right-tools .floating-edit-toggle:not(.floating-logo-toggle)'),
          logo: rect('.floating-logo-toggle'),
          transparent: rect('.transparent-background-btn'),
          transparentPressed: document.querySelector('.transparent-background-btn')
            ?.getAttribute('aria-pressed'),
          editLabelDisplay: editLabel ? getComputedStyle(editLabel).display : '',
        };
      });
      assertLayout(
        Boolean(tools2d.edit)
        && Boolean(tools2d.logo)
        && Boolean(tools2d.transparent)
        && nearlyEqual(tools2d.edit.height, scenario.floatingToolHeight)
        && nearlyEqual(tools2d.logo.height, scenario.floatingToolHeight)
        && nearlyEqual(tools2d.transparent.height, scenario.controlHeight)
        && tools2d.transparentPressed === 'false'
        && nearlyEqual(tools2d.logo.right, tools2d.row.right),
        `${scenario.name}: the 2D view is missing its Edit, Logo, or Transparent control.`
      );
      assertLayout(
        nearlyEqual((tools2d.hint.left + tools2d.hint.right) / 2, scenario.width / 2)
        && tools2d.right.left >= tools2d.hint.right + 2
        && tools2d.right.right <= tools2d.row.right + 1,
        `${scenario.name}: the 2D Edit/Logo group overlaps or shifts the centered mode hint.`
      );
      assertLayout(
        scenario.width <= 640
          ? tools2d.editLabelDisplay === 'none'
          : tools2d.editLabelDisplay !== 'none',
        `${scenario.name}: the Edit label does not follow the responsive floating-tool contract.`
      );

      const stageBeforeEditors = await page.$eval(
        '.designqr-canvas-wrapper',
        (element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, top: box.top, width: box.width, height: box.height };
        }
      );
      phase = 'opening the 2D details editor';
      await page.click(
        '.floating-right-tools .floating-edit-toggle:not(.floating-logo-toggle)'
      );
      await page.waitForSelector('.floating-details-editor');
      await new Promise((resolve) => setTimeout(resolve, 450));
      const detailsState = await page.evaluate(() => {
        const panel = document.querySelector('.floating-details-editor');
        const stage = document.querySelector('.designqr-canvas-wrapper');
        if (
          !(panel instanceof HTMLElement)
          || !(stage instanceof HTMLElement)
        ) {
          throw new Error('The 2D details editor state is incomplete.');
        }
        const panelBox = panel.getBoundingClientRect();
        const stageBox = stage.getBoundingClientRect();
        return {
          width: panelBox.width,
          height: panelBox.height,
          panelClientWidth: panel.clientWidth,
          panelScrollWidth: panel.scrollWidth,
          logoEditorPresent: Boolean(document.querySelector('.floating-logo-editor')),
          containsTransparencyControl: Boolean(
            panel.querySelector('.transparent-background-btn')
          ),
          stage: {
            left: stageBox.left,
            top: stageBox.top,
            width: stageBox.width,
            height: stageBox.height,
          },
        };
      });
      assertLayout(
        detailsState.width <= layout.controls.width - 15
        && nearlyEqual(detailsState.height, scenario.width <= 640 ? 78 : 91)
        && detailsState.panelScrollWidth <= detailsState.panelClientWidth + 1
        && !detailsState.logoEditorPresent,
        `${scenario.name}: the dedicated 2D details editor is mis-sized or overflows.`
      );
      assertLayout(
        !detailsState.containsTransparencyControl,
        `${scenario.name}: the 2D Edit panel duplicates the persistent Transparent control.`
      );
      assertLayout(
        nearlyEqual(detailsState.stage.left, stageBeforeEditors.left)
        && nearlyEqual(detailsState.stage.top, stageBeforeEditors.top)
        && nearlyEqual(detailsState.stage.width, stageBeforeEditors.width)
        && nearlyEqual(detailsState.stage.height, stageBeforeEditors.height),
        `${scenario.name}: opening Edit moved or resized the 2D stage.`
      );

      if (scenario.name === 'desktop') {
        phase = 'enabling the transparent background';
        const opaqueUrl = page.url();
        await page.click('.transparent-background-btn');
        phase = 'waiting for the transparent URL to synchronize';
        await page.waitForFunction(
          () => document.querySelector('.transparent-background-btn')
            ?.getAttribute('aria-pressed') === 'true'
            && document.querySelector('.transparent-background-btn')
              ?.classList.contains('active')
            && document.querySelector('.transparent-background-btn')
              ?.getAttribute('title') === 'Disable transparent background'
            && document.querySelector('.main-viewport')
              ?.classList.contains('transparency-preview'),
          { timeout: 15_000 }
        );
        await page.waitForFunction(
          (previousUrl) => window.location.href !== previousUrl,
          { timeout: 15_000 },
          opaqueUrl
        );
        const previewBackground = await page.$eval(
          '.main-viewport.transparency-preview',
          (viewport) => getComputedStyle(viewport).backgroundImage
        );
        assertLayout(
          previewBackground.includes('conic-gradient'),
          'The editor does not expose its non-exported transparency preview.'
        );
        phase = 'disabling the transparent background';
        await page.click('.transparent-background-btn');
        await page.waitForFunction(
          () => document.querySelector('.transparent-background-btn')
            ?.getAttribute('aria-pressed') === 'false'
            && !document.querySelector('.transparent-background-btn')
              ?.classList.contains('active')
            && document.querySelector('.transparent-background-btn')
              ?.getAttribute('title') === 'Enable transparent background'
            && !document.querySelector('.main-viewport')
              ?.classList.contains('transparency-preview'),
          { timeout: 15_000 }
        );
      }

      const paletteBeforeLogo = scenario.name === 'desktop'
        ? await readSpringQrPaletteSignature(page)
        : null;

      phase = 'uploading and sizing the 2D logo';
      await page.click('.floating-logo-toggle');
      await page.waitForSelector('.floating-logo-editor');
      await page.waitForSelector('.floating-details-editor', { hidden: true });
      await new Promise((resolve) => setTimeout(resolve, 450));
      if (scenario.name === 'desktop') await uploadDetailedFixtureLogo(page);
      else await uploadFixtureLogo(page);
      await page.$eval('.floating-logo-size-control input', (size) => {
        if (!(size instanceof HTMLInputElement)) {
          throw new Error('The logo size control was not found.');
        }
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        )?.set;
        valueSetter?.call(size, size.max);
        size.dispatchEvent(new Event('input', { bubbles: true }));
        size.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForFunction(
        () => document.querySelector('.floating-logo-size-control output')
          ?.textContent?.trim() === '20%',
        { timeout: 15_000 }
      );
      const logoState = await page.evaluate(() => {
        const panel = document.querySelector('.floating-logo-editor');
        const stage = document.querySelector('.designqr-canvas-wrapper');
        if (
          !(panel instanceof HTMLElement)
          || !(stage instanceof HTMLElement)
        ) {
          throw new Error('The uploaded-logo editor state is incomplete.');
        }
        const panelBox = panel.getBoundingClientRect();
        const stageBox = stage.getBoundingClientRect();
        return {
          width: panelBox.width,
          height: panelBox.height,
          panelClientWidth: panel.clientWidth,
          panelScrollWidth: panel.scrollWidth,
          sizeOutput: document.querySelector('.floating-logo-size-control output')
            ?.textContent?.trim(),
          stage: {
            left: stageBox.left,
            top: stageBox.top,
            width: stageBox.width,
            height: stageBox.height,
          },
        };
      });
      assertLayout(
        logoState.width <= layout.controls.width - 15
        && nearlyEqual(logoState.height, scenario.width <= 640 ? 44 : 46),
        `${scenario.name}: Logo editor exceeds the control rail or has incorrect height (${logoState.width}×${logoState.height}px).`
      );
      assertLayout(
        logoState.panelScrollWidth <= logoState.panelClientWidth + 1,
        `${scenario.name}: logo controls overflow their editor panel.`
      );
      assertLayout(
        logoState.sizeOutput === '20%',
        `${scenario.name}: the logo size control did not reach its safe maximum.`
      );
      assertLayout(
        nearlyEqual(logoState.stage.left, stageBeforeEditors.left)
        && nearlyEqual(logoState.stage.top, stageBeforeEditors.top)
        && nearlyEqual(logoState.stage.width, stageBeforeEditors.width)
        && nearlyEqual(logoState.stage.height, stageBeforeEditors.height),
        `${scenario.name}: adding a logo moved or resized the 2D stage.`
      );

      if (paletteBeforeLogo) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const paletteAfterLogo = await readSpringQrPaletteSignature(page);
        for (const role of ['green', 'pink']) {
          const before = paletteBeforeLogo[role];
          const after = paletteAfterLogo[role];
          const maximumMeanDelta = Math.max(
            ...before.mean.map((channel, index) => Math.abs(channel - after.mean[index]))
          );
          assertLayout(
            before.count > 100 && after.count > 100 && maximumMeanDelta <= 3,
            `desktop: adding a logo changed the 2D ${role} palette: ${JSON.stringify({ before, after, maximumMeanDelta })}.`
          );
        }
      }

      console.log(`Design QR layout passed: ${scenario.name}.`);
    } catch (error) {
      throw new Error(
        `Design QR layout smoke test failed for ${scenario.name} while ${phase}: ${error.message}`
      );
    } finally {
      await page.close();
    }
  }
}

async function verifyDesignQrWysiwygExport(browser) {
  const page = await browser.newPage();
  const downloadDirectory = await mkdtemp(join(tmpdir(), 'designqr-export-'));
  const appOrigin = new URL(url).origin;

  try {
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const requestUrl = new URL(request.url());
      if (requestUrl.origin === appOrigin || requestUrl.protocol === 'data:') {
        void request.continue();
      } else {
        void request.abort();
      }
    });
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDirectory,
    });

    await page.goto(`${url}/qr`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await installClipboardCapture(page);
    await page.waitForSelector('.designqr-presentation-canvas', { timeout: 15_000 });
    await page.$eval('.transition-speed-slider', (slider) => {
      if (!(slider instanceof HTMLInputElement)) {
        throw new Error('The transition-speed control was not found.');
      }
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      valueSetter?.call(slider, '1.5');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(
      () => document.querySelector('.transition-speed-slider')
        ?.getAttribute('aria-valuetext') === '1.5× speed',
      { timeout: 15_000 }
    );
    await page.click('.mode-btn[title="2D QR"]');
    await page.waitForFunction(
      () => document.querySelector('.app-root')?.classList.contains('view-scan'),
      { timeout: 15_000 }
    );
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await page.click(
      '.floating-right-tools .floating-edit-toggle:not(.floating-logo-toggle)'
    );
    await page.waitForSelector('.floating-title-input', { timeout: 15_000 });
    await page.type('.floating-title-input', 'Spring invitation');
    await page.click('.floating-border-toggle');
    await page.click('.floating-show-content-toggle');
    await page.click('.transparent-background-btn');
    await page.click('.floating-logo-toggle');
    await page.waitForSelector('.floating-logo-editor', { timeout: 15_000 });
    await uploadFixtureLogo(page);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const committedLogoBeforeCancel = await page.$eval(
      '.floating-logo-preview',
      (preview) => preview instanceof HTMLImageElement ? preview.src : ''
    );
    const stageBeforeCancelledCrop = await readStageRect(page);
    await selectFixtureLogo(page);
    await verifyLogoCropDialog(page, stageBeforeCancelledCrop);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.logo-crop-dialog', { hidden: true, timeout: 15_000 });
    const cancelledCropState = await page.evaluate(() => ({
      source: document.querySelector('.floating-logo-preview') instanceof HTMLImageElement
        ? document.querySelector('.floating-logo-preview').src
        : '',
      fileInputFocused: document.activeElement?.classList.contains(
        'floating-logo-file-input'
      ),
    }));
    assertLayout(
      cancelledCropState.source === committedLogoBeforeCancel
      && cancelledCropState.fileInputFocused,
      'Canceling a replacement crop changed the committed logo or lost focus restoration.'
    );

    const surface = await page.evaluate(async () => {
      const source = document.querySelector('.designqr-webgl-canvas');
      const canvas = document.querySelector('.designqr-presentation-canvas');
      if (!(source instanceof HTMLCanvasElement) || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('DesignQR presentation canvases were not found.');
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('The displayed DesignQR canvas could not encode PNG.');
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const pixels = canvas.getContext('2d', { willReadFrequently: true })
        ?.getImageData(0, 0, canvas.width, canvas.height).data;
      let greenLogoPixels = 0;
      if (pixels) {
        for (let index = 0; index < pixels.length; index += 4) {
          if (
            pixels[index] < 45
            && pixels[index + 1] > 115
            && pixels[index + 1] < 190
            && pixels[index + 2] < 100
          ) greenLogoPixels += 1;
        }
      }
      return {
        hash: Array.from(
          new Uint8Array(digest),
          (byte) => byte.toString(16).padStart(2, '0')
        ).join(''),
        sourceOpacity: getComputedStyle(source).opacity,
        duplicateDetailsOverlay: Boolean(document.querySelector('.qr-details-overlay')),
        greenLogoPixels,
      };
    });

    assertLayout(surface.sourceOpacity === '0', 'The WebGL source canvas became visible.');
    assertLayout(
      !surface.duplicateDetailsOverlay,
      'A second HTML QR detail renderer is overlapping the presentation canvas.'
    );
    assertLayout(surface.greenLogoPixels > 100, 'The uploaded logo is missing from the editor canvas.');

    await page.click('.share-icon-btn');
    await page.waitForSelector('.share-action-item.primary', { timeout: 15_000 });
    const canonicalShareState = await page.evaluate(() => {
      const editable = document.querySelector('[aria-label="Editable DesignQR link"]');
      if (!(editable instanceof HTMLInputElement)) {
        throw new Error('The editable DesignQR link was not found.');
      }
      const payload = new URL(editable.value).searchParams.get('q');
      return {
        shareUrl: editable.value,
        payload,
        pagePayload: new URL(window.location.href).searchParams.get('q'),
        hasConfigurationError: Boolean(document.querySelector('.share-configuration-error')),
      };
    });
    assertLayout(
      Boolean(canonicalShareState.payload)
      && canonicalShareState.payload === canonicalShareState.pagePayload
      && canonicalShareState.payload.length <= 16_384
      && !canonicalShareState.hasConfigurationError,
      'The editable link did not preserve the canonical logo configuration.'
    );
    await page.click('[data-share-mode="embed"]');
    const canonicalEmbedState = await page.evaluate(() => {
      const hosted = document.querySelector('[aria-label="Hosted DesignQR player URL"]');
      const markup = document.querySelector('[aria-label="DesignQR iframe code"]');
      if (!(hosted instanceof HTMLInputElement) || !(markup instanceof HTMLElement)) {
        throw new Error('The hosted DesignQR integration fields were not found.');
      }
      return {
        payload: new URL(hosted.value).searchParams.get('config'),
        markup: markup.textContent ?? '',
        hostedUrl: hosted.value,
      };
    });
    assertLayout(
      canonicalEmbedState.payload === canonicalShareState.payload
      && canonicalEmbedState.markup.includes(canonicalEmbedState.hostedUrl),
      'The hosted URL or iframe markup did not preserve the canonical logo configuration.'
    );
    await page.click('[data-share-mode="react"]');
    const configuredReactState = await readReactExampleState(page);
    const configuredReactLogo = readReactLogo(configuredReactState.code);
    assertLayout(
      configuredReactState.active.length === 1
      && configuredReactState.active[0] === 'advanced'
      && configuredReactState.recommended.length === 1
      && configuredReactState.recommended[0] === 'advanced'
      && configuredReactState.recommendedClass
      && configuredReactState.recommendedHasIcon
      && configuredReactState.recommendedLabel
        === 'Advanced, recommended for the current editor setup'
      && configuredReactState.copyLabel === 'Copy Advanced React code'
      && configuredReactState.switcherFits
      && configuredReactState.code.includes('useState<DesignQRView>("qr")')
      && configuredReactState.code.includes('tree={{ shape: "dome", seed: 0.5 }}')
      && configuredReactState.code.includes('theme="spring"')
      && configuredReactState.code.includes('view={view}')
      && configuredReactState.code.includes(
        'details={{ title: "Spring invitation", showValue: true, border: { padding: 16 } }}'
      )
      && configuredReactState.code.includes(
        'interaction={{ dragToRotate: true, tapToToggleView: true, autoRotate: false, autoRotateDirection: "clockwise", transitionSpeed: 1.5, motionBlur: true }}'
      )
      && configuredReactState.code.includes('logo={brandLogo}')
      && configuredReactState.code.includes('transparentBackground={true}')
      && configuredReactLogo?.src === committedLogoBeforeCancel
      && configuredReactLogo.alt === 'green brand'
      && configuredReactLogo.size === 0.16
      && !configuredReactState.code.includes('TODO')
      && !configuredReactState.code.includes('/logo.webp'),
      'The configured editor did not default to an exact highlighted Advanced React example.'
    );
    await page.click('[data-react-example="theme"]');
    const configuredThemeSelectionState = await readReactExampleState(page);
    assertLayout(
      configuredThemeSelectionState.active.length === 1
      && configuredThemeSelectionState.active[0] === 'theme'
      && configuredThemeSelectionState.recommended.length === 1
      && configuredThemeSelectionState.recommended[0] === 'advanced',
      'Manual Custom Theme selection changed the configured Advanced recommendation.'
    );
    const configuredThemeReactCode = await page.$eval(
      '[aria-label="DesignQR React code"]',
      (element) => element.textContent ?? ''
    );
    const configuredThemeParameterLines = readCustomThemeParameterLines(
      configuredThemeReactCode
    );
    const configuredThemeReactLogo = readReactLogo(configuredThemeReactCode);
    const configuredThemeChecks = [
      ['custom theme', configuredThemeReactCode.includes('theme={customTheme}')],
      ['exact current component props', configuredThemeReactCode.endsWith(
        expectedCustomThemeComponent({
          view: 'qr',
          details: {
            title: 'Spring invitation',
            showValue: true,
            border: { padding: 16 },
          },
          logo: 'brandLogo',
          transparentBackground: true,
          transitionSpeed: 1.5,
        })
      )],
      ['uploaded logo declaration', configuredThemeReactLogo !== null],
      ['exact uploaded logo source',
        configuredThemeReactLogo?.src === committedLogoBeforeCancel],
      ['exact uploaded logo settings',
        configuredThemeReactLogo?.alt === 'green brand'
        && configuredThemeReactLogo?.size === 0.16],
      ['no placeholder logo', !configuredThemeReactCode.includes('/logo.webp')],
      ['no placeholder TODO', !configuredThemeReactCode.includes('TODO')],
      ['full exact active theme',
        configuredThemeParameterLines.length === expectedSpringThemeParameterLines.length
        && configuredThemeParameterLines.every(
          (line, index) => line === expectedSpringThemeParameterLines[index]
        )],
      ['resolved theme contract', configuredThemeReactCode.includes(
        'satisfies ResolvedTreeTheme'
      )],
    ];
    const failedConfiguredThemeChecks = configuredThemeChecks
      .filter(([, passed]) => !passed)
      .map(([name]) => name);
    assertLayout(
      failedConfiguredThemeChecks.length === 0,
      `The Custom Theme React snippet is missing: ${failedConfiguredThemeChecks.join(', ')}.`
    );
    const configuredThemeCopyFeedback = await clickAndCaptureCopyFeedback(
      page,
      '.react-code-header .share-copy-icon-btn'
    );
    assertLayout(
      configuredThemeCopyFeedback.label === 'Copied!'
      && !configuredThemeCopyFeedback.disabled,
      `Configured Custom Theme copy feedback failed: ${JSON.stringify(configuredThemeCopyFeedback)}.`
    );
    const configuredClipboardText = await page.evaluate(
      () => window.__designQrClipboardText
    );
    assertLayout(
      configuredClipboardText === configuredThemeReactCode,
      'Copy Custom Theme React code did not preserve the exact displayed logo and configuration.'
    );
    await page.click('[data-share-mode="share"]');
    await page.click('.share-action-item.primary');

    let downloadPath;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const filenames = (await readdir(downloadDirectory)).filter(
        (filename) => filename.endsWith('.png')
      );
      if (filenames.length > 0) {
        downloadPath = join(downloadDirectory, filenames[0]);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!downloadPath) throw new Error('The DesignQR PNG download did not complete.');

    const downloaded = await readFile(downloadPath);
    const downloadedHash = createHash('sha256').update(downloaded).digest('hex');
    assertLayout(
      downloadedHash === surface.hash,
      'The downloaded PNG does not match the displayed DesignQR presentation canvas.'
    );

    await page.goto(canonicalShareState.shareUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });
    await page.waitForSelector('.designqr-presentation-canvas', { timeout: 15_000 });
    await page.waitForFunction(
      () => document.querySelector('.app-root')?.classList.contains('view-scan'),
      { timeout: 15_000 }
    );
    await page.click(
      '.floating-right-tools .floating-edit-toggle:not(.floating-logo-toggle)'
    );
    await page.waitForSelector('.floating-title-input', { timeout: 15_000 });
    const restoredDetails = await page.evaluate(() => ({
      title: document.querySelector('.floating-title-input') instanceof HTMLInputElement
        ? document.querySelector('.floating-title-input').value
        : '',
      border: document.querySelector('.floating-border-toggle')?.getAttribute('aria-checked'),
      content: document.querySelector('.floating-show-content-toggle')
        ?.getAttribute('aria-checked'),
      transparent: document.querySelector('.transparent-background-btn')
        ?.getAttribute('aria-pressed'),
      preview: document.querySelector('.main-viewport')
        ?.classList.contains('transparency-preview'),
      transitionSpeed: document.querySelector('.transition-speed-slider')
        instanceof HTMLInputElement
        ? document.querySelector('.transition-speed-slider').value
        : '',
    }));
    await page.click('.floating-logo-toggle');
    await page.waitForSelector('.floating-logo-preview', { timeout: 15_000 });
    const restoredLogo = await page.$eval(
      '.floating-logo-preview',
      (preview) => preview instanceof HTMLImageElement ? preview.src : ''
    );
    assertLayout(
      restoredDetails.title === 'Spring invitation'
      && restoredDetails.border === 'true'
      && restoredDetails.content === 'true'
      && restoredDetails.transparent === 'true'
      && restoredDetails.preview
      && restoredDetails.transitionSpeed === '1.5'
      && restoredLogo.startsWith('data:image/webp;base64,'),
      'The editable direct link did not restore its title, details, speed, and logo.'
    );

    console.log('Design QR WYSIWYG export passed: displayed canvas matches downloaded PNG.');
  } catch (error) {
    throw new Error(`Design QR WYSIWYG export smoke test failed: ${error.message}`);
  } finally {
    await page.close();
    await rm(downloadDirectory, { recursive: true, force: true });
  }
}

const viteBin = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const preview = spawn(
  process.execPath,
  [viteBin, 'preview', '--host', host, '--port', String(port), '--strictPort'],
  { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] }
);
preview.stdout.on('data', (chunk) => {
  previewLog += chunk.toString();
});
preview.stderr.on('data', (chunk) => {
  previewLog += chunk.toString();
});
let browser;

try {
  await waitForPreview(preview);
  const executablePath = await findChrome();
  browser = await puppeteer.launch({
    executablePath,
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

  await verifyRoute(browser, {
    path: '/',
    selectors: ['.design-home', '.design-catalog-card'],
    expectedTitle: 'Design —',
  });
  await verifyRoute(browser, {
    path: '/qr',
    selectors: ['.app-root', '.designqr-webgl-canvas'],
    expectedTitle: 'Design QR',
  });
  await verifyRoute(browser, {
    path: '/not-a-route',
    selectors: ['.design-not-found'],
    expectedTitle: 'Not found',
  });
  await verifyAppNavigation(browser);
  await verifyDesignQrFailureState(browser);
  if (!skipLayout) await verifyDesignQrLayout(browser);
  if (!skipWysiwyg) await verifyDesignQrWysiwygExport(browser);

  console.log('Production smoke test passed for all selected routes and scenarios.');
} finally {
  await browser?.close().catch((error) => {
    console.warn(`Could not close headless Chrome cleanly: ${error.message}`);
  });
  preview.kill('SIGTERM');
}
