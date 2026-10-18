// Style gallery page: permanent visual QA using the same modules and style.css as the game.
import { config } from './data/config.js';
import { THEME } from './render/theme.js';
import { createGame, stepGame } from './sim/game.js';
import { createStepper } from './sim/stepper.js';
import { createRng } from './sim/rng.js';
import { computeFit, applyFit } from './render/fit.js';
import { createRenderer } from './render/renderer.js';
import { createQualityController } from './render/quality.js';
import { createFrameStats } from './render/perf.js';
import { createSettings } from './ui/settings.js';
import { h } from './ui/dom.js';
import { enemyStatesSection, fxEventButtons } from './galleryEnemies.js';
import { towersSection } from './galleryTowers.js';
import {
  paletteSection, typographySection, enemiesSection, iconsSection, uiSection, colorblindSection,
} from './galleryStatic.js';

const SECTIONS = [
  ['palette', '1 Palette'], ['type', '2 Typography'], ['enemies', '3 Enemies'], ['states', '3b Enemy states'], ['towers', '3c Towers'], ['icons', '4 Icons'], ['fx', '5 Effects'],
  ['ui', '6 UI'], ['map', '7 Map'], ['cvd', '8 Colorblind'], ['quality', '9 Quality'],
];
const seed = 'gallery';
const content = document.getElementById('g-content');
const nav = document.getElementById('g-nav');
const els = {};
for (const [id, label] of SECTIONS) {
  els[id] = h('section', { id, class: 'g-section' }, [h('h2', { text: label.replace(/^S+s/, '') })]);
  content.append(els[id]);
  nav.append(h('a', { href: `#${id}`, text: label }));
}

const settings = createSettings({ storage: null });
settings.set('damageNumbers', true); // so the damage-number button is visible in the lab
const quality = createQualityController({ tier: 'high', auto: false });
const visible = new Map();
const observer = new IntersectionObserver((entries) => { for (const e of entries) visible.set(e.target, e.isIntersecting); });
const isVisible = (el) => () => visible.get(el) ?? true;

/** A full renderer on its own 1280x720 canvas, scaled to its container. */
function makeStage(host, { spawnEvery, startGold }) {
  const canvas = h('canvas', { width: 1280, height: 720, 'aria-label': 'Live game stage' });
  const stage = h('div', { class: 'g-stage' }, [canvas]);
  host.append(stage);
  observer.observe(stage);
  const ctx = canvas.getContext('2d');
  const game = createGame({ seed, debugSpawnEveryTicks: spawnEvery, startGold });
  const renderer = createRenderer({ canvas, ctx, game, settings, quality, seed });
  const stepper = createStepper();
  const frames = createFrameStats();
  const refit = () => {
    const w = Math.min(host.clientWidth || 960, 960);
    const f = computeFit(w, w * 9 / 16, 1280, 720, window.devicePixelRatio || 1, quality.params.maxDpr, config.view.maxBackingPixels);
    applyFit(canvas, ctx, f, 1280, 720);
    renderer.resize(f);
  };
  refit();
  window.addEventListener('resize', refit);
  let last = null;
  let clock = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!(visible.get(stage) ?? true)) { last = null; return; }
    const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.25);
    last = now;
    if (dt > 0) frames.push(dt * 1000);
    const steps = stepper.advance(dt, 1, false);
    for (let i = 0; i < steps; i++) stepGame(game);
    clock += dt;
    renderer.draw(game, stepper.alpha, dt, clock, false);
  };
  renderer.ready.then(() => requestAnimationFrame(loop));
  canvas.addEventListener('pointerdown', (e) => renderer.handleClick(e.clientX, e.clientY));
  return { renderer, frames, refit, game };
}

paletteSection(els.palette);
typographySection(els.type);
const enemiesHost = h('div');
els.enemies.append(enemiesHost);
enemiesSection(enemiesHost, isVisible(els.enemies));
const statesHost = h('div');
els.states.append(statesHost);
enemyStatesSection(statesHost, isVisible(els.states));
iconsSection(els.icons);
uiSection(els.ui);

