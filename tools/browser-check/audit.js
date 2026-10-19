// CLI: npm run audit. Drives a headless Chrome through the main UI states, extracts snapshots with the page-side functions of auditPage.js, applies the pure
// rules of auditRules.js and writes docs/AUDIT.md. It exits non-zero only when the tool itself fails, never because of findings.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { launchChrome } from './chrome.js';
import { connect } from './cdp.js';
import { startLocalServer } from './check.js';
import { snapshot, focusSample, trapSample, layoutSample, sampleFrames } from './auditPage.js';
import { auditMarkdown, auditTotals, evaluateState } from './auditReport.js';
import { frameSummary } from './auditRules.js';

const OUT = fileURLToPath(new URL('../../docs/AUDIT.md', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = (fn, ...args) => `(${fn})(${args.map((a) => JSON.stringify(a)).join(',')})`;
const KEYS = { Tab: { code: 'Tab', vk: 9 }, Escape: { code: 'Escape', vk: 27 }, Enter: { code: 'Enter', vk: 13 }, Shift: { code: 'ShiftLeft', vk: 16 }, i: { code: 'KeyI', vk: 73, text: 'i' }, '`': { code: 'Backquote', vk: 192, text: '`' } };
const SIZES = [[1920, 1080], [1280, 720], [1024, 576], [800, 600]];
const GAME = '/?seed=1&play=1&waves=15&mode=adaptive';

/** Open a fresh headless Chrome page, run fn(page), always close it. */
async function withPage({ url, width = 1280, height = 720, reducedMotion = false, storage = null, wait = 2500 }, fn) {
  const chrome = await launchChrome({ width, height });
  const cdp = await connect(chrome.pageWsUrl);
  try {
    await Promise.all(['Runtime', 'Page'].map((d) => cdp.send(`${d}.enable`)));
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    if (reducedMotion) await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    if (storage) await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('siegeMind.settings.v1', ${JSON.stringify(JSON.stringify(storage))}); } catch (e) {}` });
    await cdp.send('Page.navigate', { url });
    await sleep(wait);
    const page = {
      async eval(expr) {
        const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
        return r.result.value;
      },
      async press(name) {
        const k = KEYS[name];
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: k.code, windowsVirtualKeyCode: k.vk, ...(k.text ? { text: k.text } : {}) });
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: k.code, windowsVirtualKeyCode: k.vk });
        await sleep(120);
      },
      clickText: (text) => page.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (b) b.click(); return !!b; })()`),
    };
    return await fn(page);
  } finally {
    cdp.close();
    chrome.close();
  }
}

const collect = async (page) => ({ snapshot: await page.eval(call(snapshot)) });

/** Tab through the page and sample focus rings; with a dialog open also sample the trap. */
async function tabSamples(page, n, dialog) {
  const focus = [];
  const tabs = [];
  for (let i = 0; i < n; i++) {
    await page.press('Tab');
    focus.push(await page.eval(call(focusSample)));
    if (dialog) tabs.push(await page.eval(call(trapSample)));
  }
  return { focus, traps: dialog ? [{ dialog, tabs }] : [] };
}

async function dialogState(base, name, open, { escapeShouldClose = true } = {}) {
  return withPage({ url: base + (open.url ?? GAME) }, async (page) => {
    await open.steps(page);
    await sleep(500);
    const st = { name, ...(await collect(page)), ...(await tabSamples(page, 12, name)) };
    if (escapeShouldClose) {
      const before = await page.eval('document.querySelectorAll(\'[role="dialog"]\').length');
      await page.press('Escape');
      await sleep(300);
      st.escapeCloses = (await page.eval('document.querySelectorAll(\'[role="dialog"]\').length')) < before;
    }
    return st;
  });
}

