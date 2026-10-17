import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { build, preview } from 'vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixtureRoot = join(root, 'examples/pullground-consumer');
const dist = process.env.PULLGROUND_CONSUMER_DIST ?? join(fixtureRoot, 'dist');
if (!process.env.PULLGROUND_CONSUMER_DIST) {
  await build({ configFile: false, root: fixtureRoot, plugins: [react()], logLevel: 'warn' });
}
const server = await preview({ configFile: false, root, build: { outDir: dist }, preview: { host: '127.0.0.1', port: 0, open: false } });
const address = server.httpServer.address();
const url = `http://127.0.0.1:${address.port}`;
const screenshots = process.env.PULLGROUND_SCREENSHOTS ?? '/tmp/pullground-screenshots';
await mkdir(screenshots, { recursive: true });
let browser;
let siteServer;
const first = 'section[aria-label="First feed"]';
const viewport = `${first} .pullground-viewport`;
const errors = [];

try {
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    const original = window.requestAnimationFrame.bind(window);
    window.fixtureFrames = { count: 0, original };
    window.requestAnimationFrame = callback => { window.fixtureFrames.count++; return original(callback); };
    document.addEventListener('pointerdown', event => { window.fixturePointer = event.pointerId; });
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${message.text()} (${message.location().url ?? ''})`); });
  const load = async (path = '/') => {
    await page.goto(`${url}${path}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction('!!window.pullgroundFixture');
  };
  const count = () => page.evaluate(() => window.pullgroundFixture.record.calls.length);
  const trigger = (instance = 0) => page.evaluate(instance => { void window.pullgroundFixture.trigger(instance); }, instance);
  const waitCount = expected => page.waitForFunction(n => window.pullgroundFixture.record.calls.length === n, {}, expected);
  const idle = (selector = first) => page.waitForFunction(selector => {
    const root = document.querySelector(selector);
    return root.querySelector('.pullground-reveal').getBoundingClientRect().height === 0
      && root.querySelector('.pullground-content').dataset.returning !== 'true';
  }, {}, selector);
  const uprightPins = (selector = first) => page.$eval(`${selector} .pullground-bowling-pins`, rack =>
    rack.children.length === 10 && [...rack.children].every(pin => {
      const m = pin.transform.baseVal.consolidate().matrix;
      return Math.abs(m.b) < 0.001 && Math.abs(m.c) < 0.001 && Math.abs(m.a - m.d) < 0.001;
    }));
  const bowlingStrike = (selector = first) => page.waitForFunction(selector => {
    const pins = [...document.querySelectorAll(`${selector} .pullground-bowling-pin`)];
    return pins.length === 10 && pins.every(pin => {
      const m = pin.transform.baseVal.consolidate().matrix;
      // A pin can tip straight back and foreshorten without rotating sideways.
      return Math.abs(m.b) > 0.3 || Math.hypot(m.c, m.d) / Math.hypot(m.a, m.b) < 0.8;
    });
  }, {}, selector);
  const completed = async (selector = first) => {
    await page.waitForFunction(selector => document.querySelector(selector).dataset.state === 'success', {}, selector);
    assert.equal(await uprightPins(selector), true, 'Completion immediately restores the bowling rack');
    assert.deepEqual(await page.$eval(selector, root => {
      const reveal = root.querySelector('.pullground-reveal');
      const status = root.querySelector('.pullground-status');
      return {
        busy: root.querySelector('.pullground-content').getAttribute('aria-busy'),
        art: root.dataset.art,
        hidden: reveal.getAttribute('aria-hidden'),
        targetHeight: reveal.style.getPropertyValue('--pullground-reveal-height'),
        text: status.textContent,
        visibility: getComputedStyle(status).visibility,
        announcement: root.querySelector('.pullground-sr-only[role="status"]').textContent,
        board: root.querySelector('.pullground-board-panel').getAttribute('opacity'),
        fragments: root.querySelector('.pullground-board-fragments').getAttribute('opacity'),
        impact: root.querySelector('.pullground-impact').getAttribute('opacity'),
        dartPulse: root.querySelector('.pullground-dart-scene .pullground-pulse').getAttribute('opacity'),
        aim: root.querySelector('.pullground-aim').getAttribute('d'),
        netFront: root.querySelector('.pullground-net-front').getAttribute('d'),
        ripples: [...root.querySelector('.pullground-stone-ripples').children].some(ripple => Number(ripple.getAttribute('opacity')) > 0),
      };
    }), {
      busy: 'false', art: 'false', hidden: 'true', targetHeight: '0px',
      text: '', visibility: 'hidden', announcement: 'Done',
      board: '1', fragments: '0', impact: '0', dartPulse: '0', aim: null, netFront: '', ripples: false,
    }, 'Success immediately clears visible status and artwork, starts closing, and still announces completion');
  };
  const resolve = async index => {
    const instance = await page.evaluate(i => {
      window.pullgroundFixture.resolve(i);
      return window.pullgroundFixture.record.calls[i].instance;
    }, index);
    await completed(instance ? 'section[aria-label="Second feed"]' : first);
  };
  const pull = async (distance, back = false, offsetX = 0) => {
    const box = await page.$eval(viewport, (element, offsetX) => { element.scrollTop = 0; element.scrollIntoView({ block: 'center' }); const r = element.getBoundingClientRect(); return { x: r.x + (offsetX ? r.width / 2 : 20), y: r.y + 24 }; }, offsetX);
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x + offsetX, box.y + distance, { steps: 8 });
    if (back) await page.mouse.move(box.x, box.y, { steps: 5 });
    await page.mouse.up();
  };
  const frames = () => page.evaluate(() => new Promise(resolve => {
    const next = window.fixtureFrames.original;
    next(() => next(() => next(resolve)));
  }));
  const impactVisible = (selector = first) => page.waitForFunction(selector => {
    const root = document.querySelector(selector);
    const fragments = root.querySelector('.pullground-board-fragments');
    return Number(fragments.getAttribute('opacity')) > 0.8
      && fragments.firstElementChild.transform.baseVal.consolidate().matrix.e < -8
      && Number(root.querySelector('.pullground-impact').getAttribute('opacity')) > 0;
  }, {}, selector);
  const intactBoard = async (selector = first) => {
    assert.deepEqual(await page.$eval(selector, root => [
      root.querySelector('.pullground-board-panel').getAttribute('opacity'),
      root.querySelector('.pullground-board-fragments').getAttribute('opacity'),
      root.querySelector('.pullground-impact').getAttribute('opacity'),
    ]), ['1', '0', '0'], 'The backboard resets without lingering fragments or impact');
  };
  const settledReveal = (selector = first) => page.waitForFunction(selector => {
    const root = document.querySelector(selector);
    const reveal = root.querySelector('.pullground-reveal');
    return root.dataset.art === 'true'
      && Math.abs(parseFloat(getComputedStyle(reveal).blockSize) - parseFloat(reveal.style.getPropertyValue('--pullground-reveal-height'))) < 0.05;
  }, {}, selector);
  const sceneGeometry = (selector = first) => page.$eval(selector, root => {
    const viewport = root.querySelector('.pullground-viewport').getBoundingClientRect();
    const basis = Math.min(viewport.width, viewport.height);
    const court = root.querySelector('.pullground-court');
    const matrix = court.getScreenCTM();
    const board = root.querySelector('.pullground-backboard').getBoundingClientRect();
    const ball = root.querySelector('.pullground-ball').parentElement.transform.baseVal.consolidate().matrix;
    return {
      reveal: root.querySelector('.pullground-reveal').getBoundingClientRect().height / basis,
      art: Math.hypot(matrix.a, matrix.b) / basis,
      aspect: board.width / board.height,
      centered: Math.abs(matrix.a * 80 + matrix.e - viewport.left - viewport.width / 2) < 1,
      pose: [ball.a, ball.b, ball.c, ball.d, ball.e, ball.f],
    };
  });
  let referencePull;
  const checkPullProportions = async (selector = first) => {
    const geometry = await sceneGeometry(selector);
    referencePull ??= geometry;
    assert.ok(Math.abs(geometry.reveal - referencePull.reveal) < 0.001, 'Equivalent pulls reveal the same fraction of the container');
    assert.ok(Math.abs(geometry.art - referencePull.art) < 0.00001, 'Artwork scales with the container, including embeds and zoom');
    assert.ok(Math.abs(geometry.aspect - 42 / 28) < 0.001 && geometry.centered, 'The basketball scene stays centered and undistorted');
    assert.ok(geometry.pose.every((value, index) => Math.abs(value - referencePull.pose[index]) < 0.15), 'Equivalent relative pulls produce the same ball pose and shot power');
  };
  const checkConsumerProportions = async () => {
    const box = await page.$eval(viewport, el => {
      el.scrollTop = 0;
      el.scrollIntoView({ block: 'center' });
      const rect = el.getBoundingClientRect();
      return { x: rect.x + 20, y: rect.y + 24, distance: Math.min(rect.width, rect.height) * 0.32 };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x, box.y + box.distance, { steps: 8 });
    await checkPullProportions();
    await page.mouse.move(box.x + box.distance * 0.375, box.y + box.distance, { steps: 4 });
    const aimed = await sceneGeometry();
    assert.ok(Math.abs(aimed.pose[4] - 86.144) < 0.15, 'Sideways steering uses the same proportional input scale, including zoom and embeds');
    assert.ok(Math.abs(aimed.reveal - referencePull.reveal) < 0.001, 'Steering without pulling farther does not change reveal height');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await idle();
  };
  const checkStyles = async (target = page) => {
    assert.deepEqual(await target.evaluate(() => {
      const firstViewport = document.querySelector('section[aria-label="First feed"] .pullground-viewport');
      const secondRoot = document.querySelector('section[aria-label="Second feed"]');
      return {
        stylesheets: document.querySelectorAll('style[data-href~="@johnson7543/pullground"]').length,
        defaultHeight: getComputedStyle(firstViewport).blockSize,
        scrolling: getComputedStyle(firstViewport).overflowY,
        customHeight: getComputedStyle(secondRoot.querySelector('.pullground-viewport')).blockSize,
        customSurface: getComputedStyle(secondRoot).getPropertyValue('--pullground-surface').trim(),
        hiddenInstructions: getComputedStyle(document.querySelector('.pullground-sr-only')).position,
      };
    }), {
      stylesheets: 1, defaultHeight: '384px', scrolling: 'auto',
      customHeight: '240px', customSurface: '#f6f1e7', hiddenInstructions: 'absolute',
    }, 'One automatic stylesheet supplies layout and preserves consumer overrides');
  };
  if (process.env.PULLGROUND_SSR) {
    const serverPage = await browser.newPage();
    await serverPage.setJavaScriptEnabled(false);
    await serverPage.goto(`${url}/ssr.html`, { waitUntil: 'networkidle0' });
    await checkStyles(serverPage);
    await serverPage.close();
  }
  await page.setViewport({ width: 1440, height: 900 });
  await load(process.env.PULLGROUND_SSR ? '/ssr.html' : '/');
  await checkStyles();
  assert.equal(await count(), 0, 'No mount request, including StrictMode/hydration');
  assert.equal(await page.$eval(first, root => [...root.querySelectorAll('button')].every(button => root.querySelector('.pullground-content').contains(button))), true, 'All buttons belong to the consumer content');
  await idle();
  await page.click('.fixture-child');
  assert.equal(await page.$eval('.fixture-child', el => el.textContent), 'Child 1');
  await page.click('.fixture-link');
  assert.equal(await count(), 0);
  await page.focus('.consumer-fixture input');
  await page.keyboard.press('Home');
  await page.keyboard.type('Edited ');
  assert.equal(await count(), 0, 'Child input keeps its own keyboard interaction');
  for (const selector of ['.fixture-nested', '.fixture-ignore']) {
    const box = await page.$eval(selector, el => { const r = el.getBoundingClientRect(); return { x: r.x + 20, y: r.y + 10 }; });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x, box.y + 30, { steps: 3 });
    await page.mouse.up();
    assert.equal(await count(), 0, `${selector} retains drag ownership`);
  }
  await page.focus('.fixture-child');
  await page.keyboard.down('Shift');
  await page.keyboard.press('Tab');
  await page.keyboard.up('Shift');
  assert.equal(await page.$eval(viewport, el => el === document.activeElement && getComputedStyle(el).outlineWidth === '2px'), true);
  await pull(4);
  await waitCount(1);
  assert.equal(await page.$eval(`${first} .pullground-content`, el => el.getAttribute('aria-busy')), 'true');
  assert.equal(await page.$eval(`${first} [role="status"]`, el => !el.closest('[aria-busy]') && el.textContent === 'Working…'), true);
  assert.equal(await page.evaluate(() => window.pullgroundFixture.join()), true, 'Imperative calls share Promise identity');
  assert.equal(await count(), 1);
  await page.waitForFunction(selector => document.querySelector(selector).dataset.art === 'false', {}, first);
  await page.waitForFunction(selector => Math.abs(document.querySelector(selector).getBoundingClientRect().height - 44) < 1, {}, `${first} .pullground-reveal`);
  await resolve(0);
  await idle();
  assert.equal(await page.$eval('.fixture-child', el => el.textContent), 'Child 1', 'Content identity survives');
  assert.equal(await page.$eval('body', el => el.dataset.submitted), undefined, 'No implicit form submission');
  await pull(60, true);
  await waitCount(2);
  await page.evaluate(() => window.pullgroundFixture.reject(1));
  await page.waitForFunction(selector => document.querySelector(selector).dataset.state === 'error', {}, first);
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.errors), 1);
  assert.equal(await page.$eval(`${first} .pullground-status`, el => el.textContent.trim()), 'Something went wrong. Try again.');
  await page.evaluate(() => { window.pullgroundFixture.record.mode = 'throw'; });
  await page.focus(viewport);
  await page.keyboard.press('Enter');
  await waitCount(3);
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.calls[2].context.source), 'keyboard', 'Keyboard trigger retries a failed pull');
  await page.waitForFunction('window.pullgroundFixture.record.errors === 2');
  await page.evaluate(() => { window.pullgroundFixture.record.mode = 'immediate'; });
  await pull(4);
  await waitCount(4);
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.calls[3].context.source), 'pull', 'A new pull retries a failed keyboard trigger');
  await completed();
  await idle();
  assert.equal(await page.$eval(first, el => el.dataset.art), 'false', 'An immediate retry leaves no artwork');

  // A pull can perform a synchronous local action with no network request.
  await load();
  await page.evaluate(() => { window.pullgroundFixture.record.mode = 'sync'; });
  await pull(4);
  await waitCount(1);
  await completed();
  await idle();
  assert.equal(await page.$eval('.fixture-child', el => el.textContent), 'Child 1', 'A synchronous onPull updates local content once');
  await trigger();
  await waitCount(2);
  await completed();
  assert.equal(await page.$eval('.fixture-child', el => el.textContent), 'Child 2', 'trigger() runs the same general action');
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.calls[1].context.source), 'imperative');

  // A make deforms individual cords while the rim anchors and consumer stay still.
  await load();
  const restMesh = await page.$eval(`${first} .pullground-net-under`, el => el.getAttribute('d'));
  await pull(122.4);
  await waitCount(1);
  await page.waitForFunction(selector => {
    const front = document.querySelector(`${selector} .pullground-net-front`);
    const box = front.getBBox();
    return front.getAttribute('d') && box.y + box.height > 61;
  }, {}, first);
  assert.deepEqual(await page.$eval(`${first} .pullground-net-front`, el => {
    const anchor = el.getPointAtLength(0);
    return { x: anchor.x, y: anchor.y, transform: el.getAttribute('transform') };
  }), { x: 95, y: 34, transform: null }, 'The net stretches beneath a fixed rim, without translating');
  assert.equal(await page.$eval(`${first} .pullground-net-under`, el => el.getAttribute('d')), '', 'A descending make passes behind the near cords');
  await page.screenshot({ path: join(screenshots, 'basketball-net-stretch.png') });
  await resolve(0);
  assert.equal(await page.$eval(`${first} .pullground-net-under`, el => el.getAttribute('d')), restMesh, 'Completion restores the resting mesh immediately');
  await idle();

  // Full power has its own impact, but it never extends the operation's lifetime.
  for (const ending of ['success', 'error', 'reduced', 'hidden']) {
    await load();
    if (ending === 'success') {
      await page.focus(viewport);
      await page.keyboard.down('Space');
      await page.waitForFunction(selector => document.querySelector(selector)
        .querySelector('.pullground-ball').parentElement.transform.baseVal.consolidate().matrix.f >= 106, {}, first);
      await page.keyboard.up('Space');
    } else await pull(210);
    await waitCount(1);
    await impactVisible();
    assert.equal(await page.$eval(`${first} .pullground-board-panel`, el => el.getAttribute('opacity')), '0', 'Full power breaks the board at contact');
    if (ending === 'success') await resolve(0);
    if (ending === 'error') {
      await page.evaluate(() => window.pullgroundFixture.reject(0));
      await page.waitForFunction(selector => document.querySelector(selector).dataset.state === 'error', {}, first);
    }
    if (ending === 'reduced') {
      await page.evaluate(() => window.pullgroundFixture.setMotion('reduced'));
      await page.waitForFunction(selector => document.querySelector(selector).dataset.reduced === 'true', {}, first);
    }
    if (ending === 'hidden') await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await intactBoard();
    assert.equal(await page.$eval(first, el => el.dataset.art), 'false', `${ending} immediately stops the impact`);
    if (ending === 'reduced' || ending === 'hidden') await resolve(0);
    if (ending === 'hidden') await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    if (ending === 'success') {
      await idle();
      await pull(122.4);
      await waitCount(2);
      await settledReveal();
      await intactBoard();
      await resolve(1);
      await idle();
    }
  }

  // A resolved host operation must not wait for an unfinished decorative shot.
  await load();
  await pull(122.4);
  await waitCount(1);
  assert.equal(await page.$eval(first, el => el.dataset.art), 'true');
  await settledReveal();
  const returnFrames = await page.evaluate(async selector => {
    const root = document.querySelector(selector);
    const content = root.querySelector('.pullground-content');
    const reveal = root.querySelector('.pullground-reveal');
    const frames = [];
    window.pullgroundFixture.resolve(0);
    await new Promise(resolve => {
      const sample = () => {
        if (root.dataset.state === 'success') {
          frames.push({ layoutTop: content.offsetTop, visualTop: content.getBoundingClientRect().top, revealHeight: reveal.getBoundingClientRect().height });
          if (content.dataset.returning !== 'true') { resolve(); return; }
        }
        window.fixtureFrames.original(sample);
      };
      window.fixtureFrames.original(sample);
    });
    return frames;
  }, first);
  assert.ok(returnFrames.length > 2, 'The return slide has intermediate visual positions');
  assert.ok(returnFrames.every(frame => frame.revealHeight === 0 && frame.layoutTop === returnFrames[0].layoutTop), 'Returning does not move the consumer layout on each frame');
  assert.ok(returnFrames[0].visualTop > returnFrames.at(-1).visualTop + 20, 'The content slides back while its layout stays fixed');
  assert.ok(returnFrames.every((frame, index) => !index || frame.visualTop <= returnFrames[index - 1].visualTop + 0.1), 'The return moves steadily toward rest without a jump backward');
  await completed();
  const completedFrames = await page.evaluate(() => window.fixtureFrames.count);
  await frames();
  assert.equal(await page.evaluate(() => window.fixtureFrames.count), completedFrames, 'Completion cancels the remaining shot frames');
  await idle();

  // A new pull can take over the return slide from its current visual position.
  await pull(122.4);
  await waitCount(2);
  await resolve(1);
  const interruption = await page.evaluate(selector => {
    const element = document.querySelector(selector);
    const content = element.querySelector('.pullground-content');
    const animation = content.getAnimations()[0];
    if (!animation) throw new Error('Expected the completion slide to be running');
    animation.pause();
    animation.currentTime = 40;
    const before = content.getBoundingClientRect().top;
    const { x, y } = element.getBoundingClientRect();
    const touch = dy => new Touch({ identifier: 7, target: element, clientX: x + 20, clientY: y + 20 + dy });
    element.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(0)], changedTouches: [touch(0)], bubbles: true }));
    element.dispatchEvent(new TouchEvent('touchmove', { touches: [touch(4)], changedTouches: [touch(4)], bubbles: true, cancelable: true }));
    const after = content.getBoundingClientRect().top;
    element.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touch(4)], bubbles: true }));
    return after - before;
  }, viewport);
  assert.ok(Math.abs(interruption - 4 * 0.88) < 1, 'Interrupting the return preserves the current offset instead of snapping');
  await waitCount(3);
  await resolve(2);
  await idle();

  for (const interruption of ['reduced', 'unmount']) {
    await load();
    await pull(122.4);
    await waitCount(1);
    await resolve(0);
    await page.evaluate((selector, reason) => {
      const content = document.querySelector(selector).querySelector('.pullground-content');
      const animation = content.getAnimations()[0];
      if (!animation) throw new Error('Expected an active return animation');
      animation.pause();
      animation.currentTime = 40;
      window.fixtureReturnAnimation = animation;
      if (reason === 'reduced') window.pullgroundFixture.setMotion('reduced');
      else window.pullgroundFixture.setMounted(false);
    }, first, interruption);
    await page.waitForFunction(() => window.fixtureReturnAnimation.playState === 'idle');
    if (interruption === 'reduced') {
      await idle();
      assert.equal(await page.$eval(`${first} .pullground-content`, el => getComputedStyle(el).transform), 'none', 'Reduced motion immediately releases the return transform');
    } else assert.equal(await page.$(first), null, 'Unmount cancels the return animation');
  }

  await load();
  await page.focus(viewport);
  await page.keyboard.down('Space');
  await page.keyboard.down('Space');
  await page.keyboard.press('Escape');
  await page.keyboard.up('Space');
  assert.equal(await count(), 0);
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await waitCount(1);
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.calls[0].context.source), 'keyboard');
  await page.evaluate(() => window.pullgroundFixture.setDisabled(true));
  await frames();
  assert.equal(await page.evaluate(() => window.pullgroundFixture.join()), true);
  await page.evaluate(() => {
    const fixture = window.pullgroundFixture;
    const retained = fixture.retained();
    fixture.trigger().then(value => { fixture.outcome = value; });
    fixture.savedHandle = retained;
    fixture.setMounted(false);
  });
  await page.waitForFunction('window.pullgroundFixture.outcome?.status === "aborted"');
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.calls[0].context.signal.aborted), true);
  assert.deepEqual(await page.evaluate(() => window.pullgroundFixture.savedHandle.trigger()), { status: 'skipped', reason: 'unmounted' });
  await page.evaluate(() => window.pullgroundFixture.reject(0));
  await page.evaluate(() => { window.pullgroundFixture.setDisabled(false); window.pullgroundFixture.setMounted(true); window.pullgroundFixture.setVersion(2); });
  await page.waitForSelector(viewport);
  await checkStyles();
  await pull(122.4);
  await waitCount(2);
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.calls[1].version), 2);
  const beforeRenders = await page.evaluate(() => window.pullgroundFixture.record.renders);
  await page.waitForFunction(selector => document.querySelector(selector).dataset.art === 'false', {}, first);
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.renders), beforeRenders, 'Animation does not re-render consumer');
  await trigger(1);
  await waitCount(3);
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.calls[2].instance), 1);
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.calls[2].context.source), 'imperative');
  assert.equal(await page.$eval('section[aria-label="Second feed"]', el => el.dataset.art), 'false', 'Imperative trigger skips the shot');
  await resolve(1);
  assert.equal(await page.$eval('section[aria-label="Second feed"]', el => el.dataset.state), 'pending');
  await resolve(2);
  await idle();

  await load();
  await pull(122.4);
  await waitCount(1);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.waitForFunction(selector => document.querySelector(selector).dataset.reduced === 'true', {}, first);
  assert.equal(await page.$eval(first, el => el.dataset.art), 'false');
  assert.equal(await page.$eval(`${first} .pullground-status-icon`, el => getComputedStyle(el).animationName), 'none');
  await resolve(0);
  assert.equal(await page.$eval(`${first} .pullground-reveal`, el => el.getBoundingClientRect().height), 0, 'Reduced motion closes immediately on success');
  await idle();
  await page.focus(viewport);
  await page.keyboard.down('Space');
  await page.waitForSelector(`${first}[data-pulling="true"]`);
  assert.equal(await page.$eval(`${first} .pullground-status`, el => el.textContent), '', 'Reduced motion also uses wordless pull guidance');
  assert.equal(await page.$eval(first, el => el.dataset.art), 'false', 'Reduced motion uses the static release icon');
  assert.equal(await page.$eval(`${first} .pullground-release-cue`, el => el.getAnimations().length), 0, 'Reduced motion disables the release ring');
  await page.keyboard.press('Escape');
  await page.keyboard.up('Space');
  assert.equal(await count(), 1, 'Canceling static pull guidance does not trigger');
  await idle();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

  // Cancellation before release must never submit, regardless of how a drag ends.
  await load();
  for (const reason of ['escape', 'cancel', 'capture', 'disable', 'resize']) {
    const box = await page.$eval(viewport, el => { const r = el.getBoundingClientRect(); return { x: r.x + 20, y: r.y + 24 }; });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x, box.y + 80, { steps: 5 });
    if (reason === 'escape') await page.keyboard.press('Escape');
    if (reason === 'cancel') await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.fixturePointer })));
    if (reason === 'capture') {
      await page.$eval(viewport, el => el.releasePointerCapture(window.fixturePointer));
      await page.mouse.move(box.x, box.y + 81);
    }
    if (reason === 'disable') { await page.evaluate(() => window.pullgroundFixture.setDisabled(true)); await frames(); }
    if (reason === 'resize') { await page.setViewport({ width: 320, height: 850 }); await frames(); }
    await page.mouse.up();
    await frames();
    assert.equal(await count(), 0, `Canceled ${reason} pull`);
    await idle();
    await page.evaluate(() => window.pullgroundFixture.setDisabled(false));
    await frames();
  }
  await page.focus(viewport);
  await page.keyboard.down('Space');
  await page.focus('.fixture-outside');
  await page.keyboard.up('Space');
  assert.equal(await count(), 0, 'Blur cancels keyboard charge');
  await idle();
  const idleFrames = await page.evaluate(() => window.fixtureFrames.count);
  await frames();
  assert.equal(await page.evaluate(() => window.fixtureFrames.count), idleFrames, 'No idle animation scheduler');
  await page.evaluate(() => { window.pullgroundFixture.record.mode = 'immediate'; });
  await pull(122.4);
  await waitCount(1);
  await completed();
  await idle();
  await page.evaluate(() => { window.pullgroundFixture.record.mode = 'deferred'; });
  await pull(122.4);
  await waitCount(2);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.pullgroundFixture.resolve(1);
  });
  await completed();
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await idle();

  // Palettes are instance-local and can change without resetting a shot or its request.
  await load();
  const themeArtwork = {
    classic: { body: [194, 162, 124], face: [235, 219, 211], outline: [157, 140, 115] },
    simple: { body: [115, 115, 115], face: [255, 255, 255], outline: [77, 77, 77] },
    ocean: { body: [99, 162, 139], face: [218, 238, 229], outline: [63, 130, 108] },
    midnight: { body: [67, 110, 164], face: [41, 68, 95], outline: [128, 157, 202] },
  };
  const expectPaint = async (selector, property, expected, message = 'Artwork uses the selected tonal palette') => {
    const actual = await page.$eval(selector, (el, property) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      context.fillStyle = getComputedStyle(el)[property];
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    }, property);
    assert.ok(actual.every((value, i) => Math.abs(value - expected[i]) <= 1), `${message}: ${actual} ≈ ${expected}`);
  };
  await page.evaluate(() => { window.themeChild = document.querySelector('.fixture-child'); });
  for (const [theme, paint] of Object.entries(themeArtwork)) {
    await page.evaluate(theme => window.pullgroundFixture.setTheme(theme), theme);
    await page.waitForSelector(`${first}[data-theme="${theme}"]`);
    await expectPaint(`${first} .pullground-ball`, 'fill', paint.body);
    await expectPaint(`${first} .pullground-dart-flight`, 'fill', paint.body, 'Both games use the selected palette');
    await expectPaint(`${first} .pullground-backboard`, 'fill', paint.face, 'The backboard has its own themed material');
    await expectPaint(`${first} .pullground-dart-target`, 'fill', paint.face, 'The target has its own themed material');
    await expectPaint(`${first} .pullground-bowling-body`, 'fill', paint.body);
    await expectPaint(`${first} .pullground-bowling-pin-body`, 'fill', paint.face);
    await expectPaint(`${first} .pullground-bowling-pin-body`, 'stroke', paint.outline);
    await expectPaint(`${first} .pullground-stone-body`, 'fill', paint.body);
    await expectPaint(`${first} .pullground-stone-facet`, 'stroke', paint.face);
    await expectPaint(`${first} .pullground-stone-ripples`, 'stroke', paint.outline);
    await expectPaint(`${first} .pullground-net`, 'stroke', paint.outline);
    await expectPaint('section[aria-label="Second feed"] .pullground-ball', 'fill', themeArtwork.ocean.body, 'Another instance keeps its artwork palette with a custom host surface');
    await checkStyles();
    for (const game of ['basketball', 'dart', 'bowling', 'stone']) {
      await page.evaluate(game => window.pullgroundFixture.setGame(game), game);
      await frames();
      const index = await count();
      await pull(122.4);
      await waitCount(index + 1);
      await page.evaluate(theme => window.pullgroundFixture.setTheme(theme === 'simple' ? 'midnight' : 'simple'), theme);
      await frames();
      assert.equal(await page.$eval(first, el => el.dataset.art), 'true', 'Changing theme keeps the shot running');
      assert.equal(await page.evaluate(index => window.pullgroundFixture.record.calls[index].context.signal.aborted, index), false);
      assert.equal(await page.evaluate(() => window.pullgroundFixture.join()), true, 'Theme changes retain the accepted Promise');
      assert.equal(await page.evaluate(() => window.themeChild === document.querySelector('.fixture-child')), true);
      await page.evaluate(theme => window.pullgroundFixture.setTheme(theme), theme);
      await resolve(index);
      await idle();
    }
  }

  // Switching games preserves the consumer tree and accepted work, while canceling unsubmitted input.
  await page.setViewport({ width: 1440, height: 900 });
  await load();
  await page.evaluate(() => {
    window.originalPullgroundChild = document.querySelector('.fixture-child');
    window.pullgroundFixture.setGame('dart');
  });
  await page.waitForSelector(`${first}[data-game="dart"]`);
  assert.equal(await page.$eval(`${first} .pullground-basketball-scene`, el => getComputedStyle(el).display), 'none');
  await pull(122.4);
  await waitCount(1);
  await page.waitForFunction(selector => Number(document.querySelector(`${selector} .pullground-dart-scene .pullground-pulse`).getAttribute('opacity')) > 0, {}, first);
  assert.equal(await page.$eval(`${first} .pullground-dart`, el => Math.abs(el.transform.baseVal.consolidate().matrix.f - 34) < 1), true, 'A medium pull embeds the dart in the bullseye');
  await page.evaluate(() => window.pullgroundFixture.setGame('basketball'));
  await frames();
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.calls[0].context.signal.aborted), false, 'Switching games does not abort accepted work');
  assert.equal(await count(), 1, 'Switching does not start another request');
  assert.equal(await page.$eval(first, el => el.dataset.art), 'false', 'Switching clears the previous decoration immediately');
  assert.equal(await page.$eval(`${first} .pullground-content`, el => el.getAttribute('aria-busy')), 'true');
  assert.equal(await page.evaluate(() => window.originalPullgroundChild === document.querySelector('.fixture-child')), true, 'Switching never remounts consumer content');
  await resolve(0);
  await idle();
  await page.evaluate(() => window.pullgroundFixture.setGame('dart'));
  await frames();
  await page.focus(viewport);
  await page.keyboard.down('Space');
  await page.waitForSelector(`${first}[data-pulling="true"]`);
  await page.evaluate(() => window.pullgroundFixture.setGame('basketball'));
  await frames();
  await page.keyboard.up('Space');
  assert.equal(await count(), 1, 'A mode change cancels unfinished charging without running an action');
  await idle();
  await page.evaluate(() => window.pullgroundFixture.setGame('dart'));
  await frames();
  await pull(210);
  await waitCount(2);
  await page.waitForFunction(selector => Number(document.querySelector(`${selector} .pullground-dart-scene .pullground-pulse`).getAttribute('opacity')) > 0, {}, first);
  await page.evaluate(() => window.pullgroundFixture.reject(1));
  await page.waitForSelector(`${first}[data-state="error"][data-art="false"]`);
  assert.equal(await page.$eval(`${first} .pullground-dart-scene .pullground-pulse`, el => el.getAttribute('opacity')), '0', 'Failure clears dart impact immediately');
  await page.evaluate(() => window.pullgroundFixture.setMotion('reduced'));
  await frames();
  await pull(122.4);
  await waitCount(3);
  assert.equal(await page.$eval(first, el => el.dataset.art), 'false', 'Dart honors reduced motion');
  await resolve(2);
  await idle();

  // Bowling uses real pin contact, with the same host-action lifecycle as the other games.
  await load();
  await page.evaluate(() => { window.pullgroundFixture.setGame('bowling'); window.bowlingChild = document.querySelector('.fixture-child'); });
  await page.waitForSelector(`${first}[data-game="bowling"]`);
  assert.equal(await page.$eval(`${first} .pullground-bowling-scene`, el => getComputedStyle(el).display !== 'none'), true);
  assert.equal(await page.$eval(`${first} .pullground-dart-scene`, el => getComputedStyle(el).display), 'none');
  assert.equal(await uprightPins(), true);
  await pull(122.4);
  await waitCount(1);
  await bowlingStrike();
  assert.equal(await page.$eval(`${first} .pullground-bowling-ball`, el => el.transform.baseVal.consolidate().matrix.f < 52), true, 'The ball rolls into the rack before pins fall');
  await page.waitForFunction(selector => {
    const root = document.querySelector(selector);
    return root.dataset.art === 'true' && Number(root.querySelector('.pullground-bowling-ball').getAttribute('opacity')) === 0;
  }, {}, first);
  assert.equal(await page.$eval(`${first} .pullground-content`, el => el.getAttribute('aria-busy')), 'true', 'The ball exits while the pins and host action can keep running');
  await page.screenshot({ path: join(screenshots, 'bowling-strike.png') });
  await page.evaluate(() => window.pullgroundFixture.setGame('dart'));
  await frames();
  assert.equal(await uprightPins(), true, 'Switching games restores all pins');
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.calls[0].context.signal.aborted), false);
  assert.equal(await page.evaluate(() => window.bowlingChild === document.querySelector('.fixture-child')), true);
  assert.equal(await page.$eval(`${first} .pullground-content`, el => el.getAttribute('aria-busy')), 'true');
  await resolve(0);
  await idle();
  await page.evaluate(() => window.pullgroundFixture.setGame('bowling'));
  await frames();
  await pull(122.4, false, 27);
  await waitCount(2);
  await page.waitForFunction(selector => {
    const fallen = [...document.querySelectorAll(`${selector} .pullground-bowling-pin`)].filter(pin => Math.abs(pin.transform.baseVal.consolidate().matrix.b) > 0.2).length;
    return fallen > 0 && fallen < 10;
  }, {}, first);
  await page.evaluate(() => window.pullgroundFixture.reject(1));
  await page.waitForSelector(`${first}[data-state="error"][data-art="false"]`);
  assert.equal(await uprightPins(), true, 'Failure resets a partly toppled rack immediately');
  await pull(210, false, 90);
  await waitCount(3);
  await page.waitForFunction(selector => document.querySelector(`${selector} .pullground-bowling-ball`).transform.baseVal.consolidate().matrix.e < 0, {}, first);
  assert.equal(await page.$eval(`${first} .pullground-court`, el => getComputedStyle(el).overflow), 'visible', 'A wide roll is not clipped at an invisible SVG side edge');
  assert.equal(await uprightPins(), true, 'A wide roll passes freely beside the rack and leaves the pins standing');
  await resolve(2);
  await idle();
  await page.focus(viewport);
  await page.keyboard.down('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(selector => document.querySelector(`${selector} .pullground-bowling-ball`).transform.baseVal.consolidate().matrix.f > 104, {}, first);
  assert.ok(Math.abs(await page.$eval(`${first} .pullground-bowling-ball`, el => el.transform.baseVal.consolidate().matrix.e) - 83.6) < 0.01);
  await page.keyboard.up('Space');
  await waitCount(4);
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.calls[3].context.source), 'keyboard');
  await page.waitForFunction(selector => document.querySelector(`${selector} .pullground-bowling-ball`).transform.baseVal.consolidate().matrix.e < 70, {}, first);
  await page.evaluate(() => window.pullgroundFixture.setMotion('reduced'));
  await frames();
  assert.equal(await uprightPins(), true);
  assert.equal(await page.$eval(first, el => el.dataset.art), 'false', 'Reduced motion clears an active bowling roll');
  await resolve(3);
  await idle();
  await pull(122.4);
  await waitCount(5);
  assert.equal(await page.$eval(first, el => el.dataset.art), 'false', 'Reduced motion keeps bowling operable without animation');
  await resolve(4);
  await idle();
  await page.evaluate(() => {
    // Consumer text remains selectable. Start the next pull without a native text drag.
    getSelection()?.removeAllRanges();
    window.pullgroundFixture.setMotion('system');
  });
  await frames();
  await pull(122.4);
  await waitCount(6);
  await bowlingStrike();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await uprightPins(), true, 'Hiding the page restores the rack');
  await resolve(5);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await idle();
  await page.evaluate(() => { window.pullgroundFixture.record.mode = 'sync'; });
  await pull(4);
  await waitCount(7);
  await completed();
  await idle();
  assert.equal(await page.$eval('.fixture-child', el => el.textContent), 'Child 1', 'Bowling supports synchronous local actions');

  // Pin 4 is on the left of the rack, but its impact can send it either way.
  await load();
  await page.evaluate(() => window.pullgroundFixture.setGame('bowling'));
  await frames();
  for (const [direction, side] of [[0.12, -1], [0.32, 1]]) {
    const index = await count();
    await pull(122.4, false, direction * 90);
    await waitCount(index + 1);
    await page.waitForFunction((selector, side) => {
      const pin = document.querySelectorAll(`${selector} .pullground-bowling-pin`)[4];
      return pin.transform.baseVal.consolidate().matrix.b * side > 0.5;
    }, {}, first, side);
    await resolve(index);
    await idle();
  }

  // Stone skips leave contact ripples and sink while the consumer action remains independent.
  await load();
  await page.evaluate(() => { window.pullgroundFixture.setGame('stone'); window.stoneChild = document.querySelector('.fixture-child'); });
  await page.waitForSelector(`${first}[data-game="stone"]`);
  assert.equal(await page.$eval(`${first} .pullground-stone-scene`, el => getComputedStyle(el).display !== 'none'), true);
  assert.equal(await page.$eval(`${first} .pullground-bowling-scene`, el => getComputedStyle(el).display), 'none');
  const ripplesVisible = (selector = first) => page.waitForFunction(selector =>
    [...document.querySelector(`${selector} .pullground-stone-ripples`).children].filter(ripple => Number(ripple.getAttribute('opacity')) > 0.02).length >= 4, {}, selector);
  const noRipples = () => page.$eval(`${first} .pullground-stone-ripples`, el =>
    [...el.children].every(ripple => Number(ripple.getAttribute('opacity')) === 0));
  await pull(210, false, 45);
  await waitCount(1);
  await ripplesVisible();
  assert.equal(await page.$eval(`${first} .pullground-stone`, el => el.transform.baseVal.consolidate().matrix.e < 80), true, 'Pulling right skips the stone to the left');
  await page.screenshot({ path: join(screenshots, 'stone-skipping.png') });
  await page.waitForFunction(selector => {
    const root = document.querySelector(selector);
    return root.dataset.art === 'true' && Number(root.querySelector('.pullground-stone').getAttribute('opacity')) === 0;
  }, {}, first);
  assert.equal(await page.$eval(`${first} .pullground-content`, el => el.getAttribute('aria-busy')), 'true', 'The stone sinks without completing the host action');
  await page.waitForSelector(`${first}[data-art="false"][data-state="pending"]`);
  assert.equal(await noRipples(), true, 'The shot ends with no leftover ripples');
  await resolve(0);
  await idle();
  await pull(122.4, false, -45);
  await waitCount(2);
  await ripplesVisible();
  assert.equal(await page.$eval(`${first} .pullground-stone`, el => el.transform.baseVal.consolidate().matrix.e > 80), true, 'Pulling left skips the stone to the right');
  await page.evaluate(() => window.pullgroundFixture.setGame('dart'));
  await frames();
  assert.equal(await noRipples(), true, 'Changing games clears the contact ripples');
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.calls[1].context.signal.aborted), false);
  assert.equal(await page.evaluate(() => window.pullgroundFixture.join()), true);
  assert.equal(await page.evaluate(() => window.stoneChild === document.querySelector('.fixture-child')), true);
  await resolve(1);
  await idle();
  await page.evaluate(() => window.pullgroundFixture.setGame('stone'));
  await frames();
  await pull(122.4);
  await waitCount(3);
  await ripplesVisible();
  await page.evaluate(() => window.pullgroundFixture.reject(2));
  await page.waitForSelector(`${first}[data-state="error"][data-art="false"]`);
  assert.equal(await noRipples(), true, 'Failure clears the stone and ripples immediately');
  await page.focus(viewport);
  await page.keyboard.down('Space');
  for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowRight');
  await page.waitForFunction(selector => document.querySelector(`${selector} .pullground-stone`).transform.baseVal.consolidate().matrix.f > 105, {}, first);
  assert.ok(Math.abs(await page.$eval(`${first} .pullground-stone`, el => el.transform.baseVal.consolidate().matrix.e) - 86) < 0.01);
  await page.keyboard.up('Space');
  await waitCount(4);
  assert.equal(await page.evaluate(() => window.pullgroundFixture.record.calls[3].context.source), 'keyboard');
  await ripplesVisible();
  await page.evaluate(() => window.pullgroundFixture.setMotion('reduced'));
  await frames();
  assert.equal(await noRipples(), true);
  assert.equal(await page.$eval(first, el => el.dataset.art), 'false', 'Reduced motion clears an active stone throw');
  await resolve(3);
  await idle();
  await pull(122.4);
  await waitCount(5);
  assert.equal(await page.$eval(first, el => el.dataset.art), 'false', 'Reduced motion keeps Stone skipping operable without animation');
  await resolve(4);
  await idle();
  await page.evaluate(() => { getSelection()?.removeAllRanges(); window.pullgroundFixture.setMotion('system'); });
  await frames();
  await pull(122.4);
  await waitCount(6);
  await ripplesVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await noRipples(), true, 'Hiding the document clears the water effects');
  await resolve(5);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await idle();
  await page.evaluate(() => { window.pullgroundFixture.record.mode = 'sync'; });
  await pull(4);
  await waitCount(7);
  await completed();
  await idle();
  assert.equal(await page.$eval('.fixture-child', el => el.textContent), 'Child 1', 'Stone skipping supports synchronous local actions');

  // Slingshot aim launches opposite the pull and resets between gestures in both flying games.
  await load();
  for (const game of ['basketball', 'dart']) {
    await page.evaluate(game => window.pullgroundFixture.setGame(game), game);
    await frames();
    const projectile = `${first} ${game === 'dart' ? '.pullground-dart' : '.pullground-ball'}`;
    const xOf = el => (el.classList.contains('pullground-ball') ? el.parentElement : el).transform.baseVal.consolidate().matrix.e;
    for (const direction of [-1, 1]) {
      const index = await count();
      await pull(122.4, false, direction * 72);
      await waitCount(index + 1);
      await page.waitForFunction((selector, side) => {
        const el = document.querySelector(selector);
        const pose = (el.classList.contains('pullground-ball') ? el.parentElement : el).transform.baseVal.consolidate().matrix;
        return (pose.e - 80) * side < -32;
      }, {}, projectile, direction);
      assert.equal(await page.$eval(`${first} .pullground-aim`, el => getComputedStyle(el).opacity), '0', 'The aiming guide disappears on release');
      assert.equal(await page.$eval(`${first} .pullground-dart-scene .pullground-pulse`, el => el.getAttribute('opacity')), '0', 'A wide dart does not report a hit');
      await resolve(index);
      await idle();
    }
    const index = await count();
    await page.focus(viewport);
    await page.keyboard.down('Space');
    for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowLeft');
    await frames();
    assert.ok(Math.abs(await page.$eval(projectile, xOf) - 74) < 0.01, 'Left Arrow moves the held pull left');
    for (let step = 0; step < 10; step++) await page.keyboard.press('ArrowRight');
    await frames();
    assert.ok(Math.abs(await page.$eval(projectile, xOf) - 86) < 0.01, 'Right Arrow moves the held pull right');
    await page.keyboard.up('Space');
    await waitCount(index + 1);
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return (el.classList.contains('pullground-ball') ? el.parentElement : el).transform.baseVal.consolidate().matrix.e < 64;
    }, {}, projectile);
    assert.equal(await page.evaluate(i => window.pullgroundFixture.record.calls[i].context.source, index), 'keyboard');
    await resolve(index);
    await idle();
    await pull(4);
    await waitCount(index + 2);
    assert.ok(Math.abs(await page.$eval(projectile, xOf) - 80) < 0.01, 'A new vertical pull starts centered');
    await resolve(index + 1);
    await idle();
  }
  await page.evaluate(() => window.pullgroundFixture.setGame('basketball'));
  await frames();
  const missedBoard = await count();
  await pull(210, false, 90);
  await waitCount(missedBoard + 1);
  await page.waitForFunction(selector => document.querySelector(`${selector} .pullground-ball`).parentElement.transform.baseVal.consolidate().matrix.e < 30, {}, first);
  await intactBoard();
  await resolve(missedBoard);
  await idle();

  // Actual Chromium touch input; the small pull must not be lost to scroll handling.
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await load();
  const cdp = await page.createCDPSession();
  async function touch(dx, dy) {
    const box = await page.$eval(viewport, el => { const r = el.getBoundingClientRect(); return { x: r.x + 24, y: r.y + 36 }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [box] });
    for (let step = 1; step <= 8; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + dx * step / 8, y: box.y + dy * step / 8 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await touch(0, 4);
  await waitCount(1);
  // Let the reveal settle so the tap targets the button, not its moving old position.
  await settledReveal();
  await page.tap('.fixture-child');
  await page.waitForFunction(() => document.querySelector('.fixture-child').textContent === 'Child 1');
  assert.equal(await page.$eval('.fixture-child', el => el.textContent), 'Child 1', 'A new touch is not a suppressed drag click');
  await resolve(0);
  await idle();

  await load();
  await page.evaluate(selector => {
    const element = document.querySelector(selector);
    const { x, y } = element.getBoundingClientRect();
    const touch = (id, dy) => new Touch({ identifier: id, target: element, clientX: x + 20, clientY: y + 20 + dy });
    element.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(1, 0)], changedTouches: [touch(1, 0)], bubbles: true }));
    element.dispatchEvent(new TouchEvent('touchmove', { touches: [touch(1, 80)], changedTouches: [touch(1, 80)], bubbles: true, cancelable: true }));
    element.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(1, 80), touch(2, 80)], changedTouches: [touch(2, 80)], bubbles: true }));
    element.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touch(1, 80), touch(2, 80)], bubbles: true }));
  }, viewport);
  await idle();
  assert.equal(await count(), 0, 'Multitouch cancels the candidate');
  await touch(40, 2);
  assert.equal(await count(), 0, 'Horizontal intent stays native');
  await touch(0, -70);
  await page.waitForFunction(selector => document.querySelector(selector).scrollTop > 0, {}, viewport);
  await touch(0, 90);
  assert.equal(await count(), 0, 'Scrolling back to top does not trigger');
  await load();
  await page.evaluate(selector => {
    const element = document.querySelector(selector);
    const { x, y } = element.getBoundingClientRect();
    const touch = dy => new Touch({ identifier: 9, target: element, clientX: x + 20, clientY: y + 20 + dy });
    element.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(0)], changedTouches: [touch(0)], bubbles: true }));
    element.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touch(4)], bubbles: true }));
  }, viewport);
  await waitCount(1);
  await resolve(0);
  await idle();

  // Resizing accepted work rescales the scene without restarting the request.
  await page.setViewport({ width: 1440, height: 900 });
  await load();
  await pull(122.4);
  await waitCount(1);
  await settledReveal();
  const beforeResize = await sceneGeometry();
  await page.$eval(viewport, el => { el.style.blockSize = '240px'; });
  await frames();
  await settledReveal();
  const afterResize = await sceneGeometry();
  assert.ok(Math.abs(beforeResize.reveal - afterResize.reveal) < 0.001
    && Math.abs(beforeResize.art - afterResize.art) < 0.00001, 'Resizing an accepted shot preserves its proportions');
  assert.equal(await count(), 1, 'Resizing does not restart an accepted action');
  await resolve(0);
  await idle();

  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewport({ width, height });
    await load();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: join(screenshots, `consumer-${width}.png`), fullPage: true });
    await checkConsumerProportions();
  }
  await page.evaluate(() => { document.querySelector('.consumer-fixture').style.maxWidth = '280px'; window.pullgroundFixture.setLongLabels(true); });
  await frames();
  await checkConsumerProportions();
  await trigger();
  await waitCount(1);
  await page.evaluate(() => window.pullgroundFixture.reject(0));
  await page.waitForFunction(selector => document.querySelector(selector).dataset.state === 'error', {}, first);
  await page.waitForFunction(selector => {
    const root = document.querySelector(selector);
    const status = root.querySelector('.pullground-status').getBoundingClientRect();
    const reveal = root.querySelector('.pullground-reveal').getBoundingClientRect();
    return status.height > 44 && reveal.height >= status.height - 1;
  }, {}, first);
  await trigger();
  await waitCount(2);
  await resolve(1);

  await page.setViewport({ width: 800, height: 900 });
  await load();
  await page.evaluate(() => { document.body.style.zoom = '2'; window.pullgroundFixture.setLongLabels(true); });
  await frames();
  await checkConsumerProportions();
  await trigger();
  await waitCount(1);
  await page.evaluate(() => window.pullgroundFixture.reject(0));
  await page.waitForFunction(selector => document.querySelector(selector).dataset.state === 'error', {}, first);
  await page.waitForFunction(selector => {
    const root = document.querySelector(selector);
    return Math.abs(root.querySelector('.pullground-status').getBoundingClientRect().height
      - root.querySelector('.pullground-reveal').getBoundingClientRect().height) < 1;
  }, {}, first);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, '200% zoom has no horizontal overflow');
  await trigger();
  await waitCount(2);
  await resolve(1);

  if (!process.env.PULLGROUND_SKIP_SITE) {
    const expectedExample = (await readFile(join(root, 'src/pullground/react-example.tsx'), 'utf8')).trim();
    const expectedDartExample = (await readFile(join(root, 'src/pullground/react-dart-example.tsx'), 'utf8')).trim();
    const expectedBowlingExample = (await readFile(join(root, 'src/pullground/react-bowling-example.tsx'), 'utf8')).trim();
    const expectedStoneExample = (await readFile(join(root, 'src/pullground/react-stone-example.tsx'), 'utf8')).trim();
    const expectedExamples = { basketball: expectedExample, dart: expectedDartExample, bowling: expectedBowlingExample, stone: expectedStoneExample };
    siteServer = await preview({ configFile: false, root, build: { outDir: process.env.PULLGROUND_SITE_DIST ?? join(root, 'dist') }, preview: { host: '127.0.0.1', port: 0, open: false } });
    const siteUrl = `http://127.0.0.1:${siteServer.httpServer.address().port}`;
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url() === 'https://api.github.com/repos/johnson7543/design') {
        void request.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ stargazers_count: 27 }) });
      } else if (request.url().startsWith('https://fonts.googleapis.com/')) {
        void request.respond({ status: 200, contentType: 'text/css', body: '' });
      } else void request.continue();
    });
    for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
      await page.setViewport({ width, height, deviceScaleFactor: width === 390 ? 2 : 1, isMobile: width === 390, hasTouch: width === 390 });
      await page.goto(`${siteUrl}/pullground`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.pullground-demo-viewport');
      await page.waitForSelector('.github-star-link[data-github-star-count="27"]');
      assert.equal(await page.title(), 'Pullground — Design');
      assert.equal(await page.$eval('.pullground-demo-header h1', el => el.textContent), 'Pullground');
      assert.equal(await page.$eval('.pullground-demo-header h1', el => el.closest('a,button')), null, 'The product title matches DesignQR’s non-navigating header');
      assert.deepEqual(await page.$eval('.github-star-link', el => ({
        href: el.href, target: el.target, rel: el.rel, hasMark: Boolean(el.querySelector('.github-star-mark')),
        count: el.querySelector('.github-star-count').textContent.trim(), label: el.getAttribute('aria-label'),
      })), {
        href: 'https://github.com/johnson7543/design', target: '_blank', rel: 'noreferrer', hasMark: true,
        count: '27', label: 'Star Pullground on GitHub; 27 stars (opens in a new tab)',
      });
      const headerWidth = Math.min(760, width - (width <= 620 ? 36 : 64));
      assert.deepEqual(await page.$eval('.pullground-demo-header', el => {
        const rect = el.getBoundingClientRect();
        return { x: rect.x, width: rect.width, height: rect.height };
      }), { x: (width - headerWidth) / 2, width: headerWidth, height: width <= 620 ? 72 : 82 }, 'The header uses DesignQR’s responsive rail');
      assert.equal(await page.$eval('.pullground-demo-header', el => {
        const title = el.querySelector('.site-header-brand').getBoundingClientRect();
        const hint = el.querySelector('.pullground-demo-hint').getBoundingClientRect();
        const github = el.querySelector('.github-star-link').getBoundingClientRect();
        const center = rect => rect.top + rect.height / 2;
        return Math.abs(center(title) - center(hint)) < 1
          && Math.abs(center(title) - center(github)) < 1
          && Math.abs(hint.left + hint.width / 2 - innerWidth / 2) < 1
          && title.right < hint.left && hint.right < github.left;
      }), true, 'The pull hint is centered between the title and GitHub on one row');
      assert.equal(await page.$eval('.pullground-demo-page', el => el.scrollWidth > el.clientWidth), false);
      assert.deepEqual(await page.$eval('.pullground-demo-viewport', el => {
        const rect = el.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }), { x: 0, y: 0, width, height }, 'The pull surface fills the entire page');
      assert.equal(await page.$('.pullground-root button'), null, 'The component adds no buttons to the demo');
      assert.equal(await page.$('.pullground-demo-example'), null, 'The React example is kept in the export dialog');
      assert.equal(await page.$('.pullground-demo-header .pullground-demo-export'), null, 'Export is outside the header');
      assert.equal(await page.$eval('.pullground-demo-controls', el => {
        const rect = el.getBoundingClientRect();
        const card = el.querySelector('.customizer-card').getBoundingClientRect();
        const button = el.querySelector('.pullground-demo-export').getBoundingClientRect();
        return !el.closest('.pullground-root')
          && Math.abs(rect.left + rect.width / 2 - innerWidth / 2) < 1
          && rect.width === Math.min(innerWidth, innerWidth <= 640 ? innerWidth : 580)
          && Math.abs(innerHeight - card.bottom - (innerWidth <= 640 ? 8 : 24)) < 1
          && card.left >= 8 && card.right <= innerWidth - 8
          && button.left > card.left + card.width / 2 && button.right < card.right;
      }), true, 'Export uses the anchored DesignQR bottom rail');
      assert.deepEqual(await page.$$eval('.pullground-demo-game', buttons => buttons.map(el => [el.textContent, el.getAttribute('aria-pressed')])), [['Basketball', 'true'], ['Dart', 'false'], ['Bowling', 'false'], ['Stone skipping', 'false']]);
      assert.equal(await page.$eval('.pullground-demo-games', el => {
        const rect = el.getBoundingClientRect();
        const card = el.closest('.customizer-card').getBoundingClientRect();
        const action = document.querySelector('.pullground-demo-export').getBoundingClientRect();
        const themes = document.querySelector('.pullground-demo-themes').getBoundingClientRect();
        return rect.left > card.left && rect.right < action.left && rect.bottom < themes.top
          && [...el.children].every(button => {
            const icon = button.querySelector('svg');
            return button.getBoundingClientRect().height === action.height && button.scrollWidth <= button.clientWidth
              && icon?.getAttribute('aria-hidden') === 'true' && icon.getBoundingClientRect().width === 15;
          });
      }), true, 'Game icons and labels fit beside Export above the theme row');
      assert.deepEqual(await page.$$eval('.pullground-demo-theme', buttons => buttons.map(el => [el.textContent, el.getAttribute('aria-pressed')])), [
        ['Classic', 'true'], ['Simple', 'false'], ['Ocean', 'false'], ['Midnight', 'false'],
      ]);
      assert.equal(await page.$eval('.pullground-demo-themes', el => {
        const row = el.getBoundingClientRect();
        const card = el.closest('.customizer-card').getBoundingClientRect();
        const action = document.querySelector('.pullground-demo-export').getBoundingClientRect();
        return el.getAttribute('aria-label') === 'Theme' && row.top > action.bottom
          && row.left > card.left && row.right < card.right && el.scrollWidth <= el.clientWidth
          && [...el.children].every(button => {
            const rect = button.getBoundingClientRect();
            return rect.height === action.height && rect.top === row.top
              && rect.left >= row.left && rect.right <= row.right + 1 && button.scrollWidth <= button.clientWidth;
          });
      }), true, 'All four theme chips fit a shared DesignQR preset row below the game controls');
      const barPoint = await page.$eval('.pullground-demo-controls .customizer-card', el => {
        const rect = el.getBoundingClientRect();
        return { x: rect.left + 3, y: rect.top + rect.height / 2 };
      });
      await page.mouse.move(barPoint.x, barPoint.y);
      await page.mouse.down();
      await page.mouse.move(barPoint.x, barPoint.y + 25, { steps: 4 });
      await page.mouse.up();
      assert.equal(await page.$eval('.pullground-root', el => el.dataset.state), 'idle', 'Dragging the control bar does not trigger');
      assert.equal(await page.evaluate(() => String(getSelection())), '', 'Dragging the bar cannot select underlying header text and steal the next pull');
      assert.equal(await page.$eval('.pullground-viewport', el => /refresh|button/i.test(document.getElementById(el.getAttribute('aria-describedby')).textContent)), false, 'Instructions describe a general pull action without an absent button');
      const layout = () => page.evaluate(() => ({
        header: document.querySelector('.pullground-demo-header').getBoundingClientRect().top,
        action: document.querySelector('.pullground-demo-export').getBoundingClientRect().top,
        reveal: document.querySelector('.pullground-reveal').getBoundingClientRect().height,
      }));
      const beforePull = await layout();
      const pullDistance = Math.min(width, height) * 0.32;
      await page.screenshot({ path: join(screenshots, `demo-${width}.png`), fullPage: true });
      // Touch users can pull from the header hint; mouse pulls also work in the page gutter.
      const box = width === 390 ? await page.$eval('.pullground-demo-hint', el => {
        const rect = el.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }) : { x: 8, y: 96 };
      const holdPagePull = async (distance, offsetX = 0, origin = box) => {
        if (width === 390) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [origin] });
          for (let step = 1; step <= 12; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: origin.x + offsetX * step / 12, y: origin.y + distance * step / 12 }] });
        } else {
          await page.mouse.move(origin.x, origin.y);
          await page.mouse.down();
          await page.mouse.move(origin.x + offsetX, origin.y + distance, { steps: 12 });
        }
      };
      const releasePagePull = async () => {
        if (width === 390) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        else await page.mouse.up();
      };
      await holdPagePull(pullDistance);
      await page.waitForSelector('.pullground-root[data-art="true"]');
      assert.equal(await page.$eval('.pullground-status', el => el.textContent), '', 'Pull guidance has no visible wording');
      assert.equal(await page.$eval('.pullground-status', el => getComputedStyle(el).display), 'none', 'The basketball scene is the only pull indicator');
      assert.equal(await page.$eval('.pullground-sr-only[role="status"]', el => el.textContent), 'Release to continue', 'Release guidance remains available to screen readers');
      const duringPull = await layout();
      await checkPullProportions('.pullground-root');
      assert.ok(duringPull.reveal > 0, 'Pulling the page reveals the basketball at its top');
      assert.ok(Math.abs(duringPull.header - beforePull.header - duringPull.reveal) < 1, 'The header moves with the reveal');
      assert.ok(Math.abs(duringPull.action - beforePull.action) < 1, 'The bottom Export action stays anchored during the pull');
      // A full-page capture can reset mobile emulation and cancel the active touch.
      await page.screenshot({ path: join(screenshots, `demo-pull-${width}.png`) });
      assert.equal(await page.$eval('.pullground-root', el => el.dataset.art), 'true', 'The capture preserves the active pull');
      await releasePagePull();
      await page.waitForSelector('.pullground-content[aria-busy="true"]');
      await settledReveal('.pullground-root');
      const shot = await sceneGeometry('.pullground-root');
      assert.ok(Math.abs(shot.reveal - 0.375) < 0.001 && Math.abs(shot.art - 1 / 384) < 0.00001,
        'The accepted shot keeps the same reveal and artwork proportions at every size');
      await completed('.pullground-root');
      await idle('.pullground-root');
      await holdPagePull(Math.min(width, height) * 0.52);
      await releasePagePull();
      await impactVisible('.pullground-root');
      assert.ok(Math.abs((await layout()).action - beforePull.action) < 1, 'The impact stays in the basketball scene; the toolbar does not shake');
      await page.screenshot({ path: join(screenshots, `demo-smash-${width}.png`) });
      await completed('.pullground-root');
      await idle('.pullground-root');
      await holdPagePull(pullDistance, Math.min(width, height) * 0.12, { x: width / 2, y: 96 });
      const restingNet = await page.$eval('.pullground-net-under', el => el.getAttribute('d'));
      assert.equal(await page.$eval('.pullground-aim', el => Number(getComputedStyle(el).opacity) > 0 && el.getPointAtLength(el.getTotalLength()).x < el.getPointAtLength(0).x), true, 'Pulling right previews a leftward trajectory');
      assert.ok(Math.abs((await sceneGeometry('.pullground-root')).pose[4] - 86.144) < 0.15, 'Mouse and touch steering preserve the same relative aim');
      await page.screenshot({ path: join(screenshots, `demo-aim-basketball-${width}.png`) });
      await releasePagePull();
      await page.waitForFunction(() => document.querySelector('.pullground-ball').parentElement.transform.baseVal.consolidate().matrix.e < 56);
      assert.equal(await page.$eval('.pullground-net-under', el => el.getAttribute('d')), restingNet, 'An aimed miss does not deform the net');
      await completed('.pullground-root');
      await idle('.pullground-root');
      await page.focus('.pullground-viewport');
      await page.keyboard.down('Space');
      await page.keyboard.up('Space');
      await page.waitForSelector('.pullground-content[aria-busy="true"]');
      await completed('.pullground-root');
      await idle('.pullground-root');
      if (width === 390) await page.tap('.pullground-demo-export');
      else await page.click('.pullground-demo-export');
      await page.waitForFunction(() => document.querySelector('.pullground-export-backdrop')?.matches(':modal'));
      await page.$eval('.pullground-export-modal', async modal => {
        await Promise.all(modal.getAnimations().map(animation => animation.finished));
      });
      assert.equal(await page.$eval('.pullground-demo-export', el => el.getAttribute('aria-expanded')), 'true');
      assert.equal(await page.$eval('.modal-close-btn', el => el === document.activeElement), true, 'Opening focuses the dialog close control');
      await page.keyboard.down('Shift');
      await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      assert.equal(await page.$eval('.pullground-demo-code', el => el === document.activeElement), true, 'Focus wraps within the export dialog');
      await page.keyboard.press('Tab');
      assert.equal(await page.$eval('.modal-close-btn', el => el === document.activeElement), true);
      assert.equal(await page.$eval('.pullground-export-modal', el => {
        const rect = el.getBoundingClientRect();
        return rect.left >= 12 && rect.right <= innerWidth - 12 && rect.top >= 12
          && rect.bottom <= innerHeight - 12 && el.scrollWidth <= el.clientWidth;
      }), true, 'The export dialog fits the screen');
      await page.$eval('.pullground-viewport', el => el.focus());
      assert.equal(await page.$eval('.pullground-export-backdrop', el => el.contains(document.activeElement)), true, 'The background is inert while exporting');
      assert.equal(await page.$eval('.pullground-demo-code code', el => el.textContent), expectedExample);
      assert.equal(await page.$eval('.pullground-demo-code', el => Boolean(el.closest('.pullground-export-modal')) && !el.closest('.pullground-content')), true, 'The example lives outside the pull surface');
      assert.equal(await page.$eval('.pullground-demo-code', el => el.scrollWidth <= el.clientWidth + 1), true, 'Wrapped code is readable without horizontal scrolling');
      await page.focus('.pullground-demo-wrap');
      await page.keyboard.press('Space');
      assert.equal(await page.$eval('.pullground-demo-wrap', el => el.getAttribute('aria-pressed')), 'false');
      if (width <= 390) assert.equal(await page.$eval('.pullground-demo-code', el => el.scrollWidth > el.clientWidth), true, 'Original line lengths scroll within the panel');
      await page.keyboard.press('Space');
      assert.equal(await page.$eval('.pullground-demo-wrap', el => el.getAttribute('aria-pressed')), 'true');
      assert.equal(await page.$eval('.pullground-demo-code code', el => el.textContent), expectedExample, 'Syntax highlighting and wrapping preserve source text');
      assert.equal(await page.$eval('.pullground-reveal', el => el.getBoundingClientRect().height), 0, 'Changing code wrapping does not run an action');
      await page.evaluate(deferred => {
        window.copiedExample = '';
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: value => {
            window.copiedExample = value;
            return deferred ? new Promise(resolve => { window.finishExampleCopy = resolve; }) : Promise.resolve();
          } },
        });
      }, width === 1440);
      if (width === 390) await page.tap('.pullground-demo-copy');
      else await page.click('.pullground-demo-copy');
      if (width === 1440) {
        await page.waitForFunction(() => document.querySelector('.pullground-demo-copy').disabled);
        assert.equal(await page.$eval('.pullground-demo-copy', el => el.getAttribute('aria-label')), 'Copying React example');
        await page.evaluate(() => window.finishExampleCopy());
      }
      await page.waitForFunction(() => document.querySelector('.pullground-demo-copy').getAttribute('aria-label') === 'React example copied');
      assert.equal(await page.evaluate(() => window.copiedExample), expectedExample, 'Copy preserves the complete, type-checked example');
      assert.equal(await page.$eval('.pullground-reveal', el => el.getBoundingClientRect().height), 0, 'Using Copy does not run an action');
      assert.equal(await page.$eval('.pullground-demo-page', el => el.scrollWidth > el.clientWidth), false, 'The code stays inside the mobile page');
      await page.screenshot({ path: join(screenshots, `demo-code-${width}.png`) });
      if (width === 1440) {
        await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
        await page.click('.pullground-demo-copy');
        await page.waitForSelector('.pullground-demo-copy-error');
        assert.equal(await page.evaluate(() => window.getSelection().toString()), expectedExample, 'Clipboard failure selects the full example for manual copy');
        assert.equal(await page.$eval('.pullground-demo-copy', el => el.getAttribute('aria-label')), 'Copy React example', 'Clipboard failure does not claim success');
      }
      if (width === 390) {
        // A short screen scrolls code inside the dialog, keeping the page still.
        await page.setViewport({ width, height: 400, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        // Code gestures keep their native selection/scroll behavior inside the dialog.
        const codePoint = await page.$eval('.pullground-demo-code', el => {
          const rect = el.getBoundingClientRect();
          return { x: rect.x + 32, y: rect.y + 64 };
        });
        const swipe = async (point, dy) => {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
          for (let step = 1; step <= 12; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y + dy * step / 12 }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        };
        await swipe(codePoint, 80);
        assert.equal(await page.$eval('.pullground-reveal', el => el.getBoundingClientRect().height), 0, 'Dragging code does not run an action');
        await swipe(codePoint, -160);
        await page.waitForFunction(() => document.querySelector('.pullground-demo-code').scrollTop > 1);
        assert.equal(await page.$eval('.pullground-demo-viewport', el => el.scrollTop), 0, 'Scrolling code leaves the demo still');
        assert.equal(await page.$eval('.pullground-reveal', el => el.getBoundingClientRect().height), 0, 'Scrolling code does not trigger');
      }
      if (width === 1440) await page.keyboard.press('Escape');
      else if (width === 390) await page.tap('.modal-close-btn');
      else await page.mouse.click(2, 2);
      await page.waitForSelector('.pullground-export-backdrop', { hidden: true });
      assert.equal(await page.$('.pullground-demo-example'), null);
      assert.equal(await page.$eval('.pullground-demo-export', el => el === document.activeElement && el.getAttribute('aria-expanded') === 'false'), true, 'Closing restores focus to Export');
      assert.equal(await page.$eval('.pullground-reveal', el => el.getBoundingClientRect().height), 0, 'Export and dismissal never run an action');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.pullground-export-backdrop')?.matches(':modal'));
      assert.equal(await page.$eval('.pullground-demo-copy', el => el.getAttribute('aria-label')), 'Copy React example', 'Reopening clears old copy feedback');
      await page.keyboard.press('Escape');
      await page.waitForSelector('.pullground-export-backdrop', { hidden: true });
      // Dart uses the same proportions and wordless lifecycle on mouse and real touch input.
      if (width === 390) await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      if (width === 390) await page.tap('.pullground-demo-game[data-game="dart"]');
      else await page.click('.pullground-demo-game[data-game="dart"]');
      await page.waitForSelector('.pullground-root[data-game="dart"]');
      assert.deepEqual(await page.$$eval('.pullground-demo-game', buttons => buttons.map(el => el.getAttribute('aria-pressed'))), ['false', 'true', 'false', 'false']);
      assert.equal(await page.$eval('.pullground-root', el => el.dataset.state), 'success', 'Selecting a game does not run an action');
      await page.screenshot({ path: join(screenshots, `demo-dart-${width}.png`) });
      await holdPagePull(pullDistance);
      await page.waitForSelector('.pullground-root[data-pulling="true"]');
      assert.equal(await page.$eval('.pullground-basketball-scene', el => getComputedStyle(el).display), 'none');
      assert.equal(await page.$eval('.pullground-dart-scene', el => getComputedStyle(el).display !== 'none'), true);
      await page.screenshot({ path: join(screenshots, `demo-dart-pull-${width}.png`) });
      await releasePagePull();
      await settledReveal('.pullground-root');
      assert.equal(await page.$eval('.pullground-root', el => {
        const viewport = el.querySelector('.pullground-viewport').getBoundingClientRect();
        const basis = Math.min(viewport.width, viewport.height);
        const target = el.querySelector('.pullground-dart-target').getBoundingClientRect();
        const reveal = el.querySelector('.pullground-reveal').getBoundingClientRect();
        return Math.abs(target.width / basis - 46 / 384) < 0.001
          && Math.abs(target.width - target.height) < 0.1
          && Math.abs(target.left + target.width / 2 - viewport.width / 2) < 1
          && Math.abs(reveal.height / basis - 0.375) < 0.001;
      }), true, 'Dart target and reveal retain the same proportions on every screen');
      await page.waitForFunction(() => Number(document.querySelector('.pullground-dart-scene .pullground-pulse').getAttribute('opacity')) > 0);
      await page.screenshot({ path: join(screenshots, `demo-dart-hit-${width}.png`) });
      await completed('.pullground-root');
      await idle('.pullground-root');
      await holdPagePull(pullDistance, -Math.min(width, height) * 0.08, { x: width / 2, y: 96 });
      assert.ok(Math.abs(await page.$eval('.pullground-dart', el => el.transform.baseVal.consolidate().matrix.e) - 75.904) < 0.15, 'Dart steering scales with the host');
      assert.equal(await page.$eval('.pullground-aim', el => Number(getComputedStyle(el).opacity) > 0 && el.getPointAtLength(el.getTotalLength()).x > el.getPointAtLength(0).x), true, 'Pulling left previews a rightward dart trajectory');
      await page.screenshot({ path: join(screenshots, `demo-aim-dart-${width}.png`) });
      await releasePagePull();
      await page.waitForFunction(() => Number(document.querySelector('.pullground-dart-scene .pullground-pulse').getAttribute('opacity')) > 0);
      assert.ok(Math.abs(await page.$eval('.pullground-dart-scene .pullground-pulse', el => Number(el.getAttribute('cx'))) - 96.384) < 0.2, 'Pulling left marks an actual hit on the right');
      await page.screenshot({ path: join(screenshots, `demo-aim-dart-hit-${width}.png`) });
      await completed('.pullground-root');
      await idle('.pullground-root');
      if (width === 390) await page.tap('.pullground-demo-export');
      else await page.click('.pullground-demo-export');
      await page.waitForFunction(() => document.querySelector('.pullground-export-backdrop')?.matches(':modal'));
      assert.equal(await page.$eval('.pullground-demo-code code', el => el.textContent), expectedDartExample, 'Export follows the selected game');
      await page.$eval('.pullground-export-modal', async modal => { await Promise.all(modal.getAnimations().map(animation => animation.finished)); });
      await page.evaluate(() => { navigator.clipboard.writeText = async value => { window.copiedExample = value; }; });
      await page.click('.pullground-demo-copy');
      await page.waitForFunction(() => document.querySelector('.pullground-demo-copy').getAttribute('aria-label') === 'React example copied');
      assert.equal(await page.evaluate(() => window.copiedExample), expectedDartExample, 'Copied Dart usage includes its game prop');
      await page.screenshot({ path: join(screenshots, `demo-dart-code-${width}.png`) });
      await page.keyboard.press('Escape');
      await page.waitForSelector('.pullground-export-backdrop', { hidden: true });
      if (width === 390) await page.tap('.pullground-demo-game[data-game="bowling"]');
      else await page.click('.pullground-demo-game[data-game="bowling"]');
      await page.waitForSelector('.pullground-root[data-game="bowling"]');
      assert.deepEqual(await page.$$eval('.pullground-demo-game', buttons => buttons.map(el => el.getAttribute('aria-pressed'))), ['false', 'false', 'true', 'false']);
      await holdPagePull(pullDistance);
      assert.equal(await page.$eval('.pullground-bowling-scene', el => getComputedStyle(el).display !== 'none'), true);
      assert.equal(await page.$eval('.pullground-root', el => {
        const viewport = el.querySelector('.pullground-viewport');
        const court = el.querySelector('.pullground-court');
        const scale = court.getScreenCTM().a;
        const ball = el.querySelector('.pullground-bowling-body');
        const matrix = ball.getScreenCTM();
        return ball.r.baseVal.value === 10 && Math.abs(Math.hypot(matrix.a, matrix.b) / scale - 1) < 0.001
          && Math.abs(Math.hypot(matrix.c, matrix.d) / scale - 1) < 0.001
          && Math.abs(court.getBoundingClientRect().width / Math.min(viewport.clientWidth, viewport.clientHeight) - 160 / 384) < 0.001;
      }), true, 'The bowling pins and ball share the existing scene proportions');
      await page.screenshot({ path: join(screenshots, `demo-bowling-pull-${width}.png`) });
      await releasePagePull();
      await bowlingStrike('.pullground-root');
      await page.screenshot({ path: join(screenshots, `demo-bowling-strike-${width}.png`) });
      await completed('.pullground-root');
      await idle('.pullground-root');
      await holdPagePull(pullDistance, Math.min(width, height) * 0.08, { x: width / 2, y: 96 });
      assert.ok(Math.abs(await page.$eval('.pullground-bowling-ball', el => el.transform.baseVal.consolidate().matrix.e) - 84.096) < 0.15);
      assert.equal(await page.$eval('.pullground-aim', el => el.getPointAtLength(el.getTotalLength()).x < el.getPointAtLength(0).x), true, 'Bowling previews a roll opposite the pull direction');
      await releasePagePull();
      await completed('.pullground-root');
      await idle('.pullground-root');
      await page.click('.pullground-demo-export');
      await page.waitForFunction(() => document.querySelector('.pullground-export-backdrop')?.matches(':modal'));
      assert.equal(await page.$eval('.pullground-demo-code code', el => el.textContent), expectedBowlingExample);
      await page.$eval('.pullground-export-modal', async modal => { await Promise.all(modal.getAnimations().map(animation => animation.finished)); });
      await page.click('.pullground-demo-copy');
      await page.waitForFunction(() => document.querySelector('.pullground-demo-copy').getAttribute('aria-label') === 'React example copied');
      assert.equal(await page.evaluate(() => window.copiedExample), expectedBowlingExample, 'Copied Bowling usage includes its game prop');
      await page.screenshot({ path: join(screenshots, `demo-bowling-code-${width}.png`) });
      await page.keyboard.press('Escape');
      await page.waitForSelector('.pullground-export-backdrop', { hidden: true });
      if (width === 390) await page.tap('.pullground-demo-game[data-game="stone"]');
      else await page.click('.pullground-demo-game[data-game="stone"]');
      await page.waitForSelector('.pullground-root[data-game="stone"]');
      assert.deepEqual(await page.$$eval('.pullground-demo-game', buttons => buttons.map(el => el.getAttribute('aria-pressed'))), ['false', 'false', 'false', 'true']);
      await holdPagePull(pullDistance, Math.min(width, height) * 0.08, { x: width / 2, y: 96 });
      assert.equal(await page.$eval('.pullground-stone-scene', el => getComputedStyle(el).display !== 'none'), true);
      assert.equal(await page.$eval('.pullground-root', el => {
        const viewport = el.querySelector('.pullground-viewport');
        const court = el.querySelector('.pullground-court');
        const stone = el.querySelector('.pullground-stone').getScreenCTM();
        return Math.abs(Math.hypot(stone.a, stone.b) / court.getScreenCTM().a - 1) < 0.001
          && Math.abs(court.getBoundingClientRect().width / Math.min(viewport.clientWidth, viewport.clientHeight) - 160 / 384) < 0.001;
      }), true, 'The held stone shares the proportional scene scale at every viewport');
      assert.ok(Math.abs(await page.$eval('.pullground-stone', el => el.transform.baseVal.consolidate().matrix.e) - 84.096) < 0.15);
      assert.equal(await page.$eval('.pullground-aim', el => el.getPointAtLength(el.getTotalLength()).x < el.getPointAtLength(0).x), true, 'Stone skipping previews the opposite pull direction');
      await page.screenshot({ path: join(screenshots, `demo-stone-pull-${width}.png`) });
      await releasePagePull();
      await ripplesVisible('.pullground-root');
      assert.equal(await page.$eval('.pullground-stone', el => el.transform.baseVal.consolidate().matrix.e < 80), true);
      await page.screenshot({ path: join(screenshots, `demo-stone-skipping-${width}.png`) });
      await completed('.pullground-root');
      await idle('.pullground-root');
      await page.click('.pullground-demo-export');
      await page.waitForFunction(() => document.querySelector('.pullground-export-backdrop')?.matches(':modal'));
      assert.equal(await page.$eval('.pullground-demo-code code', el => el.textContent), expectedStoneExample);
      await page.$eval('.pullground-export-modal', async modal => { await Promise.all(modal.getAnimations().map(animation => animation.finished)); });
      await page.click('.pullground-demo-copy');
      await page.waitForFunction(() => document.querySelector('.pullground-demo-copy').getAttribute('aria-label') === 'React example copied');
      assert.equal(await page.evaluate(() => window.copiedExample), expectedStoneExample, 'Copied Stone skipping usage includes its game prop');
      await page.screenshot({ path: join(screenshots, `demo-stone-code-${width}.png`) });
      await page.keyboard.press('Escape');
      await page.waitForSelector('.pullground-export-backdrop', { hidden: true });
      await page.focus('.pullground-demo-game[data-game="basketball"]');
      await page.keyboard.press('Space');
      await page.waitForSelector('.pullground-root[data-game="basketball"]');
      assert.equal(await page.$eval('.pullground-demo-game[data-game="basketball"]', el => el === document.activeElement && el.matches(':focus-visible')), true, 'The switch supports keyboard activation and visible focus');
      assert.deepEqual(await page.$$eval('.pullground-demo-game', buttons => buttons.map(el => el.getAttribute('aria-pressed'))), ['true', 'false', 'false', 'false']);

      await page.evaluate(() => { window.themeHeader = document.querySelector('.pullground-demo-header'); });
      for (const theme of ['simple', 'ocean', 'midnight']) {
        const themeButton = `.pullground-demo-theme[data-theme="${theme}"]`;
        if (width === 390) await page.tap(themeButton);
        else await page.click(themeButton);
        await page.waitForSelector(`.pullground-root[data-theme="${theme}"]`);
        assert.equal(await page.$eval('.pullground-demo-page', el => el.dataset.theme), theme);
        assert.deepEqual(await page.$$eval('.pullground-demo-theme[aria-pressed="true"]', buttons => buttons.map(el => el.dataset.theme)), [theme]);
        assert.equal(await page.$eval('.pullground-root', el => el.dataset.state), 'success', 'Theme selection never runs an action');
        assert.equal(await page.evaluate(() => window.themeHeader === document.querySelector('.pullground-demo-header')), true);
        assert.equal(await page.$eval('.pullground-demo-page', el => el.scrollWidth <= el.clientWidth), true);
        for (const game of ['basketball', 'dart', 'bowling', 'stone']) {
          await page.click(`.pullground-demo-game[data-game="${game}"]`);
          await holdPagePull(pullDistance);
          await page.waitForSelector('.pullground-root[data-pulling="true"]');
          await expectPaint('.pullground-ball', 'fill', themeArtwork[theme].body);
          await expectPaint('.pullground-backboard', 'fill', themeArtwork[theme].face);
          await expectPaint('.pullground-dart-target', 'fill', themeArtwork[theme].face);
          await expectPaint('.pullground-bowling-body', 'fill', themeArtwork[theme].body);
          await expectPaint('.pullground-bowling-pin-body', 'fill', themeArtwork[theme].face);
          await expectPaint('.pullground-stone-body', 'fill', themeArtwork[theme].body);
          await expectPaint('.pullground-stone-ripples', 'stroke', themeArtwork[theme].outline);
          if (theme === 'simple') {
            assert.equal(await page.$eval('.pullground-seams', el => getComputedStyle(el).stroke), 'rgb(255, 255, 255)', 'The monochrome ball retains visible seams');
          }
          await page.screenshot({ path: join(screenshots, `demo-theme-${theme}-${game}-${width}.png`) });
          await releasePagePull();
          await completed('.pullground-root');
          await idle('.pullground-root');
          await page.click('.pullground-demo-export');
          await page.waitForFunction(() => document.querySelector('.pullground-export-backdrop')?.matches(':modal'));
          const themedExample = expectedExamples[game].replace('onPull={handlePull}', `theme="${theme}" onPull={handlePull}`);
          assert.equal(await page.$eval('.pullground-demo-code code', el => el.textContent), themedExample, 'Export includes the selected game and theme');
          await page.$eval('.pullground-export-modal', async modal => { await Promise.all(modal.getAnimations().map(animation => animation.finished)); });
          await page.click('.pullground-demo-copy');
          await page.waitForFunction(() => document.querySelector('.pullground-demo-copy').getAttribute('aria-label') === 'React example copied');
          assert.equal(await page.evaluate(() => window.copiedExample), themedExample);
          if (game === 'basketball') await page.screenshot({ path: join(screenshots, `demo-theme-${theme}-code-${width}.png`) });
          await page.keyboard.press('Escape');
          await page.waitForSelector('.pullground-export-backdrop', { hidden: true });
        }
      }
      await page.focus('.pullground-demo-theme[data-theme="classic"]');
      await page.keyboard.press('Space');
      await page.waitForSelector('.pullground-root[data-theme="classic"]');
      assert.equal(await page.$eval('.pullground-demo-theme[data-theme="classic"]', el => el.matches(':focus-visible') && el.getAttribute('aria-pressed') === 'true'), true, 'Theme chips support Space and visible focus');
      await page.keyboard.press('Tab');
      assert.equal(await page.$eval('.pullground-demo-theme[data-theme="simple"]', el => el === document.activeElement), true, 'Tab follows the visible theme order');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.pullground-root[data-theme="simple"]');
      assert.deepEqual(await page.$$eval('.pullground-demo-theme[aria-pressed="true"]', buttons => buttons.map(el => el.dataset.theme)), ['simple']);
    }
    await page.goto(siteUrl, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.design-catalog-grid');
    assert.equal(await page.$eval('a[href="/pullground"]', el => el.getAttribute('aria-label')), 'Open Pullground');
    await page.click('a[href="/pullground"]');
    await page.waitForSelector('.pullground-demo-page');
    assert.equal(new URL(page.url()).pathname, '/pullground');
    assert.equal(await page.$eval('.pullground-demo-hint', el => el.textContent.trim()), '', 'The header pull cue is wordless');
    await page.goto(`${siteUrl}/refresh`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.pullground-demo-page');
    assert.equal(new URL(page.url()).pathname, '/pullground', 'The previous demo URL redirects to Pullground');
    assert.equal(await page.title(), 'Pullground — Design');
  }
  assert.deepEqual(errors, [], 'No console, runtime, or hydration errors');
  console.log(`Pullground browser checks passed (${await browser.version()}). Screenshots: ${screenshots}`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
  if (siteServer) await new Promise(resolve => siteServer.httpServer.close(resolve));
}
