import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, snapshotGame } from '../src/sim/game.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { createBot, getBot, BOT_NAMES, BOTS } from '../experiments/bots.js';

const MONO = { weak: 'lance', monoMortar: 'mortar', monoSniper: 'sniper' };
const ACT_EVERY_TICKS = 120;

function play(name, mode = 'static', seed = 1) {
  const game = createGame({ seed, debugSpawnEveryTicks: 0, totalWaves: 15, mode });
  const bot = createBot(name); // a fresh bot per game
  const log = { placed: [], upgraded: 0, gold: 0, towersMax: 0 };
  game.events.on(EVENT_TYPES.TOWER_PLACED, (ev) => log.placed.push(ev.type));
  game.events.on(EVENT_TYPES.TOWER_UPGRADED, () => { log.upgraded++; });
  game.events.on(EVENT_TYPES.GOLD_CHANGED, (ev) => { log.gold += ev.delta; });
  const startGold = game.gold;
  while (!game.over && game.tick < 600000) {
    const phase = game.waves.phase;
    if (phase === 'prep' || phase === 'intermission' || game.tick % ACT_EVERY_TICKS === 0) bot.act(game);
    log.towersMax = Math.max(log.towersMax, game.towers.length);
    stepGame(game);
  }
  return { game, log, startGold };
}

test('the ladder lists every bot and getBot rejects unknown names', () => {
  assert.deepEqual(BOT_NAMES, ['none', 'weak', 'monoMortar', 'monoSniper', 'balanced']);
  assert.deepEqual(Object.keys(BOTS), BOT_NAMES);
  for (const n of BOT_NAMES) assert.equal(getBot(n).name, n);
  assert.throws(() => getBot('nope'), /unknown bot/);
  assert.throws(() => createBot('nope'), /unknown bot/);
});

test('bots are deterministic', () => {
  for (const name of BOT_NAMES) {
    const a = snapshotGame(play(name).game);
    const b = snapshotGame(play(name).game);
    assert.deepEqual(a, b, name);
  }
});

test('bots act only through sim commands: gold and towers reconcile with the events', () => {
  for (const name of BOT_NAMES) {
    const { game, log, startGold } = play(name);
    assert.equal(game.gold, startGold + log.gold, `${name}: every gold change came through an event`);
    assert.equal(game.towers.length, log.placed.length, `${name}: no towers sold, so towers equal placements`);
  }
});

test('the mono bots build only their tower, at most 12, and never upgrade', () => {
  for (const [name, type] of Object.entries(MONO)) {
    const { log } = play(name);
    assert.ok(log.placed.length > 0, name);
    assert.ok(log.placed.every((t) => t === type), `${name} built ${new Set(log.placed)}`);
    assert.ok(log.towersMax <= 12, `${name}: ${log.towersMax} towers`);
    assert.equal(log.upgraded, 0, name);
  }
});

test('every bot completes a Quick game in every mode without timing out', () => {
  for (const name of BOT_NAMES) {
    for (const mode of ['static', 'adaptive', 'random']) {
      const { game } = play(name, mode);
      assert.ok(game.over, `${name} ${mode} timed out`);
      assert.ok(['won', 'lost'].includes(game.result));
    }
  }
});
