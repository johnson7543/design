import { spawn } from 'node:child_process';
import { access, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const recordingExtensionDirectory = join(projectRoot, 'scripts', 'recording-extension');
const extensionShortcutSource = join(
  recordingExtensionDirectory,
  'invoke-action-x11.c'
);
const host = '127.0.0.1';
const windowsPowerShell =
  '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function projectPath(pathValue, label) {
  if (typeof pathValue !== 'string' || pathValue.length === 0) {
    throw new Error(`${label} must be a non-empty repository-relative path.`);
  }

  const resolvedPath = resolve(projectRoot, pathValue);
  const relativePath = relative(projectRoot, resolvedPath);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`${label} must stay inside ${projectRoot}.`);
  }
  return resolvedPath;
}

function positiveNumber(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return value;
}

const scenarioArgument = argumentValue('--scenario');
if (!scenarioArgument) {
  throw new Error(
    'Missing --scenario. Example: npm run record:demo -- --scenario ' +
      'scripts/demo-video-scenarios/design-qr.json'
  );
}

const scenarioPath = projectPath(scenarioArgument, 'Scenario path');
const scenario = JSON.parse(await readFile(scenarioPath, 'utf8'));
if (scenario.version !== 1) throw new Error('Demo video scenario version must be 1.');
if (typeof scenario.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(scenario.id)) {
  throw new Error('Scenario id must contain lowercase letters, digits, and hyphens.');
}
if (typeof scenario.product !== 'string' || scenario.product.length === 0) {
  throw new Error('Scenario product must be a non-empty string.');
}
if (!Array.isArray(scenario.actions) || scenario.actions.length === 0) {
  throw new Error('Scenario actions must contain at least one action.');
}

const route = scenario.route ?? '/';
const windowTitle = scenario.windowTitle ?? scenario.product;
const readySelector = scenario.readySelector ?? 'body';
const settleMs = scenario.settleMs ?? 1_000;
const viewport = {
  width: scenario.viewport?.width ?? 412,
  height: scenario.viewport?.height ?? 915,
  deviceScaleFactor: scenario.viewport?.deviceScaleFactor ?? 1,
  isMobile: scenario.viewport?.isMobile ?? true,
  hasTouch: scenario.viewport?.hasTouch ?? true,
};
const userAgent =
  scenario.userAgent ??
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const recording = scenario.recording ?? {};
const recordingFps = positiveNumber(recording.fps ?? 60, 'Recording fps');
const targetDurationSeconds = positiveNumber(
  recording.durationSeconds ?? 8,
  'Recording durationSeconds'
);
const videoPath = projectPath(recording.output, 'Recording output');
const posterPath = recording.poster
  ? projectPath(recording.poster, 'Recording poster')
  : undefined;
const outputWidth = positiveNumber(recording.size?.width ?? 720, 'Output width');
const outputHeight = positiveNumber(recording.size?.height ?? 1280, 'Output height');
const crop = recording.crop;
const cropWidth = crop?.width ?? 'iw';
const cropHeight = crop?.height ?? 'ih';
const cropX = crop?.x ?? 0;
const cropY = crop?.y ?? 0;
const crf = recording.crf ?? 26;
for (const [label, value] of [
  ['crop.width', cropWidth],
  ['crop.height', cropHeight],
  ['crop.x', cropX],
  ['crop.y', cropY],
]) {
  if (!(Number.isInteger(value) && value >= 0) && value !== 'iw' && value !== 'ih') {
    throw new Error(`${label} must be a non-negative integer, "iw", or "ih".`);
  }
}
if (!Number.isInteger(crf) || crf < 0 || crf > 51) {
  throw new Error('Recording crf must be an integer between 0 and 51.');
}

const port = Number(process.env.PREVIEW_RECORD_PORT ?? scenario.previewPort ?? 4174);
const previewUrl = `http://${host}:${port}`;
const sourceVideoPath = join('/tmp', `${scenario.id}-preview-${process.pid}.webm`);
const extensionShortcutPath = join('/tmp', `${scenario.id}-shortcut-${process.pid}`);
const captureMessageTimeoutMs = Math.max(15_000, (targetDurationSeconds + 10) * 1_000);
const capturePostRollMs = 250;
let previewLog = '';

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

