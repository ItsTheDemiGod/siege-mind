import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, endScreenRows } from '../src/ui/format.js';

const STEP = 1 / 60;

test('formatDuration boundaries', () => {
  assert.equal(formatDuration(0, STEP), '0:00');
  assert.equal(formatDuration(59, STEP), '0:00'); // rounds down
  assert.equal(formatDuration(60, STEP), '0:01');
  assert.equal(formatDuration(3600, STEP), '1:00'); // exactly 60 s
  assert.equal(formatDuration(3725, STEP), '1:02');
  assert.equal(formatDuration(3599, STEP), '0:59');
  assert.equal(formatDuration(60 * 60 * 10, STEP), '10:00');
});

test('endScreenRows for a hand-built game', () => {
  const game = {
    result: 'won', lives: 7, tick: 3725,
    stats: { wavesCleared: 30, kills: 412, leaks: 13, goldFromKills: 5000, goldFromBonus: 700, towersBuilt: 31 },
  };
  assert.deepEqual(endScreenRows(game), [
    { label: 'Result', value: 'Victory' },
    { label: 'Waves cleared', value: '30 of 30' },
    { label: 'Lives left', value: '7' },
    { label: 'Enemies defeated', value: '412' },
    { label: 'Enemies leaked', value: '13' },
    { label: 'Gold earned', value: '5700' },
    { label: 'Towers built', value: '31' },
    { label: 'Time', value: '1:02' },
  ]);
  const lost = endScreenRows({ ...game, result: 'lost', lives: 0, stats: { ...game.stats, wavesCleared: 12 } });
  assert.equal(lost[0].value, 'Defeat');
  assert.equal(lost[1].value, '12 of 30');
  assert.equal(lost[2].value, '0');
});
