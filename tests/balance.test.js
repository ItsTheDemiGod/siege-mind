// Difficulty calibration targets (Phase 4A). The only knob used to meet them is config.waves.budgetScale (see the Decisions Log).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playGame } from '../experiments/playthrough.js';
import { createBot } from '../experiments/bots.js';

test('T1: a player who never builds loses at or before wave 5', () => {
  const r = playGame({ seed: 1, bot: createBot('none') });
  assert.equal(r.result, 'lost');
  assert.ok(r.wave <= 5, `lost at wave ${r.wave}`);
});

test('T2: the balanced bot wins with between 1 and 14 lives remaining', () => {
  const t0 = Date.now();
  const r = playGame({ seed: 1, bot: createBot('balanced') });
  console.log(`# balanced playthrough: ${r.result}, wave ${r.wave}, lives ${r.lives}, ${Date.now() - t0} ms`);
  assert.equal(r.result, 'won');
  assert.equal(r.wave, 30);
  assert.ok(r.lives >= 1 && r.lives <= 14, `lives left ${r.lives}`);
  assert.equal(r.stats.wavesCleared, 30);
});

test('the playthrough is deterministic', () => {
  const a = playGame({ seed: 3, bot: createBot('balanced') });
  const b = playGame({ seed: 3, bot: createBot('balanced') });
  assert.deepEqual(a, b);
});