async function findChrome() {
  const chromeForTestingRoot = join(homedir(), '.cache', 'puppeteer', 'chrome');
  let chromeForTestingCandidates = [];
  try {
    chromeForTestingCandidates = (await readdir(chromeForTestingRoot))
      .filter((directory) => directory.startsWith('linux-'))
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
      .map((directory) =>
        join(chromeForTestingRoot, directory, 'chrome-linux64', 'chrome')
      );
  } catch {
    // Fall back to the system browser when Puppeteer's browser cache is absent.
  }

  const candidates = [
    process.env.CHROME_BIN,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    ...chromeForTestingCandidates,
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
      // Try the next known browser location.
    }
  }

  throw new Error('Chrome was not found. Set CHROME_BIN to a Chrome or Chromium executable.');
}

async function waitForPreview(preview, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (preview.exitCode !== null) {
      throw new Error(
        `Vite preview exited early with code ${preview.exitCode}.\n${previewLog.trim()}`
      );
    }

    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }

    await wait(100);
  }

  throw new Error(
    `Vite preview did not become ready at ${previewUrl}.\n${previewLog.trim()}`
  );
}

async function runCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise(output);
      } else {
        reject(new Error(`${command} exited with code ${code}.\n${output.trim()}`));
      }
    });
  });
}

async function invokeRecorderShortcut(browserPid, targetWindowTitle) {
  try {
    await access(windowsPowerShell, constants.X_OK);
    const escapedWindowTitle = targetWindowTitle.replaceAll("'", "''");
    await runCommand(windowsPowerShell, [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      [
        '$shell = New-Object -ComObject WScript.Shell',
        `if (-not $shell.AppActivate('${escapedWindowTitle}')) { exit 2 }`,
        'Start-Sleep -Milliseconds 250',
        "$shell.SendKeys('^+y')",
      ].join('; '),
    ]);
    return;
  } catch {
    // Non-WSL systems use the small X11 helper compiled below.
  }

  await runCommand('/usr/bin/gcc', [
    extensionShortcutSource,
    '-o',
    extensionShortcutPath,
    '-Wl,-l:libX11.so.6',
    '-Wl,-l:libXtst.so.6',
  ]);
  await runCommand(extensionShortcutPath, [String(browserPid)]);
}

function requiredSelector(item, label) {
  if (typeof item.selector !== 'string' || item.selector.length === 0) {
    throw new Error(`${label} requires a selector.`);
  }
  return item.selector;
}

async function assertElement(page, assertion, label) {
  const selector = requiredSelector(assertion, label);
  const failures = await page.$eval(
    selector,
    (element, expected) => {
      const mismatches = [];
      if ('value' in expected) {
        const actual = 'value' in element ? element.value : undefined;
        if (actual !== expected.value) {
          mismatches.push(`value was ${JSON.stringify(actual)}`);
        }
      }
      if ('text' in expected) {
        const actual = element.textContent?.trim() ?? '';
        if (actual !== expected.text) {
          mismatches.push(`text was ${JSON.stringify(actual)}`);
        }
      }
      if ('hasClass' in expected && !element.classList.contains(expected.hasClass)) {
        mismatches.push(`class ${JSON.stringify(expected.hasClass)} was absent`);
      }
      if ('attribute' in expected) {
        const actual = element.getAttribute(expected.attribute.name);
        if (actual !== expected.attribute.value) {
          mismatches.push(
            `attribute ${JSON.stringify(expected.attribute.name)} was ${JSON.stringify(actual)}`
          );
        }
      }
      return mismatches;
    },
    assertion
  );

  if (failures.length > 0) {
    throw new Error(`${label} failed for ${selector}: ${failures.join('; ')}`);
  }
}

