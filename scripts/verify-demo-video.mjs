import { spawn } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

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

function nonNegativeNumber(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return value;
}

function parseFrameRate(value) {
  const [numerator, denominator] = String(value).split('/').map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return Number.NaN;
  }
  return numerator / denominator;
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'motion';
}

async function runCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(output);
      else reject(new Error(`${command} exited with code ${code}.\n${output.trim()}`));
    });
  });
}

async function createContactSheet({
  videoPath,
  outputPath,
  startSeconds = 0,
  durationSeconds,
  samplesPerSecond,
}) {
  const sampleCount = Math.max(1, Math.ceil(durationSeconds * samplesPerSecond));
  const columns = Math.min(5, sampleCount);
  const rows = Math.ceil(sampleCount / columns);
  await runCommand('/usr/bin/ffmpeg', [
    '-y',
    '-v',
    'error',
    '-i',
    videoPath,
    '-vf',
    `trim=start=${startSeconds}:duration=${durationSeconds},` +
      `setpts=PTS-STARTPTS,fps=${samplesPerSecond},scale=220:-2,` +
      `tile=${columns}x${rows}:padding=4:margin=4`,
    '-frames:v',
    '1',
    outputPath,
  ]);
}

async function verifyMotionWindow(videoPath, check, targetDurationSeconds, index) {
  const label = typeof check.label === 'string' && check.label.trim()
    ? check.label.trim()
    : `motion-${index + 1}`;
  const startSeconds = nonNegativeNumber(
    check.startSeconds,
    `Motion check ${JSON.stringify(label)} startSeconds`
  );
  const durationSeconds = positiveNumber(
    check.durationSeconds,
    `Motion check ${JSON.stringify(label)} durationSeconds`
  );
  if (startSeconds + durationSeconds > targetDurationSeconds + 0.000_001) {
    throw new Error(`Motion check ${JSON.stringify(label)} extends past the video duration.`);
  }

  const maxConsecutiveDuplicateFrames = check.maxConsecutiveDuplicateFrames ?? 0;
  if (!Number.isInteger(maxConsecutiveDuplicateFrames) || maxConsecutiveDuplicateFrames < 0) {
    throw new Error(
      `Motion check ${JSON.stringify(label)} maxConsecutiveDuplicateFrames must be a ` +
        'non-negative integer.'
    );
  }

  const frameHashes = await runCommand('/usr/bin/ffmpeg', [
    '-v',
    'error',
    '-i',
    videoPath,
    '-vf',
    `trim=start=${startSeconds}:duration=${durationSeconds},setpts=PTS-STARTPTS`,
    '-an',
    '-f',
    'framemd5',
    '-',
  ]);
  const hashes = frameHashes
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(',').at(-1)?.trim())
    .filter(Boolean);
  if (hashes.length < 2) {
    throw new Error(`Motion check ${JSON.stringify(label)} contains fewer than two frames.`);
  }

  let consecutiveDuplicateFrames = 0;
  let longestDuplicateRun = 0;
  for (let frameIndex = 1; frameIndex < hashes.length; frameIndex += 1) {
    if (hashes[frameIndex] === hashes[frameIndex - 1]) {
      consecutiveDuplicateFrames += 1;
      longestDuplicateRun = Math.max(longestDuplicateRun, consecutiveDuplicateFrames);
    } else {
      consecutiveDuplicateFrames = 0;
    }
  }
  if (longestDuplicateRun > maxConsecutiveDuplicateFrames) {
    throw new Error(
      `Motion check ${JSON.stringify(label)} found ${longestDuplicateRun} consecutive ` +
        `duplicate frame(s); allowed ${maxConsecutiveDuplicateFrames}.`
    );
  }

  const contactSheetFps = positiveNumber(
    check.contactSheetFps ?? 5,
    `Motion check ${JSON.stringify(label)} contactSheetFps`
  );
  const contactSheetPath = join(
    '/tmp',
    `${scenario.id}-${slugify(label)}-motion-contact-sheet.png`
  );
  await createContactSheet({
    videoPath,
    outputPath: contactSheetPath,
    startSeconds,
    durationSeconds,
    samplesPerSecond: contactSheetFps,
  });

  return { label, frameCount: hashes.length, longestDuplicateRun, contactSheetPath };
}

const scenarioArgument = argumentValue('--scenario');
if (!scenarioArgument) {
  throw new Error(
    'Missing --scenario. Example: npm run verify:demo -- --scenario ' +
      'scripts/demo-video-scenarios/design-qr.json'
  );
}

