// Headless tower-vs-enemy matchup harness. Uses the real src/sim code only; deterministic.
// CLI: `node experiments/matchups.js` prints a table and writes experiments/results/matchups.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { config } from '../src/data/config.js';
import { DEFAULT_MAP } from '../src/data/map.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { TOWERS, TOWER_ORDER } from '../src/data/towers.js';
import { createGame, stepGame } from '../src/sim/game.js';
import { queueEnemy } from '../src/sim/enemies.js';
import { placeTower, upgradeTower, getTowerStats } from '../src/sim/towers.js';
import { EVENT_TYPES } from '../src/sim/events.js';

const HUGE_GOLD = 1e9;
const SAMPLE_STEP = 8; // world units between path samples when choosing the tile
const DEFAULT_SPACING = 20;

let cachedTile = null;

/**
 * The buildable tile with the longest stretch of path inside the Lance's base range (computed once, deterministic).
 * @returns {{col: number, row: number}}
 */
export function primaryTile() {
  if (cachedTile) return cachedTile;
  const game = createGame({ seed: 1, debugSpawnEveryTicks: 0 });
  const range = TOWERS.lance.range;
  const pos = { x: 0, y: 0, angle: 0 };
  const samples = [];
  for (let d = 0; d <= game.map.path.totalLength; d += SAMPLE_STEP) {
    game.map.path.positionAt(d, pos);
    samples.push({ x: pos.x, y: pos.y });
  }
  let best = null;
  let bestCount = -1;
  for (const cell of game.map.buildableCells()) { // row-major order: ties resolve to the first cell
    const c = game.map.tileToWorld(cell.col, cell.row);
    let n = 0;
    for (const s of samples) if (Math.hypot(s.x - c.x, s.y - c.y) <= range) n++;
    if (n > bestCount) { best = cell; bestCount = n; }
  }
  cachedTile = best;
  return best;
}

/**
 * Run one pass: towers vs a stream of enemies, to completion.
 * @param {{towers: {type: string, level?: number}[], enemy: {type: string, count?: number, spacingTicks?: number}, seed?: number, maxTicks?: number}} o
 * @returns {object} metrics
 */
export function runPass({ towers, enemy, seed = 1, maxTicks = 20000 }) {
  const game = createGame({ seed, debugSpawnEveryTicks: 0, startGold: HUGE_GOLD });
  const home = primaryTile();
  const homeWorld = game.map.tileToWorld(home.col, home.row);
  const others = game.map.buildableCells()
    .filter((c) => c.col !== home.col || c.row !== home.row)
    .map((c) => ({ ...c, d: Math.hypot(game.map.tileToWorld(c.col, c.row).x - homeWorld.x, game.map.tileToWorld(c.col, c.row).y - homeWorld.y) }))
    .sort((a, b) => a.d - b.d || a.row - b.row || a.col - b.col);

  const placed = towers.map((spec, i) => {
    const tile = i === 0 ? home : others[i - 1];
    const t = placeTower(game, spec.type, tile.col, tile.row).tower;
    for (let l = 0; l < (spec.level ?? 0); l++) upgradeTower(game, t.id);
    return t;
  });
  const primary = placed[0];
  const primaryRange = getTowerStats(primary.type, primary.level).range;

  const m = {
    damageDealt: 0, kills: 0, leaked: 0, shotsFired: 0, impactsWithHit: 0, impactsTotal: 0, hitRate: 0,
    avgDamagePerHit: 0, exposureSeconds: 0, healedWhilePoisoned: 0, ticks: 0,
  };
  let primaryHits = 0;
  let primaryDamage = 0;
  const bus = game.events;
  bus.on(EVENT_TYPES.ENEMY_DAMAGED, (ev) => {
    if (ev.towerId < 0) return;
    m.damageDealt += ev.amount;
    if (ev.towerId === primary.id && ev.kind === 'direct') { primaryHits++; primaryDamage += ev.amount; }
  });
  bus.on(EVENT_TYPES.ENEMY_KILLED, () => { m.kills++; });
  bus.on(EVENT_TYPES.ENEMY_LEAKED, () => { m.leaked++; });
  bus.on(EVENT_TYPES.TOWER_FIRED, (ev) => { if (ev.towerId === primary.id) m.shotsFired++; });
  bus.on(EVENT_TYPES.PROJECTILE_IMPACT, (ev) => { m.impactsTotal++; if (ev.hit) m.impactsWithHit++; });

  const count = enemy.count ?? 1;
  const spacing = enemy.spacingTicks ?? (ENEMIES[enemy.type].packSize > 1 ? ENEMIES[enemy.type].packIntervalTicks : DEFAULT_SPACING);
  for (let i = 0; i < count; i++) queueEnemy(game, enemy.type, { delayTicks: i * spacing, pack: false });

  const hpBefore = new Map();
  while (game.tick < maxTicks) {
    for (const e of game.enemies) hpBefore.set(e.id, e.poisonRemaining > 0 ? e.hp : -1);
    stepGame(game);
    let exposed = false;
    for (const e of game.enemies) {
      if (!exposed && Math.hypot(e.x - primary.x, e.y - primary.y) <= primaryRange) exposed = true;
      const before = hpBefore.get(e.id);
      if (before !== undefined && before >= 0 && e.hp > before) m.healedWhilePoisoned++;
    }
    if (exposed) m.exposureSeconds += config.sim.stepSeconds;
    if (game.enemies.length === 0 && game.spawnQueue.length === 0 && game.tick > 1) break;
  }
  m.ticks = game.tick;
  m.hitRate = m.impactsTotal ? m.impactsWithHit / m.impactsTotal : 0;
  m.avgDamagePerHit = primaryHits ? primaryDamage / primaryHits : 0;
  return m;
}

const COLUMNS = [
  ['armoredGrunt', { type: 'armoredGrunt', count: 1 }, 'grunt x1'],
  ['swarmling', { type: 'swarmling', count: 8 }, 'swarm x8'],
  ['fastRunner', { type: 'fastRunner', count: 10 }, 'runner x10'],
  ['regenerator', { type: 'regenerator', count: 1 }, 'regen x1'],
  ['shieldedBruiser', { type: 'shieldedBruiser', count: 1 }, 'bruiser x1'],
];

/** Run the full tower x enemy table (every tower alone, level 0). */
export function runTable() {
  const rows = {};
  for (const tower of TOWER_ORDER) {
    rows[tower] = {};
    for (const [key, enemy] of COLUMNS) rows[tower][key] = runPass({ towers: [{ type: tower }], enemy });
  }
  return rows;
}

function printTable(rows) {
  const pad = (s, n) => String(s).padEnd(n);
  const cell = (m) => `k${m.kills} d${Math.round(m.damageDealt)} h${m.impactsTotal ? `${Math.round(m.hitRate * 100)}%` : '-'}`;
  console.log(`Matchups (tile ${JSON.stringify(primaryTile())}); cell = kills / damage dealt / projectile hit rate`);
  console.log(pad('tower', 9) + COLUMNS.map(([, , label]) => pad(label, 18)).join(''));
  for (const tower of TOWER_ORDER) console.log(pad(tower, 9) + COLUMNS.map(([key]) => pad(cell(rows[tower][key]), 18)).join(''));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = runTable();
  printTable(rows);
  const out = resolve(dirname(fileURLToPath(import.meta.url)), 'results/matchups.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ tile: primaryTile(), enemies: ENEMY_ORDER, rows }, null, 2));
  console.log(`wrote ${out}`);
}
