import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { TOWER_ORDER } from '../src/data/towers.js';
import { createGame, stepGame, snapshotGame } from '../src/sim/game.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { placeTower, upgradeTower } from '../src/sim/towers.js';
import { startNextWave } from '../src/sim/waveRunner.js';
import { createStyleBot, styleBotNames } from '../experiments/styleBots.js';
import { getBot } from '../experiments/bots.js';
import { PROTOCOL } from '../experiments/protocol.js';

const ACT_EVERY_TICKS = 120;
const FOCUS = { lanceHeavy: 'lance', mortarHeavy: 'mortar', poisonHeavy: 'poison', sniperHeavy: 'sniper' };

/** Play with the bot like playGame does; optional stop condition and per-tick hook. */
function play(style, { seed = 1001, mode = 'static', untilWave = Infinity, checkpoints = [], maxTicks = 600000 } = {}) {
  const game = createGame({ seed, debugSpawnEveryTicks: 0, totalWaves: 15, mode });
  const bot = createStyleBot(style);
  const snaps = [];
  while (!game.over && game.tick < maxTicks && game.waves.current < untilWave) {
    const phase = game.waves.phase;
    if (phase === 'prep' || phase === 'intermission' || game.tick % ACT_EVERY_TICKS === 0) bot.act(game);
    stepGame(game);
    if (checkpoints.includes(game.tick)) snaps.push(snapshotGame(game));
  }
  snaps.push(snapshotGame(game));
  return { game, snaps };
}
const layout = (game) => game.towers.map((t) => [t.col, t.row, t.type]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);

test('the bot list is the protocol styles', () => {
  assert.deepEqual([...styleBotNames], [...PROTOCOL.styles]);
  assert.equal(createStyleBot('lanceHeavy').name, 'style:lanceHeavy');
});

test('a style bot is deterministic for a given style and seed', () => {
  for (const style of PROTOCOL.styles) {
    const cps = [1000, 3000, 6000, 12000, 20000];
    const a = play(style, { checkpoints: cps });
    const b = play(style, { checkpoints: cps });
    assert.equal(a.snaps.length, b.snaps.length);
    assert.ok(a.snaps.length >= 3, `${style}: game ended too early to compare`);
    a.snaps.forEach((s, i) => assert.deepEqual(s, b.snaps[i], `${style} snapshot ${i}`));
  }
});

test('different seeds give different tower layouts', () => {
  const layouts = new Set();
  for (let seed = 1001; seed <= 1005; seed++) layouts.add(JSON.stringify(layout(play('mortarHeavy', { seed, untilWave: 4 }).game)));
  assert.ok(layouts.size >= 3, `only ${layouts.size} distinct layouts`);
});

test('the bot acts only through sim commands: gold and towers reconcile with the events', () => {
  for (const style of PROTOCOL.styles) {
    const game = createGame({ seed: 1002, debugSpawnEveryTicks: 0, totalWaves: 15 });
    const bot = createStyleBot(style);
    let gold = 0;
    let placed = 0;
    game.events.on(EVENT_TYPES.GOLD_CHANGED, (ev) => { gold += ev.delta; });
    game.events.on(EVENT_TYPES.TOWER_PLACED, () => { placed++; });
    const start = game.gold;
    for (let i = 0; i < 20000 && !game.over; i++) {
      if (game.waves.phase !== 'running' || i % ACT_EVERY_TICKS === 0) bot.act(game);
      stepGame(game);
    }
    assert.equal(game.gold, start + gold, `${style}: every gold change came through an event`);
    assert.equal(game.towers.length, placed, style);
  }
});

test('a call that has nothing to do changes nothing (no direct writes to the game)', () => {
  const game = createGame({ seed: 1001, debugSpawnEveryTicks: 0, totalWaves: 15, startGold: 0 });
  startNextWave(game); // a running wave and no gold: no build, no upgrade, no new wave
  const before = JSON.stringify(snapshotGame(game));
  const bot = createStyleBot('lanceHeavy');
  bot.act(game);
  bot.act(game);
  assert.equal(JSON.stringify(snapshotGame(game)), before);
});

