// Bit-for-bit pin of the three existing modes (balanced bot, seed 1, 15 waves), generated from the Phase 9A-1 code BEFORE the 9A-2a arms existed.
// Never regenerate tests/golden/modes-balanced-seed1-w15.json: if this test fails, the change is wrong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EVENT_TYPES } from '../src/sim/events.js';
import { playGame } from '../experiments/playthrough.js';
import { getBot } from '../experiments/bots.js';

const golden = JSON.parse(readFileSync(fileURLToPath(new URL('./golden/modes-balanced-seed1-w15.json', import.meta.url)), 'utf8'));

for (const mode of ['static', 'adaptive', 'random']) {
  test(`golden: ${mode} mode is unchanged (balanced bot, seed 1, 15 waves)`, () => {
    const inner = getBot('balanced');
    const director = [];
    let attached = false;
    const bot = { act(game) { if (!attached) { attached = true; game.events.on(EVENT_TYPES.WAVE_STARTED, (ev) => director.push(ev.director ?? null)); } inner.act(game); } };
    const r = playGame({ seed: 1, bot, totalWaves: 15, mode });
    const result = { result: r.result, wave: r.wave, lives: r.lives, ticks: r.ticks };
    assert.deepEqual(result, golden[mode].result);
    if (mode !== 'static') assert.deepEqual(JSON.parse(JSON.stringify(director)), golden[mode].director);
  });
}