async function runAction(page, item, index) {
  const label = `Action ${index + 1} (${item.action ?? 'unknown'})`;

  try {
    switch (item.action) {
      case 'wait': {
        if (!Number.isFinite(item.ms) || item.ms < 0) {
          throw new Error('wait requires a non-negative ms value.');
        }
        await wait(item.ms);
        break;
      }
      case 'waitFor': {
        const selector = requiredSelector(item, label);
        const state = item.state ?? 'visible';
        const options = { timeout: item.timeoutMs ?? 10_000 };
        if (state === 'visible') options.visible = true;
        else if (state === 'hidden') options.hidden = true;
        else if (state !== 'attached') {
          throw new Error('waitFor state must be visible, hidden, or attached.');
        }
        await page.waitForSelector(selector, options);
        break;
      }
      case 'click': {
        await page.click(requiredSelector(item, label), {
          clickCount: item.clickCount ?? 1,
          delay: item.delayMs ?? 0,
        });
        break;
      }
      case 'tap': {
        const selector = requiredSelector(item, label);
        const element = await page.$(selector);
        const box = await element?.boundingBox();
        if (!box) throw new Error(`Could not locate a tappable box for ${selector}.`);
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        break;
      }
      case 'focus': {
        await page.focus(requiredSelector(item, label));
        break;
      }
      case 'selectAll': {
        if (item.selector) await page.click(requiredSelector(item, label));
        await page.keyboard.down('Control');
        try {
          await page.keyboard.press('KeyA');
        } finally {
          await page.keyboard.up('Control');
        }
        break;
      }
      case 'type': {
        if (typeof item.text !== 'string') throw new Error('type requires text.');
        await page.keyboard.type(item.text, { delay: item.delayMs ?? 0 });
        break;
      }
      case 'press': {
        if (typeof item.key !== 'string') throw new Error('press requires a key.');
        await page.keyboard.press(item.key, { delay: item.delayMs ?? 0 });
        break;
      }
      case 'hover': {
        await page.hover(requiredSelector(item, label));
        break;
      }
      case 'scroll': {
        await page.mouse.wheel({
          deltaX: item.deltaX ?? 0,
          deltaY: item.deltaY ?? 0,
        });
        break;
      }
      case 'assert': {
        await assertElement(page, item, label);
        break;
      }
      default:
        throw new Error(`Unsupported action ${JSON.stringify(item.action)}.`);
    }
  } catch (error) {
    throw new Error(`${label} failed: ${error instanceof Error ? error.message : error}`);
  }
}