const scenarioPath = projectPath(scenarioArgument, 'Scenario path');
const scenario = JSON.parse(await readFile(scenarioPath, 'utf8'));
if (typeof scenario.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(scenario.id)) {
  throw new Error('Scenario id must contain lowercase letters, digits, and hyphens.');
}
if (typeof scenario.product !== 'string' || scenario.product.length === 0) {
  throw new Error('Scenario product must be a non-empty string.');
}
const recording = scenario.recording ?? {};
const recordingFps = positiveNumber(recording.fps, 'Recording fps');
const targetDurationSeconds = positiveNumber(
  recording.durationSeconds,
  'Recording durationSeconds'
);
const outputWidth = positiveNumber(recording.size?.width, 'Output width');
const outputHeight = positiveNumber(recording.size?.height, 'Output height');
const expectedFrameCountRaw = recordingFps * targetDurationSeconds;
const expectedFrameCount = Math.round(expectedFrameCountRaw);
if (Math.abs(expectedFrameCountRaw - expectedFrameCount) > 0.000_001) {
  throw new Error('Recording fps multiplied by durationSeconds must produce a whole frame count.');
}

const videoPath = projectPath(recording.output, 'Recording output');
const probeOutput = await runCommand('/usr/bin/ffprobe', [
  '-v',
  'error',
  '-count_frames',
  '-select_streams',
  'v:0',
  '-show_entries',
  'stream=codec_name,width,height,sample_aspect_ratio,avg_frame_rate,nb_frames,nb_read_frames,duration',
  '-show_entries',
  'format=duration',
  '-of',
  'json',
  videoPath,
]);
const probe = JSON.parse(probeOutput);
const stream = probe.streams?.[0];
if (!stream) throw new Error('The recording has no video stream.');

const actualFps = parseFrameRate(stream.avg_frame_rate);
const actualDurationSeconds = Number(stream.duration ?? probe.format?.duration);
const actualFrameCount = Number(stream.nb_read_frames ?? stream.nb_frames);
const failures = [];
if (stream.codec_name !== 'h264') failures.push(`codec is ${stream.codec_name}, expected h264`);
if (stream.width !== outputWidth || stream.height !== outputHeight) {
  failures.push(
    `size is ${stream.width}x${stream.height}, expected ${outputWidth}x${outputHeight}`
  );
}
if (stream.sample_aspect_ratio !== '1:1') {
  failures.push(`sample aspect ratio is ${stream.sample_aspect_ratio}, expected 1:1`);
}
if (Math.abs(actualFps - recordingFps) > 0.000_1) {
  failures.push(`average fps is ${actualFps}, expected ${recordingFps}`);
}
if (actualFrameCount !== expectedFrameCount) {
  failures.push(`frame count is ${actualFrameCount}, expected ${expectedFrameCount}`);
}
if (Math.abs(actualDurationSeconds - targetDurationSeconds) > 0.5 / recordingFps) {
  failures.push(
    `duration is ${actualDurationSeconds}s, expected ${targetDurationSeconds}s within half a frame`
  );
}
if (failures.length > 0) {
  throw new Error(`Demo video encoding verification failed:\n- ${failures.join('\n- ')}`);
}

const quality = scenario.quality ?? {};
const contactSheetFps = positiveNumber(
  quality.contactSheetFps ?? 2,
  'quality.contactSheetFps'
);
const contactSheetPath = join('/tmp', `${scenario.id}-demo-contact-sheet.png`);
await createContactSheet({
  videoPath,
  outputPath: contactSheetPath,
  durationSeconds: targetDurationSeconds,
  samplesPerSecond: contactSheetFps,
});

if (quality.motionChecks !== undefined && !Array.isArray(quality.motionChecks)) {
  throw new Error('quality.motionChecks must be an array.');
}
const motionResults = [];
for (const [index, check] of (quality.motionChecks ?? []).entries()) {
  motionResults.push(await verifyMotionWindow(videoPath, check, targetDurationSeconds, index));
}

console.log(
  `Verified ${scenario.product}: ${targetDurationSeconds}s, ${recordingFps} fps, ` +
    `${expectedFrameCount} frames, ${outputWidth}x${outputHeight}, SAR 1:1, h264.`
);
console.log(`Review overall contact sheet: ${contactSheetPath}`);
for (const result of motionResults) {
  console.log(
    `Verified continuous motion ${JSON.stringify(result.label)}: ${result.frameCount} frames, ` +
      `${result.longestDuplicateRun} consecutive duplicates.`
  );
  console.log(`Review motion contact sheet: ${result.contactSheetPath}`);
}