// 5. Effects lab (auto-spawner off)
const lab = makeStage(els.fx, { spawnEvery: 0 });
const rng = createRng('gallery-ui');
const at = () => ({ x: rng.range(200, 1080), y: rng.range(100, 520) });
const effects = [
  ['Spark burst', () => { const p = at(); lab.renderer.fx.burst(p.x, p.y, { count: 28, speed: 220 }); }],
  ['Shockwave ring', () => { const p = at(); lab.renderer.fx.ring(p.x, p.y, { size1: 90 }); }],
  ['Floating +25', () => { const p = at(); lab.renderer.fx.floatText('+25', p.x, p.y, { color: THEME.colors.tertiary }); }],
  ['Screen shake', () => lab.renderer.fx.shake.add(0.7)],
  ['Leak flash', () => { lab.renderer.fx.flash(THEME.colors.danger, 1); lab.renderer.fx.shake.add(0.4); }],
  ['Director scan', () => lab.renderer.fx.directorScan()],
];
const report = h('span', { class: 'mono note', text: '' });
const stress = () => {
  report.textContent = 'running 2 s…';
  const start = performance.now();
  const sample = createFrameStats();
  let prev = start;
  const tick = (now) => {
    sample.push(now - prev);
    prev = now;
    for (let i = 0; i < 6; i++) { const p = at(); lab.renderer.fx.burst(p.x, p.y, { count: 120, speed: 260, life: 1.2 }); }
    if (now - start < 2000) requestAnimationFrame(tick);
    else {
      sample.refresh();
      report.textContent = `avg ${sample.fps.toFixed(0)} FPS, p95 ${sample.p95Ms.toFixed(1)} ms, max ${sample.maxMs.toFixed(1)} ms, particles ${lab.renderer.stats.particles}/${lab.renderer.stats.particleLimit}`;
    }
  };
  requestAnimationFrame(tick);
};
els.fx.append(h('div', { class: 'g-row' }, [
  ...effects.map(([label, fn]) => h('button', { type: 'button', class: 'btn', text: label, onclick: fn })),
  h('button', { type: 'button', class: 'btn btn--primary', text: 'Stress: fill the particle pool', onclick: stress }),
  report,
]));
fxEventButtons(els.fx, lab.game, rng);
els.fx.append(h('p', { class: 'note', text: 'Click the stage to spawn a test effect at that spot.' }));

// 3c. Towers: a real game stage with 15 towers and a steady stream of enemies
const TOWER_STAGE_SPAWN_TICKS = 30;
const TOWER_STAGE_GOLD = 1e6;
const towersStage = makeStage(els.towers, { spawnEvery: TOWER_STAGE_SPAWN_TICKS, startGold: TOWER_STAGE_GOLD });
towersSection(els.towers, towersStage.game);

// 7. Map preview with live enemies
const preview = makeStage(els.map, { spawnEvery: 45 });

// 8. Colorblind filters over the whole page content
colorblindSection(els.cvd, content);

// 9. Quality tiers
const tierRow = h('div', { class: 'g-row', role: 'radiogroup', 'aria-label': 'Quality tier' });
for (const tier of ['low', 'medium', 'high']) {
  const input = h('input', { type: 'radio', name: 'tier', value: tier });
  if (tier === 'high') input.checked = true;
  input.addEventListener('change', () => {
    quality.setTier(tier);
    for (const s of [lab, preview, towersStage]) { s.refit(); s.renderer.onQualityChange(); }
  });
  tierRow.append(h('label', {}, [input, ` ${tier}`]));
}
const fpsReadout = h('div', { class: 'mono', text: 'FPS: …' });
els.quality.append(tierRow, fpsReadout, h('table', { class: 'g-table' }, [
  h('thead', {}, [h('tr', {}, ['Tier', 'Particles', 'Float texts', 'Motes', 'Max DPR', 'Pulse spacing', 'Glow'].map((t) => h('th', { text: t })))]),
  h('tbody', {}, Object.values(config.quality).map((q) => h('tr', {}, [q.name, q.particleCap, q.floatTextCap, q.ambientMotes, q.maxDpr, q.pathPulseSpacing, q.glow]
    .map((v) => h('td', { class: 'mono', text: String(v) }))))),
]));
setInterval(() => {
  fpsReadout.textContent = `Map preview: ${preview.frames.fps.toFixed(0)} FPS (avg ${preview.frames.avgMs.toFixed(1)} ms, particles ${preview.renderer.stats.particles}/${preview.renderer.stats.particleLimit}, tier ${quality.tier})`;
}, 500);
console.log('Siege Mind gallery OK');
