import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { createGame, stepGame } from '../src/sim/game.js';
import { attachTelemetry } from '../src/sim/telemetry.js';
import { startNextWave } from '../src/sim/waveRunner.js';
import { applyDamage } from '../src/sim/damage.js';
import { spawnEnemyNow } from '../src/sim/enemies.js';
import {
  ENEMY_CSV_COLUMNS, WAVE_CSV_COLUMNS, WAVE_TYPE_CSV_COLUMNS, TOWER_CSV_COLUMNS, emptyTypeStats, emptySourceCounts, finalizeTypeStats,
} from '../src/sim/telemetrySchema.js';
import { toCsv, runToJson, wavesCsv, waveTypesCsv, enemiesCsv, towersCsv } from '../src/sim/telemetryExport.js';
import { getBot } from '../experiments/bots.js';

/** Tiny RFC 4180 parser for the tests (quotes, doubled quotes, embedded newlines). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  assert.equal(cell, '', 'text must end with a newline');
  assert.equal(row.length, 0);
  return rows;
}

test('toCsv: header, line endings and trailing newline', () => {
  const out = toCsv([[1, 'a'], [2, 'b']], ['n', 's']);
  assert.equal(out, 'n,s\n1,a\n2,b\n');
  assert.equal(toCsv([], ['n', 's']), 'n,s\n');
});

test('toCsv escapes commas, quotes, CR and LF, and keeps spaces and empty strings', () => {
  const out = toCsv([['a,b', 'say "hi"', 'x\ny', 'x\ry', '  pad  ', '']], ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.equal(out, 'a,b,c,d,e,f\n"a,b","say ""hi""","x\ny","x\ry",  pad  ,\n');
  const parsed = parseCsv(out);
  assert.deepEqual(parsed[1], ['a,b', 'say "hi"', 'x\ny', 'x\ry', '  pad  ', '']);
});

test('toCsv prints null, undefined, booleans, integers and rounded floats', () => {
  const out = toCsv([[null, undefined, true, false, 7, 1.23456789, -0, 2.5]], ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], { floatDigits: 2 });
  assert.equal(out, 'a,b,c,d,e,f,g,h\n,,true,false,7,1.23,0,2.5\n');
  assert.equal(toCsv([[1.23456789]], ['x'], { floatDigits: 4 }), 'x\n1.2346\n');
  assert.equal(toCsv([[1.23456789]], ['x']), 'x\n1.2346\n'); // default is the csv digits from config
});

test('toCsv throws for non-finite numbers, naming the column and the row', () => {
  assert.throws(() => toCsv([[1], [NaN]], ['score']), (e) => e instanceof TypeError && /score/.test(e.message) && /row 1/.test(e.message));
  assert.throws(() => toCsv([[Infinity]], ['x']), TypeError);
  assert.throws(() => toCsv([[1, 2]], ['only']), RangeError);
});

// ---------- the tables ----------
function scriptedRun(detail = 'full') {
  const game = createGame({ seed: 4, debugSpawnEveryTicks: 0, startGold: 100000 });
  const tele = attachTelemetry(game, { detail });
  const bot = getBot('balanced');
  bot.act(game);
  startNextWave(game);
  for (let i = 0; i < 4000; i++) {
    if (i % 120 === 0) bot.act(game);
    stepGame(game);
  }
  applyDamage(game, spawnEnemyNow(game, 'fastRunner'), { amount: 5, kind: 'direct' });
  return tele.getRun();
}

test('table headers equal the column lists and row counts equal the record counts', () => {
  const run = scriptedRun();
  const cases = [
    [wavesCsv(run), WAVE_CSV_COLUMNS, run.waves.length],
    [waveTypesCsv(run), WAVE_TYPE_CSV_COLUMNS, run.waves.length * ENEMY_ORDER.length],
    [enemiesCsv(run), ENEMY_CSV_COLUMNS, run.enemies.length],
    [towersCsv(run), TOWER_CSV_COLUMNS, run.towers.length],
  ];
  for (const [text, columns, count] of cases) {
    const rows = parseCsv(text);
    assert.deepEqual(rows[0], [...columns]);
    assert.equal(rows.length - 1, count);
    for (const row of rows) assert.equal(row.length, columns.length);
  }
  assert.ok(run.waves.length >= 1 && run.enemies.length > 0 && run.towers.length > 0);
});

test('exports are deterministic', () => {
  const run = scriptedRun();
  for (const f of [wavesCsv, waveTypesCsv, enemiesCsv, towersCsv, runToJson]) assert.equal(f(run), f(run));
  assert.equal(runToJson(scriptedRun()), runToJson(scriptedRun()));
});

test('runToJson: compact by default, 2-space when pretty, lossless', () => {
  const run = scriptedRun('summary');
  assert.equal(runToJson(run), JSON.stringify(run));
  assert.equal(runToJson(run, { pretty: true }), JSON.stringify(run, null, 2));
  assert.deepEqual(JSON.parse(runToJson(run)), run);
});

test('enemiesCsv throws a clear error for a summary run; the other tables still work', () => {
  const run = scriptedRun('summary');
  assert.throws(() => enemiesCsv(run), /no enemy records/);
  assert.ok(wavesCsv(run).startsWith('wave,name'));
  assert.ok(towersCsv(run).startsWith('id,type'));
});

// ---------- golden rows from a hand-built run ----------
function goldenRun() {
  const typeStats = (over = {}) => finalizeTypeStats({ ...emptyTypeStats(), ...over }, 0.5, 6);
  const grunt = typeStats({
    spawned: 10, killed: 9, leaked: 1, progressSum: 9.5, timeAliveTicksSum: 250, damageTaken: 300.123456,
    damageBySource: { ...emptySourceCounts(), lance: 100.00004, mortar: 200.123416 }, killedBySource: { ...emptySourceCounts(), lance: 6, mortar: 3 },
  });
  const byType = Object.fromEntries(ENEMY_ORDER.map((id) => [id, id === 'armoredGrunt' ? grunt : typeStats()]));
  const loadout = { totalTowers: 3, totalInvested: 200, nominalDps: 33.33333, byType: { lance: { count: 1 }, mortar: { count: 2 }, frost: { count: 0 }, poison: { count: 0 }, sniper: { count: 0 } } };
  const wave = {
    wave: 3, name: 'The, "Quote"', fixed: true, complete: true, mode: 'static', startTick: 100, endTick: 400, seconds: 150, hpMult: 1.5, budget: 200, threat: 198,
    spawnedUnits: 10, killed: 9, leaked: 1, livesLost: 2, livesAfter: 18, loadout,
    gold: { atStart: 50, prepSpent: 10, prepRefunded: 5, earnedKills: 90, clearBonus: 31, spentDuring: 60, refundedDuring: 0, atEnd: 96 }, byType,
  };
  const enemy = {
    id: 7, type: 'armoredGrunt', wave: 3, hpMult: 1.5, spawnTick: 120, maxHp: 180, maxShield: 0, outcome: 'killed', outcomeTick: 220, timeAliveTicks: 100, progress: 0.98765,
    damageTaken: 180, damageBySource: { ...emptySourceCounts(), lance: 100, sniper: 80 }, killer: { source: 'sniper', towerId: 2 },
  };
  const tower = {
    id: 2, type: 'sniper', col: 4, row: 5, builtTick: 50, builtWave: 2, builtPhase: 'intermission', cost: 120, finalLevel: 1, invested: 210, sold: false, soldWave: null, refund: null,
    damageDealt: 1234.56789, kills: 5, shots: 12, damageByEnemyType: { armoredGrunt: 80.5, swarmling: 0, fastRunner: 10, regenerator: 0, shieldedBruiser: 1000 },
  };
  return { meta: { stepSeconds: 0.5, detail: 'full' }, waves: [wave], enemies: [enemy], towers: [tower] };
}

test('golden rows: waves, wave types, enemies and towers', () => {
  const run = goldenRun();
  assert.equal(parseCsv(wavesCsv(run))[1].join('|'), '3|The, "Quote"|true|true|static|100|400|150|1.5|200|198|10|9|1|2|18|50|10|5|90|31|60|96|3|200|33.3333|1|2|0|0|0');
  assert.equal(wavesCsv(run).split('\n')[1], '3,"The, ""Quote""",true,true,static,100,400,150,1.5,200,198,10,9,1,2,18,50,10,5,90,31,60,96,3,200,33.3333,1,2,0,0,0');
  const types = waveTypesCsv(run).split('\n');
  assert.equal(types[1], '3,armoredGrunt,10,9,1,0.1,0.95,12.5,300.1235,100,200.1234,0,0,0,0,0,6,3,0,0,0,0,0');
  assert.equal(types[2], '3,swarmling,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0');
  assert.equal(enemiesCsv(run).split('\n')[1], '7,armoredGrunt,3,1.5,120,60,180,0,killed,220,50,0.9877,180,100,0,0,0,80,0,0,sniper,2');
  assert.equal(towersCsv(run).split('\n')[1], '2,sniper,4,5,50,2,intermission,120,1,210,false,,,1234.5679,5,12,80.5,0,10,0,1000');
});
