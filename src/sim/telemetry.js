// Telemetry collector (pure, observation only): subscribes to the event bus, copies primitives out of payloads and builds plain run records.
// It never writes game state, never uses an rng and never emits events. Rules are documented in docs/TELEMETRY.md.
import { config } from '../data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../data/enemies.js';
import { TOWERS } from '../data/towers.js';
import { hpMultiplierForWave } from '../data/waves.js';
import { EVENT_TYPES } from './events.js';
import { SCHEMA_VERSION, SOURCE_IDS, sourceIndex } from './telemetrySchema.js';
import {
  copyPlain, roundTree, makeAggregate, makeWaveState, loadoutSnapshot, makeTowerRecord, towerOutput, waveOutput, offWaveOutput, enemyOutput,
} from './telemetryRecords.js';

const CONFIG_SECTIONS = ['sim', 'game', 'waves', 'economy', 'towers', 'combat', 'statuses', 'enemies', 'director'];
const RESERVED_META = new Set(['detail', 'seed', 'mode', 'totalWaves', 'startLives', 'startGold', 'stepSeconds', 'attachedAtTick', 'ignoredEvents', 'enemyRecordsDropped']);
const E = EVENT_TYPES;

function checkMeta(meta) {
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) throw new TypeError('telemetry meta must be a flat object');
  for (const [k, v] of Object.entries(meta)) {
    if (!['string', 'number', 'boolean'].includes(typeof v)) throw new TypeError(`telemetry meta.${k} must be a string, number or boolean`);
    if (RESERVED_META.has(k)) throw new RangeError(`telemetry meta key "${k}" is reserved`);
  }
}

/**
 * Attach a collector to a game.
 * @param {object} game
 * @param {{detail?: 'full'|'summary', meta?: Record<string, string|number|boolean>, maxEnemyRecords?: number}} [options]
 * @returns {{getRun: () => object, counts: () => object, attachDirector: (wave: number, record: object) => void, dispose: () => void}}
 */
