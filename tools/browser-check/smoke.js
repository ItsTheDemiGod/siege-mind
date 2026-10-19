// CLI: node tools/browser-check/smoke.js. Loads the main pages in a headless Chrome and checks that they came up. Exit 0 = all pass, 1 = a check failed, 2 = no browser.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { inspectPage, isClean } from './page.js';
import { startLocalServer } from './check.js';

const GALLERY_SECTIONS = ['palette', 'type', 'enemies', 'states', 'towers', 'icons', 'screens', 'fx', 'ui', 'director', 'map', 'cvd', 'audio', 'quality'];

// Each expression returns {ok, detail}; they run inside the page.
const CHECKS = [
  {
    name: 'main menu', path: '/', wait: 2500, shot: 'smoke-menu.png',
    expr: `(() => { const d = document.querySelector('[role="dialog"]'); const r = document.querySelector('[role="radio"][data-id="adaptive"]'); const parts = { title: !!d && d.textContent.includes('SIEGE MIND'), adaptiveRadio: !!r, adaptiveEnabled: !!r && r.getAttribute('aria-disabled') !== 'true' }; return { ok: Object.values(parts).every(Boolean), detail: JSON.stringify(parts) }; })()`,
  },
  {
    name: 'game page', path: '/?seed=1&play=1&waves=15', wait: 2500, shot: 'smoke-game.png',
    expr: `(() => { const hud = document.querySelector('.hud'); const parts = { canvas: !!document.querySelector('canvas#game'), hud015: !!hud && hud.textContent.includes('0 / 15'), waveControl: !!document.querySelector('.wave-control') }; return { ok: Object.values(parts).every(Boolean), detail: JSON.stringify(parts) }; })()`,
  },
  {
    name: 'adaptive game page', path: '/?seed=1&play=1&waves=15&mode=adaptive', wait: 2500, shot: 'smoke-adaptive.png',
    expr: `(() => { const hud = document.querySelector('.hud'); const parts = { canvas: !!document.querySelector('canvas#game'), hud015: !!hud && hud.textContent.includes('0 / 15'), waveControl: !!document.querySelector('.wave-control') }; return { ok: Object.values(parts).every(Boolean), detail: JSON.stringify(parts) }; })()`,
  },
  ...[['adaptive2', 'Director v2'], ['counter', 'Counter arm'], ['prior', 'Prior control']].map(([mode, title]) => ({
    name: `${mode} research arm page`, path: `/?seed=1&play=1&waves=15&mode=${mode}`, wait: 2500, shot: `smoke-${mode}.png`,
    expr: `(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const hud = document.querySelector('.hud');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', code: 'KeyI' }));
      await sleep(500);
      const ov = document.querySelector('[data-director-overlay]');
      const parts = {
        canvas: !!document.querySelector('canvas#game'), hud015: !!hud && hud.textContent.includes('0 / 15'), waveControl: !!document.querySelector('.wave-control'),
        overlayShown: !!ov && !ov.hidden, overlayTitle: ov ? ov.querySelector('.dov-title').textContent : null,
      };
      return { ok: parts.canvas && parts.hud015 && parts.waveControl && parts.overlayShown && parts.overlayTitle === ${JSON.stringify(title)}, detail: JSON.stringify(parts) };
    })()`,
  })),
  {
    name: 'director overlay (adaptive)', path: '/?seed=1&play=1&waves=15&mode=adaptive', wait: 2500, shot: 'smoke-overlay.png',
    expr: `(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const press = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', code: 'KeyI' }));
      const ov = () => document.querySelector('[data-director-overlay]');
      const visible = () => { const o = ov(); return !!o && !o.hidden && o.getAttribute('aria-label') === 'Director insights'; };
      press(); await sleep(500);
      const shown = visible();
      const rows = document.querySelectorAll('.dov-row').length;
      press(); await sleep(300);
      const hiddenAgain = !visible();
      const parts = { shown, rows, hiddenAgain, hudButton: !!document.querySelector('button[aria-label="Director overlay (I)"]'), noDebugHandle: window.__siege === undefined };
      return { ok: shown && rows === 5 && hiddenAgain && parts.hudButton && parts.noDebugHandle, detail: JSON.stringify(parts) };
    })()`,
  },
  {
    name: 'debug handle (adaptive, debug)', path: '/?debug=1&seed=1&play=1&waves=15&mode=adaptive', wait: 2500, shot: 'smoke-debug-handle.png',
    expr: `(() => { const s = window.__siege; const parts = { exists: !!s, hasGame: !!s?.game, step: typeof s?.step, startWave: typeof s?.startWave, telemetry: typeof s?.telemetry?.getRun }; return { ok: !!s && parts.step === 'function' && parts.startWave === 'function' && parts.telemetry === 'function', detail: JSON.stringify(parts) }; })()`,
  },
  {
    name: 'static mode has no director button', path: '/?seed=1&play=1&waves=15&mode=static', wait: 2500, shot: 'smoke-static-nodirector.png',
    expr: `(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', code: 'KeyI' })); await sleep(400);
      const toast = [...document.querySelectorAll('.toast')].map((t) => t.textContent).join('|');
      const parts = { noButton: !document.querySelector('button[aria-label="Director overlay (I)"]'), toast, noOverlay: !document.querySelector('[data-director-overlay]:not([hidden])') };
      return { ok: parts.noButton && toast.includes('The Director overlay is available in Adaptive mode') && parts.noOverlay, detail: JSON.stringify(parts) };
    })()`,
  },
  {
    name: 'mute key (M) toggles sound with toasts', path: '/?seed=1&play=1&waves=15&mode=static', wait: 2500, shot: 'smoke-mute.png',
    expr: `(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const press = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM' }));
      const toasts = () => [...document.querySelectorAll('.toast')].map((t) => t.textContent);
      press(); await sleep(300);
      const off = toasts().includes('Sound off');
      press(); await sleep(300);
      const on = toasts().includes('Sound on');
      return { ok: off && on, detail: JSON.stringify({ off, on }) };
    })()`,
  },
  {
    name: 'sound lab: every sound passes the offline analysis', path: '/gallery.html#audio', wait: 2500, shot: 'smoke-sound-lab.png',
    expr: `(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const section = document.getElementById('audio');
      const count = Number(section.dataset.soundCount);
      [...section.querySelectorAll('button')].find((b) => b.textContent === 'Analyze all').click();
      for (let i = 0; i < 100 && !/sounds OK/.test(section.querySelector('[data-id="audio-summary"]').textContent); i++) await sleep(200);
      const summary = section.querySelector('[data-id="audio-summary"]').textContent;
      const rows = [...section.querySelectorAll('tbody tr')];
      const bad = rows.filter((r) => r.dataset.verdict !== 'OK').map((r) => r.dataset.id + ': ' + r.lastChild.textContent);
      const m = /^(\\d+) of (\\d+) sounds OK$/.exec(summary);
      const parts = { summary, rows: rows.length, count, bad };
      return { ok: !!m && Number(m[1]) === count && Number(m[2]) === count && rows.length === count && bad.length === 0, detail: JSON.stringify(parts) };
    })()`,
  },
  {
    name: 'gallery', path: '/gallery.html', wait: 3000, shot: 'smoke-gallery.png',
    expr: `(() => { const missing = ${JSON.stringify(GALLERY_SECTIONS)}.filter((id) => !document.getElementById(id)?.querySelector('h2')); const heading = document.querySelector('#director h2')?.textContent; return { ok: missing.length === 0 && heading === '7 Director', detail: missing.length ? 'missing sections: ' + missing.join(', ') : 'all sections present' }; })()`,
  },
  {
    name: 'stress mode (40 towers)', path: '/?debug=1&stress=1&spawn=0&seed=1', wait: 3500, shot: 'smoke-stress.png',
    // the debug panel only updates while visible, so toggle it with the backquote key first
    expr: `(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote', key: '\`' })); await new Promise((r) => setTimeout(r, 800)); const m = /towers (\\d+)/.exec(document.querySelector('.debug-panel')?.textContent ?? ''); const n = m ? Number(m[1]) : -1; return { ok: n === 40, detail: 'towers ' + n }; })()`,
  },
];