test('the bot random stream never touches the sim streams: replaying its commands by hand gives an identical game', () => {
  for (const style of ['balancedR', 'sniperHeavy']) {
    const actions = [];
    const game = createGame({ seed: 1003, debugSpawnEveryTicks: 0, totalWaves: 15 });
    game.events.on(EVENT_TYPES.TOWER_PLACED, (ev) => actions.push({ tick: ev.tick, kind: 'place', type: ev.type, col: ev.col, row: ev.row }));
    game.events.on(EVENT_TYPES.TOWER_UPGRADED, (ev) => actions.push({ tick: ev.tick, kind: 'upgrade', id: ev.id }));
    game.events.on(EVENT_TYPES.WAVE_STARTED, (ev) => actions.push({ tick: ev.tick, kind: 'wave' }));
    const bot = createStyleBot(style);
    const TICKS = 6000;
    for (let i = 0; i < TICKS; i++) {
      if (game.waves.phase !== 'running' || game.tick % ACT_EVERY_TICKS === 0) bot.act(game);
      stepGame(game);
    }
    const manual = createGame({ seed: 1003, debugSpawnEveryTicks: 0, totalWaves: 15 });
    let next = 0;
    for (let i = 0; i < TICKS; i++) {
      while (next < actions.length && actions[next].tick === manual.tick) {
        const a = actions[next++];
        if (a.kind === 'place') assert.ok(placeTower(manual, a.type, a.col, a.row).ok);
        else if (a.kind === 'upgrade') assert.ok(upgradeTower(manual, a.id).ok);
        else assert.ok(startNextWave(manual).ok);
      }
      stepGame(manual);
    }
    assert.ok(actions.length > 3, style);
    assert.deepEqual(snapshotGame(manual).rngStates, snapshotGame(game).rngStates, `${style}: sim rng states`);
    assert.deepEqual(snapshotGame(manual), snapshotGame(game), `${style}: whole game`);
  }
});

test('the style weights drive the tower mix (focus tower most built in at least 3 of the 4 focus styles)', () => {
  let focused = 0;
  const report = [];
  for (const [style, tower] of Object.entries(FOCUS)) {
    const counts = Object.fromEntries(TOWER_ORDER.map((t) => [t, 0]));
    for (let seed = 1001; seed <= 1020; seed++) for (const t of play(style, { seed, untilWave: 8 }).game.towers) counts[t.type]++;
    const top = TOWER_ORDER.reduce((b, t) => (counts[t] > counts[b] ? t : b), TOWER_ORDER[0]);
    report.push(`${style}: ${JSON.stringify(counts)}`);
    if (top === tower) focused++;
  }
  assert.ok(focused >= 3, report.join(' | '));
});

test('never more than the tower cap, never on an invalid or shared tile', () => {
  for (const style of PROTOCOL.styles) {
    const { game } = play(style, { seed: 1004 });
    assert.ok(game.towers.length <= config.towers.maxTowers);
    const seen = new Set();
    for (const t of game.towers) {
      assert.ok(game.map.isBuildable(t.col, t.row), `${style}: ${t.col},${t.row}`);
      assert.ok(!seen.has(`${t.col},${t.row}`));
      seen.add(`${t.col},${t.row}`);
    }
  }
});

test('every style completes a Quick game in every mode for seed 1001', () => {
  for (const style of PROTOCOL.styles) {
    for (const mode of PROTOCOL.modes) {
      const { game } = play(style, { mode });
      assert.ok(game.over, `${style} ${mode} timed out`);
      assert.ok(['won', 'lost'].includes(game.result));
    }
  }
});

test('getBot understands style bots and rejects unknown ones', () => {
  assert.equal(getBot('style:mortarHeavy').name, 'style:mortarHeavy');
  assert.throws(() => getBot('style:nope'), /unknown style bot/);
  assert.equal(getBot('balanced').name, 'balanced');
  assert.throws(() => getBot('nope'), /unknown bot/);
});

test('A2: an ablation style never builds its missing tower (10 seeds, whole games) and builds each other type at least once', () => {
  const missing = { noLance: 'lance', noMortar: 'mortar', noFrost: 'frost', noPoison: 'poison', noSniper: 'sniper' };
  for (const [style, tower] of Object.entries(missing)) {
    const built = Object.fromEntries(TOWER_ORDER.map((t) => [t, 0]));
    for (let seed = 1001; seed <= 1010; seed++) for (const t of play(style, { seed }).game.towers) built[t.type]++;
    assert.equal(built[tower], 0, `${style} built ${tower}`);
    for (const t of TOWER_ORDER) if (t !== tower) assert.ok(built[t] > 0, `${style} never built ${t}`);
    assert.equal(getBot(`style:${style}`).name, `style:${style}`);
  }
  assert.throws(() => getBot('style:noWall'), /unknown style bot/);
});
