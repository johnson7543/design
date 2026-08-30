const scenarioUrl = new URL('./demo-video-scenarios/design-qr.json', import.meta.url);

if (!process.argv.includes('--scenario')) {
  process.argv.push('--scenario', scenarioUrl.pathname);
}

await import('./record-demo-video.mjs');
