import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const { demoRoutes } = JSON.parse(await readFile(join(root, 'docs/design-registry.json'), 'utf8'));
const screenshots = process.env.DEMO_UI_SCREENSHOTS ?? '/tmp/demo-ui-screenshots';
await mkdir(screenshots, { recursive: true });
const server = await preview({ configFile: false, root, preview: { host: '127.0.0.1', port: 0, open: false } });
let browser;

try {
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => { window.__demoClipboard = text; },
    } });
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;
  page.on('request', request => {
    const requestUrl = new URL(request.url());
    if (requestUrl.href === 'https://api.github.com/repos/johnson7543/design') {
      void request.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"stargazers_count":27}' });
    } else if (requestUrl.origin === url || requestUrl.protocol === 'data:' || requestUrl.protocol === 'blob:') {
      void request.continue();
    } else void request.abort();
  });
  const settle = selector => page.$eval(selector, async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
  });
  const paint = selector => page.$eval(selector, element => {
    const style = getComputedStyle(element);
    return Object.fromEntries(['height', 'color', 'backgroundColor', 'borderColor', 'borderWidth', 'borderRadius',
      'boxShadow', 'fontFamily', 'fontSize', 'fontWeight', 'padding', 'gap', 'opacity'].map(key => [key, style[key]]));
  });
  const chrome = () => page.evaluate(() => {
    const style = (selector, properties) => {
      const element = document.querySelector(selector);
      const css = getComputedStyle(element);
      return Object.fromEntries(properties.map(key => [key, css[key]]));
    };
    const frame = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, width: r.width }; };
    const header = document.querySelector('.app-header').getBoundingClientRect();
    const bar = document.querySelector('.customizer-card').getBoundingClientRect();
    const action = document.querySelector('.share-icon-btn');
    return {
      header: { ...frame('.app-header'), height: header.height },
      rail: { ...frame('.controls-overlay'), bottom: innerHeight - bar.bottom },
      panel: style('.customizer-card', ['backgroundColor', 'borderColor', 'borderRadius', 'padding', 'gap', 'boxShadow']),
      github: style('.github-star-link', ['height', 'backgroundColor', 'color', 'borderRadius', 'fontFamily', 'fontSize', 'boxShadow']),
      choice: style('.customizer-card .season-chip', ['height', 'backgroundColor', 'color', 'borderRadius', 'fontFamily', 'fontSize', 'fontWeight', 'padding']),
      export: style('.share-icon-btn', ['width', 'height', 'backgroundColor', 'color', 'borderWidth', 'borderRadius', 'boxShadow']),
      exportIcon: action.querySelector('svg').innerHTML,
    };
  });
  const dialog = () => page.evaluate(() => {
    const style = (selector, properties) => {
      const css = getComputedStyle(document.querySelector(selector));
      return Object.fromEntries(properties.map(key => [key, css[key]]));
    };
    return {
      frame: style('.share-modal-content', ['width', 'height', 'padding', 'borderRadius', 'backgroundColor', 'boxShadow']),
      close: style('.modal-close-btn', ['width', 'height', 'color', 'backgroundColor', 'borderRadius']),
      copy: style('.share-copy-icon-btn:not([aria-pressed])', ['width', 'height', 'color', 'backgroundColor', 'borderRadius']),
      code: style('.share-code-view', ['fontFamily', 'fontSize', 'lineHeight', 'padding', 'color']),
      syntax: style('.syntax-keyword', ['color', 'fontWeight']),
    };
  });

  assert.ok(demoRoutes.includes('/qr'), 'The reference demo must be registered');
  const routes = ['/qr', ...demoRoutes.filter(route => route !== '/qr')];
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    let reference;
    for (const route of routes) {
      console.log(`Checking shared demo UI: ${route} at ${width}px.`);
      await page.goto(`${url}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.share-icon-btn');
      await page.waitForSelector('.github-star-link[data-github-star-count="27"]');
      // Renderer geometry is covered by smoke:production; keep this suite on UI.
      if (route === '/qr') await page.click('.mode-btn[title="2D QR"]');
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, height / 2);
      const current = await chrome();
      // Exercise the shared stage-tone contract independently of game artwork.
      let nightChrome;
      if (!reference) {
        await page.$eval('.app-root', el => { el.dataset.stageTone = 'night'; });
        await settle('.github-star-link');
        nightChrome = await chrome();
        await page.$eval('.app-root', el => { delete el.dataset.stageTone; });
        await settle('.github-star-link');
      }
      const size = width <= 640 ? 34 : 38;
      assert.equal(current.export.width, `${size}px`, `${route}: Export is a standard square`);
      assert.equal(current.export.height, `${size}px`);
      assert.equal(await page.$eval('.share-icon-btn', el => el.textContent.trim()), '', 'Export stays icon-only');
      assert.equal(await page.$eval('.share-icon-btn', el => !!el.getAttribute('aria-label') && el.getAttribute('aria-haspopup') === 'dialog'), true);
      assert.equal(await page.$eval('.app-root', el => el.scrollWidth <= el.clientWidth), true, `${route}: no horizontal page overflow`);
      if (reference) assert.deepEqual(current, reference.chrome, `${route}: chrome matches DesignQR at ${width}px`);

      await page.hover('.share-icon-btn');
      await settle('.share-icon-btn');
      const hover = await paint('.share-icon-btn');
      await page.mouse.move(0, height / 2);
      await page.keyboard.press('Tab');
      await page.focus('.share-icon-btn');
      assert.equal(await page.$eval('.share-icon-btn', el => el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none'), true);
      await page.$eval('.share-icon-btn', el => { el.disabled = true; });
      await settle('.share-icon-btn');
      const disabled = await paint('.share-icon-btn');
      await page.$eval('.share-icon-btn', el => { el.disabled = false; });
      if (reference) {
        assert.deepEqual(hover, reference.hover, `${route}: hover matches DesignQR`);
        assert.deepEqual(disabled, reference.disabled, `${route}: disabled matches DesignQR`);
      }
      await page.mouse.move(0, height / 2);
      await settle('.share-icon-btn');
      const prefix = `${route.slice(1).replaceAll('/', '-')}-${width}`;
      await page.screenshot({ path: join(screenshots, `${prefix}.png`) });
      await page.click('.share-icon-btn');
      await page.waitForSelector('.demo-dialog-backdrop[open]');
      assert.equal(await page.$eval('.demo-dialog-backdrop', el => el.matches(':modal')), true);
      assert.equal(await page.$eval('.modal-close-btn', el => el === document.activeElement), true);
      await page.$eval('.share-icon-btn', el => el.focus());
      assert.equal(await page.$eval('.demo-dialog-backdrop', el => el.contains(document.activeElement)), true, 'Background stays inert');
      await page.keyboard.down('Shift');
      await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      assert.equal(await page.$eval('.demo-dialog-backdrop', el => el.contains(document.activeElement)), true, 'Shift+Tab stays in dialog');
      await page.keyboard.press('Tab');
      assert.equal(await page.$eval('.modal-close-btn', el => el === document.activeElement), true, 'Tab wraps to Close');
      if (await page.$('[data-share-mode="react"]')) await page.click('[data-share-mode="react"]');
      await settle('.share-modal-content');
      const currentDialog = await dialog();
      if (reference) assert.deepEqual(currentDialog, reference.dialog, `${route}: export frame, code controls, and syntax match DesignQR`);
      else reference = { chrome: current, nightChrome, hover, disabled, dialog: currentDialog };
      assert.equal(await page.$eval('.share-modal-content', el => {
        const rect = el.getBoundingClientRect();
        return rect.left >= 12 && rect.right <= innerWidth - 12 && rect.top >= 12 && rect.bottom <= innerHeight - 12 && el.scrollWidth <= el.clientWidth;
      }), true, 'Dialog stays within the viewport');
      await page.screenshot({ path: join(screenshots, `${prefix}-export.png`) });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.click('.share-code-header .share-copy-icon-btn:not([aria-pressed])');
      await page.waitForSelector('.share-copy-icon-btn.copied');
      await settle('.share-copy-icon-btn.copied');
      const feedback = await page.$eval('.share-copy-icon-btn.copied', element => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--qr-success)';
        element.appendChild(probe);
        const expectedBackground = getComputedStyle(probe).color;
        probe.remove();
        const style = getComputedStyle(element);
        return { color: style.color, backgroundColor: style.backgroundColor, borderColor: style.borderColor, expectedBackground };
      });
      assert.ok(await page.evaluate(() => window.__demoClipboard?.length > 0), 'Copy writes the example');
      assert.equal(feedback.backgroundColor, feedback.expectedBackground, 'Copy success remains visible while hovered');
      assert.notEqual(feedback.color, feedback.backgroundColor, 'Copy success has a contrasting check');
      if (reference.copied) assert.deepEqual(feedback, reference.copied, `${route}: Copy feedback matches DesignQR`);
      else reference.copied = feedback;
      if (route === '/qr' && width === 1440) {
        await page.evaluate(() => {
          navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied'); };
          document.execCommand = command => {
            const field = document.activeElement;
            window.__demoFallbackInModal = command === 'copy' && field instanceof HTMLTextAreaElement
              && !!field.closest('dialog:modal') && field.selectionEnd === field.value.length;
            return window.__demoFallbackInModal;
          };
        });
        await page.click('.share-code-header .share-copy-icon-btn:not([aria-pressed])');
        await page.waitForFunction(() => window.__demoFallbackInModal === true);
        assert.equal(await page.$eval('.share-code-header .share-copy-icon-btn:not([aria-pressed])', el => el === document.activeElement), true,
          'Clipboard fallback stays inside the modal and restores focus');
      }
      await page.keyboard.press('Escape');
      await page.waitForSelector('.demo-dialog-backdrop', { hidden: true });
      assert.equal(await page.$eval('.share-icon-btn', el => el === document.activeElement && el.getAttribute('aria-expanded') === 'false'), true);
      await page.emulateMediaFeatures([]);

      // Every Pullground preset retains the same chrome while recoloring the game.
      for (const theme of await page.$$eval('.pullground-demo-theme', buttons => buttons.map(button => button.dataset.theme))) {
        await page.click(`.pullground-demo-theme[data-theme="${theme}"]`);
        await page.mouse.move(0, height / 2);
        await settle('.github-star-link');
        assert.deepEqual(await chrome(), theme === 'midnight' ? reference.nightChrome : reference.chrome, `${theme}: game themes must not restyle demo controls`);
        await page.click('.share-icon-btn');
        await page.waitForSelector('.demo-dialog-backdrop[open]');
        await settle('.share-modal-content');
        assert.deepEqual(await dialog(), reference.dialog, `${theme}: dialogs retain the shared interface`);
        if (theme === 'midnight') await page.screenshot({ path: join(screenshots, `${prefix}-midnight-export.png`) });
        await page.mouse.click(2, 2);
        await page.waitForSelector('.demo-dialog-backdrop', { hidden: true });
        if (theme === 'midnight') await page.screenshot({ path: join(screenshots, `${prefix}-midnight.png`) });
      }
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.click('.share-icon-btn');
      await page.waitForSelector('.demo-dialog-backdrop[open]');
      assert.equal(await page.$eval('.share-modal-content', el => getComputedStyle(el).animationName), 'none');
      await page.keyboard.press('Escape');
      await page.emulateMediaFeatures([]);
    }
  }
  assert.deepEqual(errors, [], 'Demos do not produce runtime errors');
  console.log(`Shared demo UI checks passed for ${demoRoutes.join(', ')} at desktop and mobile sizes. Screenshots: ${screenshots}`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
