// The README screenshots: pure helpers (PNG header reading, size and byte-range validation) and the shot list with the in-page preparation of each one.
// The browser part is in shots.js. Every prepare expression polls for a readiness condition and returns {ok, detail}.

export const SHOT_WIDTH = 1280;
export const SHOT_HEIGHT = 720;
export const SHOT_MIN_BYTES = 20000;
export const SHOT_MAX_BYTES = 700000;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** @param {Uint8Array} buffer @returns {{width: number, height: number}} read from the IHDR chunk @throws {Error} when the data is not a PNG */
export function pngSize(buffer) {
  if (buffer.length < 24 || PNG_SIGNATURE.some((b, i) => buffer[i] !== b)) throw new Error('not a PNG file');
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(12) !== 0x49484452) throw new Error('PNG without an IHDR chunk first'); // 'IHDR'
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * @param {Uint8Array} buffer @param {{width: number, height: number, minBytes?: number, maxBytes?: number}} want
 * @returns {string[]} problems; empty when the shot is acceptable
 */
export function validateShot(buffer, { width, height, minBytes = SHOT_MIN_BYTES, maxBytes = SHOT_MAX_BYTES }) {
  let size;
  try { size = pngSize(buffer); } catch (e) { return [e.message]; }
  const problems = [];
  if (size.width !== width || size.height !== height) problems.push(`size ${size.width}x${size.height}, expected ${width}x${height}`);
  if (buffer.length < minBytes) problems.push(`only ${buffer.length} bytes (minimum ${minBytes}): the page is probably blank`);
  if (buffer.length > maxBytes) problems.push(`${buffer.length} bytes (maximum ${maxBytes})`);
  return problems;
}

// ---- in-page helpers shared by the prepare expressions ----------------------------------------------------------------------------------------------------------------

const POLL = `
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await sleep(100); } return false; };
const key = (k, code) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code, bubbles: true }));
// a sensible defence placed through the same sim commands the build tray uses (the module instance is the game's own)
const DEFENCE = [['lance', 4, 2], ['frost', 7, 3], ['mortar', 10, 3], ['poison', 13, 2], ['lance', 15, 3], ['lance', 5, 0], ['sniper', 12, 0], ['mortar', 8, 5], ['frost', 13, 6],
  ['poison', 4, 5], ['lance', 9, 6], ['sniper', 14, 5], ['lance', 16, 6], ['mortar', 10, 8], ['frost', 6, 8], ['lance', 3, 2]];
const build = async (s) => { const m = await import('/src/sim/towers.js'); let n = 0; for (const [t, c, r] of DEFENCE) if (m.placeTower(s.game, t, c, r).ok) n++; return n; };
const idle = (s) => s.game.waves.phase === 'prep' || s.game.waves.phase === 'intermission';
// play a debug game: start waves and fast-forward until stop(s) is true or the game ends
const play = (s, stop) => { for (let guard = 0; guard < 6000 && !s.game.over && !stop(s); guard++) { if (idle(s)) s.startWave(); s.step(60); } }; // small chunks: the intermission countdown stays nearly full when play stops
`;

const scrollTo = (id) => `(async () => { ${POLL} const el = document.getElementById(${JSON.stringify(id)}); if (!el) return { ok: false, detail: 'no section ${id}' }; el.scrollIntoView(); await sleep(1800); return { ok: true, detail: 'section ${id}' }; })()`;

