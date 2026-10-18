// Bootstrap: wires sim + render + ui. No game logic here.
import { config } from './data/config.js';
import { createGame, startGame, stepGame } from './sim/game.js';
import { createStepper } from './sim/stepper.js';
import { computeFit, applyFit } from './render/fit.js';
import { drawDebugScene } from './render/debugRenderer.js';
import { bindKeys } from './ui/keys.js';

const { width, height, maxDpr } = config.view;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ?seed= may be an integer or any string; otherwise a random 32-bit seed.
const param = new URLSearchParams(location.search).get('seed');
const seed = param === null ? crypto.getRandomValues(new Uint32Array(1))[0]
  : /^-?\d+$/.test(param) ? Number(param) : param;

const game = createGame({ seed });
startGame(game);
const stepper = createStepper();

// One mutable stats object, reused every frame.
const stats = {
  paused: false, showHud: config.debug.showHud, speed: 1, steps: 0,
  fps: 0, frameMs: 0, ticksPerSecond: 0, dpr: 1, backingWidth: 0, backingHeight: 0,
};

function fit() {
  const f = computeFit(window.innerWidth, window.innerHeight, width, height, window.devicePixelRatio, maxDpr);
  applyFit(canvas, ctx, f, width, height);
  stats.dpr = f.dpr;
  stats.backingWidth = f.backingWidth;
  stats.backingHeight = f.backingHeight;
}
fit();
window.addEventListener('resize', fit);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stats.paused = true; // never auto-resume
});

bindKeys({
  togglePause: () => { stats.paused = !stats.paused; },
  setSpeed: (n) => { stats.speed = n; },
  singleStep: () => { if (stats.paused) stepper.requestSingleStep(); },
  toggleHud: () => { stats.showHud = !stats.showHud; },
});

let last = null;
let tickWindowStart = 0;
let tickWindowCount = 0;

function frame(now) {
  const dt = last === null ? 0 : (now - last) / 1000;
  stats.frameMs = last === null ? 0 : now - last;
  last = now;
  if (dt > 0) stats.fps = stats.fps === 0 ? 1 / dt : stats.fps * 0.9 + (1 / dt) * 0.1;

  const steps = stepper.advance(dt, stats.speed, stats.paused);
  for (let i = 0; i < steps; i++) stepGame(game);
  stats.steps = steps;

  tickWindowCount += steps;
  if (now - tickWindowStart >= 1000) {
    stats.ticksPerSecond = (tickWindowCount * 1000) / (now - tickWindowStart);
    tickWindowStart = now;
    tickWindowCount = 0;
  }

  drawDebugScene(ctx, game, stepper.alpha, stats);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
console.log(`Siege Mind boot OK (seed ${seed})`);