export function attachTelemetry(game, { detail = config.telemetry.detail, meta = {}, maxEnemyRecords = config.telemetry.maxEnemyRecords } = {}) {
  if (!config.telemetry.allowedDetails.includes(detail)) throw new RangeError(`telemetry detail must be one of ${config.telemetry.allowedDetails.join(', ')}, got ${String(detail)}`);
  checkMeta(meta);
  const full = detail === 'full';
  const stepSeconds = config.sim.stepSeconds;
  const baseMeta = { seed: game.seed, mode: game.mode, totalWaves: game.totalWaves, startLives: game.maxLives, startGold: game.gold, stepSeconds, attachedAtTick: game.tick };

  const active = new Map(); // enemy id -> record being built
  const ended = []; // finished enemy records (full detail only)
  const towers = new Map(); // tower id -> record (alive and sold)
  const waves = []; // wave states in start order
  const offWave = makeAggregate();
  const gold = { earnedKills: 0, clearBonus: 0, spent: 0, refunded: 0 };
  const prep = { spent: 0, refunded: 0 };
  let open = null; // the wave being played, or null
  let over = false;
  let ignored = 0;
  let dropped = 0;

  const bucket = () => open ?? offWave;

  const onSpawned = (ev) => {
    const agg = open !== null && open.wave === ev.wave ? open : offWave; // debug spawns outside a wave belong to offWave
    const src = game.enemyIndex.get(ev.id);
    active.set(ev.id, {
      id: ev.id, type: ev.type, wave: agg === offWave ? 0 : ev.wave, hpMult: hpMultiplierForWave(ev.wave), spawnTick: ev.tick, maxHp: ev.maxHp,
      maxShield: src ? src.maxShield : 0, bucket: agg, damage: new Float64Array(SOURCE_IDS.length), damageTaken: 0,
      outcome: null, outcomeTick: 0, progress: 0, killerSource: null, killerTower: -1,
    });
    agg.byType[ev.type].spawned++;
  };

  const onDamaged = (ev) => {
    const rec = active.get(ev.id);
    if (rec === undefined) { ignored++; return; }
    const slot = sourceIndex(ev.source);
    rec.damage[slot] += ev.amount;
    rec.damageTaken += ev.amount;
    const s = rec.bucket.byType[rec.type];
    s.damageTaken += ev.amount;
    s.damageBySource[SOURCE_IDS[slot]] += ev.amount;
    if (ev.towerId >= 0) {
      const t = towers.get(ev.towerId);
      if (t !== undefined) { t.damageDealt += ev.amount; t.damageByEnemyType[rec.type] += ev.amount; }
    }
  };

  /** Shared ending of a kill or a leak: aggregate, then keep or drop the record. */
  const finish = (rec, outcome, tick, progress) => {
    active.delete(rec.id);
    const s = rec.bucket.byType[rec.type];
    s.progressSum += progress;
    s.timeAliveTicksSum += tick - rec.spawnTick;
    rec.outcome = outcome;
    rec.outcomeTick = tick;
    rec.progress = progress;
    rec.bucket = null;
    if (!full) return;
    if (ended.length < maxEnemyRecords) ended.push(rec);
    else dropped++;
  };

  const onKilled = (ev) => {
    const rec = active.get(ev.id);
    if (rec === undefined) { ignored++; return; }
    rec.bucket.byType[rec.type].killed++;
    rec.bucket.byType[rec.type].killedBySource[SOURCE_IDS[sourceIndex(ev.source)]]++;
    rec.killerSource = ev.source;
    rec.killerTower = ev.towerId;
    const t = towers.get(ev.towerId);
    if (t !== undefined) { t.kills++; t.killsByEnemyType[rec.type]++; }
    finish(rec, 'killed', ev.tick, ev.progress);
  };

  const onLeaked = (ev) => {
    const rec = active.get(ev.id);
    if (rec === undefined) { ignored++; return; }
    rec.bucket.byType[rec.type].leaked++;
    finish(rec, 'leaked', ev.tick, 1);
  };

  const onGold = (ev) => {
    const r = ev.reason;
    if (r === 'kill') { gold.earnedKills += ev.delta; if (open) open.gold.earnedKills += ev.delta; }
    else if (r === 'wave_clear') { gold.clearBonus += ev.delta; if (open) open.gold.clearBonus += ev.delta; }
    else if (r === 'build' || r === 'upgrade') { gold.spent -= ev.delta; if (open) open.gold.spentDuring -= ev.delta; else prep.spent -= ev.delta; }
    else if (r === 'sell') { gold.refunded += ev.delta; if (open) open.gold.refundedDuring += ev.delta; else prep.refunded += ev.delta; }
  };

  const onWaveStarted = (ev) => {
    open = makeWaveState(ev, game.gold, prep, loadoutSnapshot(game));
    if (ev.director !== null && ev.director !== undefined) { // the Director's decision record (adaptive and random modes); static waves have none
      try { open.director = copyPlain(ev.director, 'director'); } catch { ignored++; }
    }
    prep.spent = 0;
    prep.refunded = 0;
    waves.push(open);
  };

  const onWaveEnded = (ev) => {
    if (open === null || open.wave !== ev.wave) { ignored++; return; }
    open.endTick = ev.tick;
    open.complete = true;
    open.livesAfter = ev.lives;
    open.gold.atEnd = game.gold;
    open = null;
  };

  const onFired = (ev) => {
    const t = towers.get(ev.towerId);
    if (t === undefined) { ignored++; return; }
    t.shots++;
    bucket().towerActivity[t.type].shots++;
  };

  const onImpact = (ev) => {
    const a = bucket().towerActivity[ev.type];
    if (a === undefined) { ignored++; return; }
    a.impacts++;
    if (ev.hit) a.impactsWithHit++;
  };

  const onPlaced = (ev) => { towers.set(ev.id, makeTowerRecord(ev, game)); };

  const onUpgraded = (ev) => {
    const t = towers.get(ev.id);
    if (t === undefined) { ignored++; return; }
    t.upgrades.push({ level: ev.level, tick: ev.tick, wave: game.waves.current, cost: ev.cost });
    t.finalLevel = ev.level;
    t.invested += ev.cost;
  };

  const onSold = (ev) => {
    const t = towers.get(ev.id);
    if (t === undefined) { ignored++; return; }
    t.sold = true;
    t.soldTick = ev.tick;
    t.soldWave = game.waves.current;
    t.refund = ev.refund;
  };

  const handlers = [
    [E.WAVE_STARTED, onWaveStarted], [E.WAVE_ENDED, onWaveEnded], [E.ENEMY_SPAWNED, onSpawned], [E.ENEMY_DAMAGED, onDamaged],
    [E.ENEMY_KILLED, onKilled], [E.ENEMY_LEAKED, onLeaked], [E.TOWER_PLACED, onPlaced], [E.TOWER_UPGRADED, onUpgraded], [E.TOWER_SOLD, onSold],
    [E.TOWER_FIRED, onFired], [E.PROJECTILE_IMPACT, onImpact], [E.GOLD_CHANGED, onGold],
    [E.LIVES_CHANGED, (ev) => { bucket().livesLost -= ev.delta; }],
    // GAME_OVER can fire from inside the leak that ends the game, before this collector sees that leak: it only notes the result.
    [E.GAME_OVER, () => { over = true; }],
    [E.GAME_STARTED, () => {}],
  ];
  let unsubscribers = handlers.map(([type, fn]) => game.events.on(type, fn));

  const sumTypes = (field) => [offWave, ...waves].reduce((n, a) => n + ENEMY_ORDER.reduce((m, id) => m + a.byType[id][field], 0), 0);
  const sumActivity = (field) => [offWave, ...waves].reduce((n, a) => n + Object.values(a.towerActivity).reduce((m, v) => m + v[field], 0), 0);

  function buildTotals() {
    const damageBySource = Object.fromEntries(SOURCE_IDS.map((id) => [id, [offWave, ...waves].reduce((n, a) => n + ENEMY_ORDER.reduce((m, t) => m + a.byType[t].damageBySource[id], 0), 0)]));
    const records = [...towers.values()];
    return {
      spawned: sumTypes('spawned'), killed: sumTypes('killed'), leaked: sumTypes('leaked'),
      livesLost: [offWave, ...waves].reduce((n, a) => n + a.livesLost, 0),
      shots: sumActivity('shots'), impacts: sumActivity('impacts'), impactsWithHit: sumActivity('impactsWithHit'), damageBySource,
      towersBuilt: records.length, towersSold: records.filter((t) => t.sold).length, upgrades: records.reduce((n, t) => n + t.upgrades.length, 0),
      gold: { ...gold },
    };
  }

  function buildEnemies() {
    const list = ended.map((r) => enemyOutput(r));
    for (const rec of active.values()) {
      const live = game.enemyIndex.get(rec.id);
      list.push(enemyOutput(rec, { outcome: 'alive', outcomeTick: game.tick, progress: live ? game.map.path.progressAt(live.distance) : 0 }));
    }
    return list.sort((a, b) => a.id - b.id);
  }

  return {
    getRun() {
      const run = {
        schemaVersion: SCHEMA_VERSION,
        meta: { detail, ...baseMeta, ignoredEvents: ignored, enemyRecordsDropped: dropped, ...meta },
        config: Object.fromEntries(CONFIG_SECTIONS.map((k) => [k, copyPlain(config[k], `config.${k}`)])),
        definitions: { enemies: copyPlain(ENEMIES, 'ENEMIES'), towers: copyPlain(TOWERS, 'TOWERS') },
        result: { over: over || game.over, result: game.result, wave: game.waves.current, lives: game.lives, ticks: game.tick, seconds: game.tick * stepSeconds },
        totals: buildTotals(),
        offWave: offWaveOutput(offWave, stepSeconds),
        waves: waves.map((w) => waveOutput(w, game, stepSeconds)),
        towers: [...towers.values()].map(towerOutput),
      };
      if (full) run.enemies = buildEnemies();
      // meta, config and definitions are exact copies (rounding stepSeconds = 1/60 would skew every derived time)
      for (const key of ['result', 'totals', 'offWave', 'waves', 'towers', 'enemies']) if (key in run) roundTree(run[key]);
      return run;
    },
    counts: () => ({ enemyRecords: ended.length, enemyRecordsDropped: dropped, waveRecords: waves.length, towerRecords: towers.size, active: active.size, ignoredEvents: ignored }),
    attachDirector(wave, record) {
      const w = waves.find((x) => x.wave === wave);
      if (w === undefined) throw new RangeError(`no wave record for wave ${String(wave)}`);
      w.director = copyPlain(record, 'director record');
    },
    dispose() {
      for (const off of unsubscribers) off();
      unsubscribers = [];
    },
  };
}
