// Guard for the bots' baseline strength (static mode, the calibration seeds). If the sim's balance changes, this test will fail:
// recalibrate with `npm run calibrate`, put the chosen knobs into experiments/protocol.js and re-run the experiments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL, seedsOf } from '../experiments/protocol.js';
import { CONSTRAINTS } from '../experiments/calibrate.js';
import { playGame } from '../experiments/playthrough.js';
import { createStyleBot } from '../experiments/styleBots.js';

test('the committed knobs keep every style in the calibrated static win-rate window', () => {
  const rates = {};
  for (const style of PROTOCOL.styles) {
    const wins = seedsOf('calibration').map((seed) => playGame({ seed, bot: createStyleBot(style), mode: 'static', totalWaves: PROTOCOL.waves }).result === 'won');
    rates[style] = wins.filter(Boolean).length / wins.length;
  }
  const mean = Object.values(rates).reduce((a, b) => a + b, 0) / PROTOCOL.styles.length;
  assert.ok(mean >= CONSTRAINTS.meanMin && mean <= CONSTRAINTS.meanMax, `mean static win rate ${mean} outside [${CONSTRAINTS.meanMin}, ${CONSTRAINTS.meanMax}] (${JSON.stringify(rates)})`);
  for (const [style, rate] of Object.entries(rates)) assert.ok(rate >= CONSTRAINTS.perStyleMin, `${style} wins only ${rate} of the calibration seeds`);
});
