// Plain-text summary of a telemetry run. CLI: node experiments/summarize.js <run.json>
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { SOURCE_IDS, roundTo, validateRun } from '../src/sim/telemetrySchema.js';

const TOP_TOWERS = 12;
const f = (x, d = 2) => roundTo(x, d).toFixed(d);

const LEFT_ALIGNED = new Set(['enemy', 'name', 'type']);

/** Aligned text table: text columns left, numeric columns right-aligned. */
export function table(title, headers, rows) {
  const all = [headers, ...rows.map((r) => r.map(String))];
  const widths = headers.map((_, c) => Math.max(...all.map((r) => r[c].length)));
  const line = (r) => r.map((v, c) => (LEFT_ALIGNED.has(headers[c]) ? v.padEnd(widths[c]) : v.padStart(widths[c]))).join('  ');
  return [title, line(headers), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map((r) => line(r.map(String)))].join('\n');
}

/**
 * @param {object} run a telemetry run @param {{maxWaves?: number}} [options] limit the per-wave table
 * @returns {string}
 */
export function formatRunSummary(run, { maxWaves = Infinity } = {}) {
  const { meta, result } = run;
  const header = `Run: seed=${meta.seed} mode=${meta.mode} waves=${meta.totalWaves} result=${result.result ?? 'in progress'} final wave=${result.wave} lives=${result.lives} game minutes=${f(result.seconds / 60, 1)} detail=${meta.detail}`;

  const waveRows = run.waves.slice(0, maxWaves).map((w) => [w.wave, w.name ?? '-', f(w.hpMult), w.threat, w.spawnedUnits, w.killed, w.leaked, w.livesLost, w.livesAfter, w.loadout.totalTowers, w.gold.atStart]);
  const waves = table('Per wave', ['wave', 'name', 'hpMult', 'threat', 'spawned', 'killed', 'leaked', 'livesLost', 'livesAfter', 'towers', 'goldStart'], waveRows);

  const groups = [run.offWave, ...run.waves];
  const sum = (id, pick) => groups.reduce((n, g) => n + pick(g.byType[id]), 0);
  const damage = table('Damage by source (all waves + offWave)', ['enemy', ...SOURCE_IDS],
    ENEMY_ORDER.map((id) => [id, ...SOURCE_IDS.map((s) => f(sum(id, (t) => t.damageBySource[s]), 0))]));

  const perType = table('Per enemy type', ['enemy', 'spawned', 'killed', 'leaked', 'leakRate', 'meanProgress'], ENEMY_ORDER.map((id) => {
    const spawned = sum(id, (t) => t.spawned);
    const killed = sum(id, (t) => t.killed);
    const leaked = sum(id, (t) => t.leaked);
    const ended = killed + leaked;
    return [id, spawned, killed, leaked, f(spawned > 0 ? leaked / spawned : 0, 3), f(ended > 0 ? sum(id, (t) => t.progressSum) / ended : 0, 3)];
  }));

  const top = [...run.towers].sort((a, b) => b.damageDealt - a.damageDealt || a.id - b.id).slice(0, TOP_TOWERS);
  const towers = table(`Towers (top ${TOP_TOWERS} by damage dealt)`, ['id', 'type', 'level', 'damage', 'kills', 'shots', 'sold'],
    top.map((t) => [t.id, t.type, t.finalLevel, f(t.damageDealt, 0), t.kills, t.shots, t.sold ? 'yes' : 'no']));

  return [header, '', waves, '', damage, '', perType, '', towers, ''].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  const fail = (message) => { console.error(message); process.exit(1); };
  if (!file) fail('usage: node experiments/summarize.js <run.json>');
  let text;
  try { text = readFileSync(file, 'utf8'); } catch (e) { fail(`cannot read ${file}: ${e.message}`); }
  let run;
  try { run = JSON.parse(text); } catch (e) { fail(`${file} is not valid JSON: ${e.message}`); }
  const problems = validateRun(run);
  if (problems.length > 0) fail(`${file} is not a valid run:\n  ${problems.join('\n  ')}`);
  process.stdout.write(formatRunSummary(run));
}
