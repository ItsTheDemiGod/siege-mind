import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playGame } from '../experiments/playthrough.js';
import { getBot } from '../experiments/bots.js';
import { validateRun } from '../src/sim/telemetrySchema.js';

const play = (telemetry) => playGame({ seed: 1, totalWaves: 15, bot: getBot('balanced'), telemetry, meta: { bot: 'balanced' } });
const outcome = (r) => ({ result: r.result, wave: r.wave, lives: r.lives, ticks: r.ticks });

test('telemetry does not change the playthrough result', () => {
  const off = play(false);
  const full = play('full');
  const summary = play('summary');
  assert.deepEqual(outcome(full), outcome(off));
  assert.deepEqual(outcome(summary), outcome(off));
  assert.equal(off.run, undefined);
  assert.deepEqual(validateRun(full.run), []);
  assert.deepEqual(validateRun(summary.run), []);
  assert.equal('enemies' in summary.run, false);
  assert.equal(full.run.meta.bot, 'balanced');
});