/** @type {readonly {name: string, url: string, prepare: string, quality?: 'low'|'medium'|'high'}[]} */
export const SHOTS = Object.freeze([
  {
    name: '01-menu', url: '/',
    prepare: `(async () => { ${POLL} const ok = await until(() => document.querySelector('[role="dialog"]')?.textContent.includes('SIEGE MIND')); await sleep(800); return { ok, detail: 'main menu' }; })()`,
  },
  {
    name: '02-gameplay', url: '/?debug=1&gold=2600&seed=1&play=1&waves=15&mode=adaptive',
    prepare: `(async () => { ${POLL} const s = window.__siege; const n = await build(s); play(s, (x) => x.game.waves.phase === 'running' && x.game.waves.nextWave >= 6 && x.game.enemies.length >= 14);
      await sleep(3500); /* let the wave banner fade */ return { ok: n >= 12 && !s.game.over && s.game.enemies.length >= 8, detail: 'towers ' + n + ', enemies ' + s.game.enemies.length + ', wave ' + (s.game.waves.nextWave - 1) }; })()`,
  },
  {
    name: '03-director-overlay', url: '/?debug=1&gold=4000&seed=1&play=1&waves=15&mode=adaptive',
    prepare: `(async () => { ${POLL} const s = window.__siege; await build(s); play(s, (x) => idle(x) && x.game.waves.nextWave >= 9); await sleep(3500); key('i', 'KeyI'); // after the banner has faded
      const ok = await until(() => { const o = document.querySelector('[data-director-overlay]'); return !!o && !o.hidden; }); await sleep(1200);
      return { ok: ok && !s.game.over, detail: 'next wave ' + s.game.waves.nextWave + ', rows ' + document.querySelectorAll('.dov-row').length }; })()`,
  },
  {
    name: '04-defeat', url: '/?debug=1&startlives=1&seed=1&play=1&waves=15',
    prepare: `(async () => { ${POLL} const s = window.__siege; key('Enter', 'Enter'); await sleep(300); s.step(6000);
      const ok = await until(() => !!document.querySelector('.end-card'), 30000); await sleep(1800); return { ok: ok && s.game.result === 'lost', detail: 'result ' + s.game.result }; })()`,
  },
  {
    name: '05-director-report', url: '/?debug=1&gold=4000&seed=1&play=1&waves=15&mode=adaptive',
    prepare: `(async () => { ${POLL} const s = window.__siege; await build(s); play(s, () => false);
      if (!(await until(() => !!document.querySelector('.end-card'), 30000))) return { ok: false, detail: 'no end card' };
      const b = [...document.querySelectorAll('.end-card button')].find((x) => x.textContent === "Director's Report"); if (!b) return { ok: false, detail: 'no report button' };
      b.click(); const ok = await until(() => !!document.querySelector('.report-card')); await sleep(1500); return { ok, detail: 'result ' + s.game.result }; })()`,
  },
  { name: '06-gallery-towers', url: '/gallery.html', prepare: scrollTo('towers') },
  {
    name: '07-gallery-core-screens', url: '/gallery.html',
    prepare: `(async () => { ${POLL} const sec = document.getElementById('screens'); sec.scrollIntoView(); await sleep(800);
      const b = [...sec.querySelectorAll('button')].find((x) => x.textContent.startsWith('Set piece')); if (!b) return { ok: false, detail: 'no set-piece banner button' };
      b.click(); await sleep(1200); return { ok: true, detail: 'banner demo triggered' }; })()`,
  },
  {
    name: '08-sound-lab', url: '/gallery.html',
    prepare: `(async () => { ${POLL} const sec = document.getElementById('audio'); sec.scrollIntoView(); await sleep(800);
      [...sec.querySelectorAll('button')].find((b) => b.textContent === 'Analyze all').click();
      const ok = await until(() => /sounds OK/.test(sec.querySelector('[data-id="audio-summary"]').textContent), 30000);
      sec.querySelector('[data-id="audio-summary"]').scrollIntoView(); window.scrollBy(0, -24); await sleep(800); return { ok, detail: sec.querySelector('[data-id="audio-summary"]').textContent }; })()`,
  },
  { name: '09-figure-attribution', url: '/docs/results/figures-final/index.html', prepare: `(async () => { ${POLL} const f = document.querySelectorAll('figure')[1]; if (!f) return { ok: false, detail: 'no figure' }; f.scrollIntoView(); await sleep(500); return { ok: true, detail: f.querySelector('title')?.textContent }; })()` },
  { name: '10-figure-replication', url: '/docs/results/figures-final/index.html', prepare: `(async () => { ${POLL} const f = document.querySelectorAll('figure')[4]; if (!f) return { ok: false, detail: 'no figure' }; f.scrollIntoView(); await sleep(500); return { ok: true, detail: f.querySelector('title')?.textContent }; })()` },
]);
