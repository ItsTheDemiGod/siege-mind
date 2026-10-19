// CLI: node tools/browser-check/smoke.js. Loads the main pages in a headless Chrome and checks that they came up. Exit 0 = all pass, 1 = a check failed, 2 = no browser.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { inspectPage, isClean } from './page.js';
import { startLocalServer } from './check.js';

const GALLERY_SECTIONS = ['palette', 'type', 'enemies', 'states', 'towers', 'icons', 'screens', 'fx', 'ui', 'map', 'cvd', 'quality'];

// Each expression returns {ok, detail}; they run inside the page.
const CHECKS = [
  {
    name: 'main menu', path: '/', wait: 2500, shot: 'smoke-menu.png',
    expr: `(() => { const d = document.querySelector('[role="dialog"]'); return { ok: !!d && d.textContent.includes('SIEGE MIND'), detail: d ? d.textContent.slice(0, 40) : 'no dialog' }; })()`,
  },
  {
    name: 'game page', path: '/?seed=1&play=1&waves=15', wait: 2500, shot: 'smoke-game.png',
    expr: `(() => { const hud = document.querySelector('.hud'); const parts = { canvas: !!document.querySelector('canvas#game'), hud015: !!hud && hud.textContent.includes('0 / 15'), waveControl: !!document.querySelector('.wave-control') }; return { ok: Object.values(parts).every(Boolean), detail: JSON.stringify(parts) }; })()`,
  },
  {
    name: 'gallery', path: '/gallery.html', wait: 3000, shot: 'smoke-gallery.png',
    expr: `(() => { const missing = ${JSON.stringify(GALLERY_SECTIONS)}.filter((id) => !document.getElementById(id)?.querySelector('h2')); return { ok: missing.length === 0, detail: missing.length ? 'missing sections: ' + missing.join(', ') : 'all sections present' }; })()`,
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