async function runStates(base) {
  const states = [];
  states.push(await withPage({ url: `${base}/` }, async (page) => ({ name: 'Main menu', ...(await collect(page)), ...(await tabSamples(page, 12, 'Main menu')) })));
  states.push(await withPage({ url: base + GAME, wait: 3500 }, async (page) => ({ name: 'Game (adaptive, first-run hint visible)', ...(await collect(page)), ...(await tabSamples(page, 14, null)) })));
  states.push(await dialogState(base, 'Pause menu', { steps: (p) => p.press('Escape') }));
  states.push(await dialogState(base, 'Settings', { steps: async (p) => { await p.press('Escape'); await p.clickText('Settings'); } }));
  states.push(await dialogState(base, 'How to play', { steps: async (p) => { await p.press('Escape'); await p.clickText('How to play'); } }));
  states.push(await withPage({ url: base + GAME }, async (page) => { await page.press('i'); await sleep(600); return { name: 'Director overlay', ...(await collect(page)) }; }));
  states.push(await dialogState(base, 'Defeat end screen', { url: '/?debug=1&startlives=1&seed=1&play=1&waves=15', steps: async (p) => {
    await p.eval('window.__siege.startWave(); window.__siege.step(120000); true');
    await sleep(3500);
  } }, { escapeShouldClose: false }));
  states.push(await withPage({ url: `${base}/gallery.html`, wait: 3500 }, async (page) => ({ name: 'Gallery', ...(await collect(page)) })));
  return states;
}

async function runSizes(base) {
  const out = [];
  for (const [w, h] of SIZES) out.push({ label: `${w}x${h}`, ...(await withPage({ url: base + GAME, width: w, height: h }, (page) => page.eval(call(layoutSample)))) });
  return out;
}

/** Opening the pause menu starts the modal fade, so the count of running animations right after the keypress shows whether motion is really off. */
async function runMotion(base) {
  const probe = `(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return document.getAnimations().length; })()`;
  const one = (reducedMotion) => withPage({ url: base + GAME, wait: 3500, reducedMotion }, async (page) => ({ ...(await page.eval(call(layoutSample))), animations: await page.eval(probe) }));
  return { normal: await one(false), reduced: await one(true) };
}

export async function runPerf(base) {
  const out = [];
  for (const quality of ['high', 'low']) {
    const r = await withPage({ url: `${base}/?debug=1&stress=1&seed=1&play=1&waves=15`, storage: { quality, autoQuality: false }, wait: 2000 }, async (page) => {
      await page.press('Shift'); // a keydown is a user gesture: the audio engine is unlocked while frames are sampled
      const deltas = await page.eval(`${call(sampleFrames, 3000, 8000)}`);
      const enemies = await page.eval('window.__siege.game.enemies.length');
      return { ...frameSummary(deltas), enemies, quality };
    });
    out.push(r);
  }
  return out;
}

export async function main() {
  const server = await startLocalServer();
  try {
    const result = { states: await runStates(server.base), sizes: await runSizes(server.base), motion: await runMotion(server.base), perf: await runPerf(server.base), meta: { generatedBy: 'npm run audit (tools/browser-check/audit.js)' } };
    writeFileSync(OUT, auditMarkdown(result));
    for (const st of result.states) {
      const e = evaluateState(st);
      const n = Object.values(e.findings).reduce((a, v) => a + v.length, 0);
      console.log(`${n === 0 ? 'clean ' : `${String(n).padStart(3)} finding(s)`}  ${e.name}  (contrast checked ${e.checked}, unresolved ${e.unresolved})`);
      for (const [k, v] of Object.entries(e.findings)) if (v.length) console.log(`      ${k}: ${v.length}  e.g. ${JSON.stringify(v[0])}`);
    }
    const t = auditTotals(result);
    console.log(`sizes: ${result.sizes.map((s) => `${s.label} scrollWidth ${s.scrollWidth}`).join(', ')}`);
    console.log(`reduced motion: ${result.motion.normal.animations} animations normal, ${result.motion.reduced.animations} reduced (class ${result.motion.reduced.reducedClass})`);
    for (const p of result.perf) console.log(`perf ${p.quality}: avg ${p.avgMs.toFixed(1)} ms, p95 ${p.p95Ms.toFixed(1)} ms, max ${p.maxMs.toFixed(1)} ms, enemies ${p.enemies}`);
    console.log(`TOTAL: ${t.violations} findings, ${t.unresolved} unresolved contrast entries; report written to ${OUT}`);
    return 0;
  } catch (e) {
    console.error(`audit failed: ${e.stack ?? e.message}`);
    return e.exitCode ?? 1;
  } finally {
    server.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then((c) => process.exit(c));