async function verifyApplication(application) {
  if (!application) return;
  if (!Array.isArray(application.consumerFiles) || application.consumerFiles.length === 0) {
    throw new Error('application.consumerFiles must contain at least one source file.');
  }

  const combinedSource = (
    await Promise.all(
      application.consumerFiles.map((file) =>
        readFile(projectPath(file, 'Application consumer file'), 'utf8')
      )
    )
  ).join('\n');
  const expectedPaths = [application.videoPublicPath, application.posterPublicPath].filter(
    Boolean
  );
  for (const expectedPath of expectedPaths) {
    if (!combinedSource.includes(expectedPath)) {
      throw new Error(
        `Generated asset is not applied: ${JSON.stringify(expectedPath)} was not found in ` +
          application.consumerFiles.join(', ')
      );
    }
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
  await mkdir(dirname(videoPath), { recursive: true });
  if (posterPath) await mkdir(dirname(posterPath), { recursive: true });
  await waitForPreview(preview);

  browser = await puppeteer.launch({
    executablePath: await findChrome(),
    // Native tab capture needs a real compositor; Chrome cannot provide a
    // getDisplayMedia video source in headless mode.
    headless: false,
    protocolTimeout: 120_000,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--enable-unsafe-swiftshader',
      '--ozone-platform=x11',
      `--disable-extensions-except=${recordingExtensionDirectory}`,
      `--load-extension=${recordingExtensionDirectory}`,
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(userAgent);
  await page.setViewport(viewport);
  await page.goto(`${previewUrl}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 15_000,
  });
  await page.waitForSelector(readySelector, { timeout: 15_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  if (scenario.recordingCss) {
    await page.addStyleTag({ content: scenario.recordingCss });
  }
  await wait(settleMs);

  // The local recorder extension captures Chrome's real tab compositor. It is
  // invoked through its keyboard action so tabCapture receives a user gesture.
  await page.evaluate((messageTimeoutMs) => {
    const withTimeout = (label) =>
      new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error(`Timed out waiting for ${label}.`));
        }, messageTimeoutMs);

        const onMessage = (event) => {
          if (event.source !== window) return;
          if (event.data?.source !== 'design-demo-local-recorder') return;
          if (event.data.type === 'capture-error') {
            window.clearTimeout(timeout);
            window.removeEventListener('message', onMessage);
            reject(new Error(event.data.message));
            return;
          }
          if (event.data.type !== label) return;
          window.clearTimeout(timeout);
          window.removeEventListener('message', onMessage);
          resolve(event.data);
        };
        window.addEventListener('message', onMessage);
      });

    window.__designDemoCaptureReady = withTimeout('capture-started');
    window.__designDemoCaptureDone = withTimeout('capture-complete');
  }, captureMessageTimeoutMs);

  await page.bringToFront();
  await invokeRecorderShortcut(browser.process()?.pid, windowTitle);
  const captureInfo = await page.evaluate(() => window.__designDemoCaptureReady);
  const sourceFrameRate = Number(captureInfo.settings?.frameRate);
  if (Number.isFinite(sourceFrameRate) && sourceFrameRate + 0.000_1 < recordingFps) {
    throw new Error(
      `Native tab capture is ${sourceFrameRate} fps, below the requested ${recordingFps} fps. ` +
        'Lower the scenario fps instead of upsampling or interpolating frames.'
    );
  }
  const recordingStartedAt = Date.now();

  // Puppeteer supplies real browser input; the running product performs every render.
  for (const [index, action] of scenario.actions.entries()) {
    await runAction(page, action, index);
  }

  const remainingRecordingTime =
    targetDurationSeconds * 1_000 - (Date.now() - recordingStartedAt);
  if (remainingRecordingTime < 0) {
    throw new Error(
      `${scenario.product} actions exceeded the ${targetDurationSeconds}s recording by ` +
        `${Math.abs(remainingRecordingTime)}ms.`
    );
  }
  await wait(remainingRecordingTime);

  for (const [index, assertion] of (scenario.assertions ?? []).entries()) {
    await assertElement(page, assertion, `Assertion ${index + 1}`);
  }

  // MediaRecorder can acknowledge capture just before its first encoded frame.
  // Keep a discarded post-roll so ffmpeg can always trim to the exact target.
  await wait(capturePostRollMs);

  const recording = await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('design-demo-recorder-stop'));
    return window.__designDemoCaptureDone;
  });

  if (recording.byteLength === 0) {
    throw new Error(`${scenario.product} native tab capture returned an empty recording.`);
  }
  await writeFile(sourceVideoPath, Buffer.from(recording.base64, 'base64'));

  await runCommand('/usr/bin/ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    sourceVideoPath,
    '-t',
    String(targetDurationSeconds),
    '-vf',
    `crop=${cropWidth}:${cropHeight}:${cropX}:${cropY},` +
      `scale=${outputWidth}:${outputHeight}:flags=lanczos,setsar=1`,
    '-r',
    String(recordingFps),
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    String(crf),
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    videoPath,
  ]);
  await page.close();

  if (posterPath) {
    const posterArguments = [
      '-y',
      '-ss',
      String(recording.posterAtSeconds ?? 0.4),
      '-i',
      videoPath,
      '-frames:v',
      '1',
    ];
    if (extname(posterPath).toLowerCase() === '.webp') {
      posterArguments.push(
        '-c:v',
        'libwebp',
        '-compression_level',
        '6',
        '-quality',
        String(recording.posterQuality ?? 82)
      );
    }
    posterArguments.push(posterPath);
    await runCommand('/usr/bin/ffmpeg', posterArguments);
  }

  await verifyApplication(scenario.application);
  const qualityReport = await runCommand(process.execPath, [
    join(projectRoot, 'scripts', 'verify-demo-video.mjs'),
    '--scenario',
    scenarioArgument,
  ]);

  console.log(
    `Recorded ${scenario.product}: ${videoPath} ` +
      `(${targetDurationSeconds}s at ${recordingFps} fps from ` +
      `${recording.byteLength} bytes of native tab capture; ` +
      `${JSON.stringify(captureInfo.settings)})`
  );
  if (posterPath) console.log(`Created ${posterPath}`);
  if (scenario.application) console.log('Verified preview asset application.');
  console.log(qualityReport.trim());
} finally {
  await browser?.close().catch(() => {});
  preview.kill('SIGTERM');
  await unlink(sourceVideoPath).catch(() => {});
  await unlink(extensionShortcutPath).catch(() => {});
}