async function main() {
  const server = await startLocalServer();
  let failed = 0;
  try {
    for (const c of CHECKS) {
      let line;
      try {
        const r = await inspectPage({ url: server.base + c.path, wait: c.wait, width: 1280, height: 720, timeout: 30000, evalExpr: c.expr, shot: c.shot });
        const v = r.evalResult ?? { ok: false, detail: `eval failed: ${r.evalError}` };
        const problems = [...r.consoleErrors.map((x) => `console error: ${x}`), ...r.exceptions.map((x) => `exception: ${x}`), ...r.failedRequests.map((x) => `request: ${x}`)];
        const pass = v.ok && isClean(r);
        if (!pass) failed++;
        line = `${pass ? 'PASS' : 'FAIL'}  ${c.name}  (${v.detail})${problems.length ? `\n      ${problems.join('\n      ')}` : ''}${r.shotFile ? `\n      screenshot: ${r.shotFile}` : ''}`;
      } catch (e) {
        if (e.exitCode === 2) { console.error(e.message); return 2; }
        failed++;
        line = `FAIL  ${c.name}  (${e.message})`;
      }
      console.log(line);
    }
  } finally {
    server.close();
  }
  console.log(failed === 0 ? `all ${CHECKS.length} checks passed` : `${failed} of ${CHECKS.length} checks failed`);
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then((code) => process.exit(code));
