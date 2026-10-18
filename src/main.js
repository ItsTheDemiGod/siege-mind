// Bootstrap: wires sim + render + ui. No game logic here.
import { config } from './data/config.js';
import { createGame, startGame, stepGame } from './sim/game.js';
import { createStepper } from './sim/stepper.js';
import { computeFit, applyFit } from './render/fit.js';
import { createRenderer } from './render/renderer.js';
import { createQualityController } from './render/quality.js';
import { createRateMeter, createFrameStats } from './render/perf.js';
import { bindKeys } from './ui/keys.js';
import { createSettings } from './ui/settings.js';
import { createHud } from './ui/hud.js';
import { createTooltip } from './ui/tooltip.js';
import { createToaster } from './ui/toast.js';
import { createSettingsPanel } from './ui/settingsPanel.js';
import { createDebugPanel } from './ui/debugPanel.js';

const { width, height } = config.view;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const uiRoot = document.getElementById('ui-root');
const params = new URLSearchParams(location.search);

// ?seed= may be an integer or any string; otherwise a random 32-bit seed. ?spawn=N overrides the debug spawn interval (ticks).
const seedParam = params.get('seed');
const seed = seedParam === null ? crypto.getRandomValues(new Uint32Array(1))[0]
  : /^-?\d+$/.test(seedParam) ? Number(seedParam) : seedParam;
const spawnParam = Number.parseInt(params.get('spawn') ?? '', 10);

let storage = null;
try { storage = window.localStorage; } catch { /* blocked storage: settings stay in memory */ }
const settings = createSettings({ storage, prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
const applyReduced = () => document.documentElement.classList.toggle('reduced-motion', settings.get('reducedMotion'));
applyReduced();

const game = createGame({ seed, debugSpawnEveryTicks: spawnParam > 0 ? spawnParam : undefined });
startGame(game);
const stepper = createStepper();
const quality = createQualityController({ tier: settings.get('quality'), auto: settings.get('autoQuality') });
const renderer = createRenderer({ canvas, ctx, game, settings, quality, seed });

const state = { paused: false, speed: 1, steps: 0 };
const tickMeter = createRateMeter();
const frameStats = createFrameStats();
const toaster = createToaster({ root: uiRoot });
createTooltip({ root: uiRoot });
const debugPanel = createDebugPanel({ root: uiRoot, visible: config.debug.showHud });

const control = {
  togglePause() { control.setPaused(!state.paused); },
  setPaused(p) {
    if (state.paused && !p) { tickMeter.reset(); quality.reset(); } // do not judge or average the paused time
    state.paused = p;
    hud.setPaused(p);
  },
  isPaused: () => state.paused,
  setSpeed(n) { state.speed = n; hud.setSpeed(n); },
};
const panel = createSettingsPanel({ root: uiRoot, settings, game: control });
const hud = createHud({
  root: uiRoot,
  handlers: { togglePause: control.togglePause, setSpeed: control.setSpeed, openSettings: () => panel.open() },
});
hud.set({ gold: config.game.startGold, lives: config.game.startLives, wave: 0, waveTotal: config.game.totalWaves });
hud.setSpeed(state.speed);
hud.setPaused(state.paused);

function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, quality.params.maxDpr, config.view.maxDpr);
  const f = computeFit(window.innerWidth, window.innerHeight, width, height, dpr, config.view.maxDpr, config.view.maxBackingPixels);
  applyFit(canvas, ctx, f, width, height);
  renderer.resize(f);
  fitInfo.dpr = f.dpr;
  fitInfo.w = f.backingWidth;
  fitInfo.h = f.backingHeight;
}
const fitInfo = { dpr: 1, w: 0, h: 0 };
fit();
window.addEventListener('resize', fit);

quality.onChange((tier, reason) => {
  settings.set('quality', tier);
  fit();
  if (reason === 'auto') toaster.show(`Quality lowered to ${tier[0].toUpperCase()}${tier.slice(1)} (low FPS)`);
});
settings.subscribe((key, value) => {
  if (key === 'quality') quality.setTier(value);
  else if (key === 'autoQuality') quality.setAuto(value);
  else if (key === 'reducedMotion') applyReduced();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { control.setPaused(true); last = null; } // never auto-resume
});

bindKeys({
  togglePause: () => { if (!panel.isOpen) control.togglePause(); },
  setSpeed: (n) => { if (!panel.isOpen) control.setSpeed(n); },
  singleStep: () => { if (state.paused && !panel.isOpen) stepper.requestSingleStep(); },
  toggleHud: () => debugPanel.toggle(),
});
canvas.addEventListener('pointerdown', (e) => { renderer.handleClick(e.clientX, e.clientY); });

let last = null;
let animTime = 0;
let panelClock = 0;

function frame(now) {
  const dt = last === null ? 0 : Math.min((now - last) / 1000, config.sim.maxFrameSeconds);
  last = now;
  if (dt > 0) frameStats.push(dt * 1000);

  state.steps = stepper.advance(dt, state.speed, state.paused);
  for (let i = 0; i < state.steps; i++) stepGame(game);
  if (!state.paused) {
    animTime += dt;
    quality.update(dt);
    tickMeter.tick(now / 1000, state.steps); // every frame, so gaps decay the rate
  }

  renderer.draw(game, stepper.alpha, dt, animTime, state.paused);

  panelClock += dt;
  if (panelClock >= 0.25) { // text is rebuilt 4x per second, not per frame
    panelClock = 0;
    const tps = state.paused ? 0 : tickMeter.rate;
    const s = renderer.stats;
    debugPanel.update(
      `FPS ${frameStats.fps.toFixed(0)}  frame avg ${frameStats.avgMs.toFixed(1)} / p95 ${frameStats.p95Ms.toFixed(1)} / max ${frameStats.maxMs.toFixed(1)} ms\n`
      + `ticks/s ${tps.toFixed(0)}  sim speed ${(tps * config.sim.stepSeconds).toFixed(2)}x  tick ${game.tick}  time ${game.time.toFixed(1)}s\n`
      + `speed x${state.speed}  paused ${state.paused}  quality ${quality.tier}  particles ${s.particles}/${s.particleLimit}\n`
      + `backing ${fitInfo.w}x${fitInfo.h}  DPR ${fitInfo.dpr.toFixed(2)}  seed ${game.seed}  walkers ${game.walkers.length}`);
  }
  requestAnimationFrame(frame);
}

renderer.ready.then(() => requestAnimationFrame(frame));
console.log(`Siege Mind boot OK (seed ${seed})`);
