import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const host = '127.0.0.1';
const port = Number(process.env.PREVIEW_PORT ?? 4173);
const url = `http://${host}:${port}`;
let previewLog = '';

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

function assertLayout(condition, message) {
  if (!condition) throw new Error(message);
}

function nearlyEqual(actual, expected, tolerance = 0.75) {
  return Math.abs(actual - expected) <= tolerance;
}

async function verifyDesignQrLayout(browser) {
  const scenarios = [
    { name: 'desktop', width: 1440, height: 900, controlHeight: 38, headerWidth: 760 },
    { name: 'small mobile', width: 320, height: 568, controlHeight: 34, headerWidth: 284 },
  ];
  const appOrigin = new URL(url).origin;

  for (const scenario of scenarios) {
    const page = await browser.newPage();
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
        return {
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          header: rect('.app-header'),
          controls: rect('.controls-overlay'),
          season: rect('.season-chip'),
          addTheme: rect('.add-theme-chip-compact'),
          drawerTool: rect('.drawer-icon-btn'),
          speed: rect('.transition-speed-control'),
          speedSlider: rect('.transition-speed-slider'),
          speedValue: rect('.transition-speed-value'),
          share: rect('.share-icon-btn'),
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
        layout.speedSlider.left - layout.speed.left >= 8 &&
        layout.speed.right - layout.speedValue.right >= 8,
        `${scenario.name}: speed control content is too close to its edge.`
      );

      await page.click('.add-theme-chip-compact');
      await page.waitForSelector('.custom-theme-aside-panel');
      await new Promise((resolve) => setTimeout(resolve, 350));
      const editor = await page.evaluate(() => {
        const preview = document.querySelector('.theme-live-preview-card').getBoundingClientRect();
        const panel = document.querySelector('.custom-theme-aside-panel').getBoundingClientRect();
        const form = document.querySelector('.aside-theme-form');
        return {
          previewHeight: preview.height,
          panelHeight: panel.height,
          formWidth: form.clientWidth,
          formScrollWidth: form.scrollWidth,
        };
      });
      assertLayout(
        nearlyEqual(editor.previewHeight, 110),
        `${scenario.name}: theme preview was compressed to ${editor.previewHeight}px.`
      );
      assertLayout(
        editor.formScrollWidth <= editor.formWidth + 1,
        `${scenario.name}: theme editor has horizontal overflow (${editor.formScrollWidth}px > ${editor.formWidth}px).`
      );
      if (scenario.width <= 640) {
        assertLayout(
          editor.panelHeight >= scenario.height * 0.7,
          `${scenario.name}: theme sheet is too short for mobile editing.`
        );
      }
      await page.click('.custom-theme-aside-panel .modal-close-btn');
      await page.waitForSelector('.custom-theme-aside-panel', { hidden: true });

      await page.click('.share-icon-btn');
      await page.waitForSelector('.share-modal-content');
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
        && !reactState.code.includes('quality='),
        `${scenario.name}: React installation or minimal component snippet is incorrect.`
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
          throw new Error('Advance React example was not found.');
        }
        return {
          height: modal.getBoundingClientRect().height,
          code: code.textContent ?? '',
          selected: document.querySelector('[data-react-example="advanced"]')
            ?.getAttribute('aria-pressed'),
        };
      });
      assertLayout(
        advancedReactState.selected === 'true'
        && advancedReactState.code.includes("import { DesignQR } from 'designqr';")
        && !advancedReactState.code.includes('useRef')
        && !advancedReactState.code.includes('DesignQRHandle')
        && !advancedReactState.code.includes('ref={playerRef}')
        && advancedReactState.code.includes('design="tree"')
        && advancedReactState.code.includes('tree={{ shape: "dome", seed: 0.5 }}')
        && advancedReactState.code.includes('theme="spring"')
        && advancedReactState.code.includes('defaultView="design"')
        && advancedReactState.code.includes('details={{ title: "", showValue: false, border: false }}')
        && advancedReactState.code.includes('interaction={{ dragToRotate: true, tapToToggleView: true, autoRotate: false, motionBlur: true }}')
        && advancedReactState.code.includes('quality="high"')
        && advancedReactState.code.includes('className=""')
        && advancedReactState.code.includes('style={{ width: "100%", maxWidth: 480 }}')
        && advancedReactState.code.includes('ariaLabel="Interactive DesignQR"')
        && advancedReactState.code.includes('onReady=')
        && advancedReactState.code.includes('onViewChange=')
        && advancedReactState.code.includes('onError='),
        `${scenario.name}: Advance React example does not expose the customization surface.`
      );
      assertLayout(
        nearlyEqual(advancedReactState.height, shareState.height),
        `${scenario.name}: Share modal height changed between React examples.`
      );

      await page.click('.share-modal-content .modal-close-btn');
      await page.waitForSelector('.share-modal-content', { hidden: true });

      await page.click('.mode-btn[title="2D QR"]');
      await page.waitForFunction(
        () => document.querySelector('.app-root')?.classList.contains('view-scan'),
        { timeout: 15_000 }
      );
      await page.click('.floating-edit-toggle');
      await page.waitForSelector('.floating-flat-qr-controls');
      await new Promise((resolve) => setTimeout(resolve, 450));
      const detailsWidth = await page.$eval(
        '.floating-flat-qr-controls',
        (element) => element.getBoundingClientRect().width
      );
      assertLayout(
        detailsWidth <= layout.controls.width - 15,
        `${scenario.name}: expanded 2D details editor exceeds the control rail (${detailsWidth}px).`
      );

      console.log(`Design QR layout passed: ${scenario.name}.`);
    } catch (error) {
      throw new Error(`Design QR layout smoke test failed for ${scenario.name}: ${error.message}`);
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
    await page.waitForSelector('.designqr-presentation-canvas', { timeout: 15_000 });
    await page.click('.mode-btn[title="2D QR"]');
    await page.waitForFunction(
      () => document.querySelector('.app-root')?.classList.contains('view-scan'),
      { timeout: 15_000 }
    );
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await page.click('.floating-edit-toggle');
    await page.waitForSelector('.floating-title-input', { timeout: 15_000 });
    await page.type('.floating-title-input', 'Spring invitation');
    await page.click('.floating-border-toggle');
    await page.click('.floating-show-content-toggle');
    await new Promise((resolve) => setTimeout(resolve, 300));

    const surface = await page.evaluate(async () => {
      const source = document.querySelector('.designqr-webgl-canvas');
      const canvas = document.querySelector('.designqr-presentation-canvas');
      if (!(source instanceof HTMLCanvasElement) || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('DesignQR presentation canvases were not found.');
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('The displayed DesignQR canvas could not encode PNG.');
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      return {
        hash: Array.from(
          new Uint8Array(digest),
          (byte) => byte.toString(16).padStart(2, '0')
        ).join(''),
        sourceOpacity: getComputedStyle(source).opacity,
        duplicateDetailsOverlay: Boolean(document.querySelector('.qr-details-overlay')),
      };
    });

    assertLayout(surface.sourceOpacity === '0', 'The WebGL source canvas became visible.');
    assertLayout(
      !surface.duplicateDetailsOverlay,
      'A second HTML QR detail renderer is overlapping the presentation canvas.'
    );

    await page.click('.share-icon-btn');
    await page.waitForSelector('.share-action-item.primary', { timeout: 15_000 });
    await page.click('[data-share-mode="react"]');
    const configuredReactCode = await page.$eval(
      '[aria-label="DesignQR React code"]',
      (element) => element.textContent ?? ''
    );
    assertLayout(
      configuredReactCode.includes('defaultView="qr"')
      && configuredReactCode.includes(
        'details={{ title: "Spring invitation", showValue: true, border: { padding: 16 } }}'
      )
      && !configuredReactCode.includes('theme=')
      && !configuredReactCode.includes('interaction='),
      'The minimal React snippet did not preserve changed 2D detail settings.'
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
  await verifyDesignQrLayout(browser);
  await verifyDesignQrWysiwygExport(browser);

  console.log('Production smoke test passed for all routes.');
} finally {
  await browser?.close().catch((error) => {
    console.warn(`Could not close headless Chrome cleanly: ${error.message}`);
  });
  preview.kill('SIGTERM');
}
