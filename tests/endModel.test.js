import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEndModel } from '../src/ui/endModel.js';
import { createGame } from '../src/sim/game.js';

const entry = (wave, livesLost, complete = true, name = null) => ({ wave, name, fixed: false, complete, livesLost });

test('a lost game reports the failed wave, the toughest wave and one cell per wave', () => {
  const game = createGame({ seed: 1, totalWaves: 15 });
  game.result = 'lost';
  game.waves.current = 3;
  game.waveLog.push(entry(1, 0), entry(2, 3, true, 'Second'), entry(3, 5, false));
  const m = buildEndModel(game);
  assert.equal(m.victory, false);
  assert.equal(m.title, 'DEFEAT');
  assert.equal(m.cells.length, game.totalWaves);
  assert.deepEqual(m.cells.slice(0, 3).map((c) => c.status), ['clean', 'hurt', 'failed']);
  assert.ok(m.cells.slice(3).every((c) => c.status === 'unreached'));
  assert.match(m.toughest, /wave: 3/);
  assert.match(m.stripLabel, /3 of 15 waves reached/);
});

test('a flawless win says no lives were lost', () => {
  const game = createGame({ seed: 2, totalWaves: 15 });
  game.result = 'won';
  for (let w = 1; w <= game.totalWaves; w++) game.waveLog.push(entry(w, 0));
  const m = buildEndModel(game);
  assert.equal(m.title, 'VICTORY');
  assert.equal(m.toughest, 'No lives lost');
  assert.ok(m.cells.every((c) => c.status === 'clean'));
});
