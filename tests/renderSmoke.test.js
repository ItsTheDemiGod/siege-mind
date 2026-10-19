// Browser-free smoke test of the whole renderer on a stub canvas: core states, the destroyed and victory sequences,
// every quality tier, reduced motion on and off. Catches exceptions and runaway particle counts without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mk = () => new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => ({ addColorStop() {} }) : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.OffscreenCanvas = class { constructor(w, h) { this.width = w; this.height = h; } getContext() { return mk(); } };
globalThis.Path2D = class { moveTo() {} lineTo() {} arc() {} closePath() {} addPath() {} };
globalThis.document = { fonts: { ready: Promise.resolve() } };

const { createGame, stepGame } = await import('../src/sim/game.js');
const { createRenderer } = await import('../src/render/renderer.js');
const { createSettings } = await import('../src/ui/settings.js');
const { createQualityController } = await import('../src/render/quality.js');
const { createBuildState } = await import('../src/ui/buildState.js');
const { endGame, startNextWave, canStartWave } = await import('../src/sim/waveRunner.js');
const { EVENT_TYPES } = await import('../src/sim/events.js');
const { applyStress } = await import('../src/ui/stress.js');
const { config } = await import('../src/data/config.js');

const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) };

function setLives(game, lives) {
  const delta = lives - game.lives;
  game.lives = lives;
  game.events.emit(EVENT_TYPES.LIVES_CHANGED, { lives, delta, tick: game.tick });
}

function scenario(tier, reduced, ending) {
  const game = createGame({ seed: 3, debugSpawnEveryTicks: 4, startGold: 1e6 });
  applyStress(game, 20);
  const settings = createSettings({ prefersReducedMotion: reduced });
  const quality = createQualityController({ tier, auto: false });
  const renderer = createRenderer({ canvas, ctx: mk(), game, settings, quality, seed: 3, buildState: createBuildState() });
  const cap = config.quality[tier].particleCap;
  let maxParticles = 0;
  for (let i = 0; i < 600; i++) {
    if (i === 100) setLives(game, 12); // damaged
    if (i === 200) setLives(game, 4); // critical
    if (i === 300) {
      if (ending === 'lost') { setLives(game, 0); endGame(game, 'lost'); } else endGame(game, 'won');
    }
    stepGame(game);
    renderer.draw(game, game.over ? 0 : (i % 4) / 4, 1 / 60, i / 60, false);
    maxParticles = Math.max(maxParticles, renderer.stats.particles);
  }
  return { maxParticles, cap, game };
}

for (const tier of ['low', 'medium', 'high']) {
  for (const reduced of [false, true]) {
    for (const ending of ['lost', 'won']) {
      test(`renderer survives all core states and the ${ending} sequence (${tier}, reduced motion ${reduced})`, () => {
        const { maxParticles, cap, game } = scenario(tier, reduced, ending);
        assert.ok(maxParticles <= cap, `particles ${maxParticles} > cap ${cap}`);
        assert.equal(game.result, ending);
      });
    }
  }
}

test('a real wave with leaks drives the core through damaged and critical without errors', () => {
  const game = createGame({ seed: 5, debugSpawnEveryTicks: 0 });
  const renderer = createRenderer({ canvas, ctx: mk(), game, settings: createSettings(), quality: createQualityController({ tier: 'high' }), seed: 5, buildState: createBuildState() });
  for (let i = 0; i < 60000 && !game.over; i++) { if (canStartWave(game)) startNextWave(game); stepGame(game); renderer.draw(game, 0, 1 / 60, i / 60, false); }
  for (let i = 0; i < 200; i++) renderer.draw(game, 0, 1 / 60, 100 + i / 60, false); // keeps animating after the game ends
  assert.equal(game.lives, 0);
});
