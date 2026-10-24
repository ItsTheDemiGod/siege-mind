// CLI: npm run shots. Captures the README screenshots (1280x720 PNG, device scale factor 1) into docs/screens/ from a local static server and headless Chrome.
// Exit 0 = every shot written and valid, 1 = a page had errors or a shot is invalid, 2 = no browser. Dev tool; not part of npm test.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { launchChrome } from './chrome.js';
import { connect } from './cdp.js';
import { startLocalServer } from './check.js';
import { SHOTS, SHOT_WIDTH, SHOT_HEIGHT, validateShot } from './shotList.js';

const OUT = fileURLToPath(new URL('../../docs/screens/', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// headless software rendering is slow: pin the quality so the shots show the real look (the game would otherwise downgrade itself)
const settingsFor = (shot) => JSON.stringify({ quality: shot.quality ?? 'high', autoQuality: false });

async function capture(shot, base) {
  const chrome = await launchChrome({ width: SHOT_WIDTH, height: SHOT_HEIGHT });
  const cdp = await connect(chrome.pageWsUrl);
  const problems = [];
  try {
    cdp.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') problems.push(`console error: ${p.args.map((a) => a.value ?? a.description ?? '').join(' ')}`); });
    cdp.on('Runtime.exceptionThrown', (p) => problems.push(`exception: ${p.exceptionDetails.exception?.description ?? p.exceptionDetails.text}`));
    cdp.on('Network.responseReceived', (p) => { if (p.response.status >= 400 && !p.response.url.endsWith('/favicon.ico')) problems.push(`request: ${p.response.status} ${p.response.url}`); });
    await Promise.all(['Runtime', 'Page', 'Network'].map((d) => cdp.send(`${d}.enable`)));
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: SHOT_WIDTH, height: SHOT_HEIGHT, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('siegeMind.settings.v1', ${JSON.stringify(settingsFor(shot))}); } catch (e) { /* storage blocked */ }` });
    await cdp.send('Page.navigate', { url: base + shot.url });
    await sleep(2200);
    const r = await cdp.send('Runtime.evaluate', { expression: shot.prepare, awaitPromise: true, returnByValue: true, timeout: 120000 });
    if (r.exceptionDetails) problems.push(`prepare failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    else if (!r.result.value.ok) problems.push(`expected element missing or condition not reached: ${r.result.value.detail}`);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const png = Buffer.from(data, 'base64');
    problems.push(...validateShot(png, { width: SHOT_WIDTH, height: SHOT_HEIGHT }));
    return { png, problems, detail: r.result?.value?.detail };
  } finally {
    cdp.close();
    chrome.close();
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = await startLocalServer();
  let failed = 0;
  try {
    for (const shot of SHOTS) {
      let line;
      try {
        const { png, problems, detail } = await capture(shot, server.base);
        writeFileSync(`${OUT}${shot.name}.png`, png);
        if (problems.length) failed++;
        line = `${problems.length ? 'FAIL' : 'ok  '}  ${shot.name}  ${png.length} bytes  (${detail})${problems.map((p) => `\n      ${p}`).join('')}`;
      } catch (e) {
        if (e.exitCode === 2) { console.error(e.message); return 2; }
        failed++;
        line = `FAIL  ${shot.name}  ${e.message}`;
      }
      console.log(line);
    }
  } finally {
    server.close();
  }
  console.log(failed === 0 ? `all ${SHOTS.length} screenshots written to docs/screens` : `${failed} of ${SHOTS.length} screenshots failed`);
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then((code) => process.exit(code));
