import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { PROTOCOL } from '../experiments/protocol.js';
import { playGame } from '../experiments/playthrough.js';
import { createStyleBot } from '../experiments/styleBots.js';
import {
  collectBaselineObservations, baselineTable, varianceDecomposition, noiseFloor, diagnose, formatDiagnostics, diagnosticsToMarkdown, cellReward, NOTES,
} from '../experiments/diagnose.js';

const k = config.director.rewardExponent;
const near = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const o = (seed, style, wave, type, units, progressSum) => ({ seed, style, wave, type, units, killed: units, leaked: 0, progressSum, threatCost: ENEMIES[type].threatCost, leakDamage: ENEMIES[type].leakDamage });
const rewardOfCell = (type, units, progressSum) => ENEMIES[type].leakDamage * (progressSum / units) ** k / ENEMIES[type].threatCost;

test('the cell reward follows the Director formula and skips empty cells', () => {
  assert.equal(cellReward(o(1, 'a', 5, 'armoredGrunt', 0, 0)), null);
  near(cellReward(o(1, 'a', 5, 'armoredGrunt', 10, 5)), 0.025, 1e-12);
});

test('baselineTable: hand-computed pooled rewards and ratios, and minWave filtering', () => {
  const obs = [o(1, 'a', 5, 'armoredGrunt', 10, 5), o(1, 'a', 5, 'swarmling', 8, 2), o(1, 'a', 3, 'armoredGrunt', 10, 9)];
  const t5 = baselineTable(obs, { minWave: 5 });
  const grunt = 0.025;
  const swarm = 0.0625 / 3;
  const all = (100 * grunt + 24 * swarm) / 124;
  near(t5.allTypesPooledReward, all);
  near(t5.overall.armoredGrunt.pooledReward, grunt);
  near(t5.overall.armoredGrunt.ratio, grunt / all);
  near(t5.overall.swarmling.ratio, swarm / all);
  assert.deepEqual([t5.overall.armoredGrunt.cells, t5.overall.armoredGrunt.units, t5.overall.swarmling.units], [1, 10, 8]);
  assert.deepEqual(t5.overall.fastRunner, { cells: 0, units: 0, pooledReward: 0, ratio: 0 });
  near(t5.perStyle.a.armoredGrunt.ratio, grunt / all);
  const t1 = baselineTable(obs, { minWave: 1 }); // the wave 3 grunt cell (progress 0.9, reward 0.081) joins
  const g1 = (100 * grunt + 100 * 0.081) / 200;
  near(t1.overall.armoredGrunt.pooledReward, g1);
  assert.equal(t1.overall.armoredGrunt.cells, 2);
});

function grid(valueOf) {
  const out = [];
  for (const style of ['A', 'B']) for (const wave of [5, 6]) for (const seed of [1, 2]) out.push(o(seed, style, wave, 'armoredGrunt', 10, 10 * valueOf({ style, wave, seed })));
  return out;
}

test('varianceDecomposition: all variance from the style, all from the wave, and none (constant reward)', () => {
  const byStyle = varianceDecomposition(grid(({ style }) => (style === 'A' ? 0.2 : 0.8)));
  assert.deepEqual([byStyle.armoredGrunt.etaStyle, byStyle.armoredGrunt.etaWave], [1, 0]);
  const byWave = varianceDecomposition(grid(({ wave }) => (wave === 5 ? 0.2 : 0.8)));
  assert.deepEqual([byWave.armoredGrunt.etaStyle, byWave.armoredGrunt.etaWave], [0, 1]);
  const constant = varianceDecomposition(grid(() => 0.5));
  assert.deepEqual([constant.armoredGrunt.etaStyle, constant.armoredGrunt.etaWave], [0, 0]);
  assert.deepEqual(byStyle.swarmling, { cells: 0, etaStyle: 0, etaWave: 0 });
  const mixed = varianceDecomposition(grid(({ style, wave }) => (style === 'A' ? 0.2 : 0.4) + (wave === 5 ? 0 : 0.1)));
  assert.ok(mixed.armoredGrunt.etaStyle > 0.5 && mixed.armoredGrunt.etaWave > 0 && mixed.armoredGrunt.etaStyle + mixed.armoredGrunt.etaWave <= 1.000001);
});

test('noiseFloor: groups with one seed are skipped; the spread is the max minus min of the pooled rewards', () => {
  const obs = [
    o(1, 'a', 5, 'armoredGrunt', 10, 2), o(2, 'a', 5, 'armoredGrunt', 10, 4), // a group of two seeds: rewards 0.004 and 0.016
    o(1, 'a', 6, 'armoredGrunt', 10, 9), // a group of one seed: skipped
    o(1, 'a', 5, 'swarmling', 8, 4),
  ];
  const n = noiseFloor(obs);
  assert.equal(n.perType.armoredGrunt.groups, 1);
  near(n.perType.armoredGrunt.medianSd, Math.sqrt((0.006 * 0.006 * 2) / 1), 1e-5);
  assert.deepEqual(n.perType.swarmling, { groups: 0, medianSd: 0 });
  const base = baselineTable(obs, { minWave: 5 });
  const present = ENEMY_ORDER.filter((t) => base.overall[t].cells > 0).map((t) => base.overall[t].pooledReward);
  near(n.spread.value, Math.max(...present) - Math.min(...present));
  assert.equal(n.spread.minWave, 5);
  near(n.ratio.armoredGrunt, n.perType.armoredGrunt.medianSd / n.spread.value, 1e-5);
});

test('diagnose, the formatters and determinism', () => {
  const obs = grid(({ style, wave, seed }) => 0.2 + 0.1 * (style === 'A' ? 0 : 1) + 0.01 * wave + 0.005 * seed).concat([o(1, 'A', 5, 'swarmling', 8, 2)]);
  const d = diagnose(obs);
  assert.deepEqual(Object.keys(d), ['baseline1', 'baseline5', 'variance', 'noise', 'notes']);
  assert.deepEqual(d.notes, [...NOTES]);
  assert.deepEqual(diagnose(obs), d);
  const text = formatDiagnostics(d);
  const md = diagnosticsToMarkdown(d);
  assert.equal(text, formatDiagnostics(diagnose(obs)));
  for (const n of NOTES) for (const doc of [text, md]) assert.ok(doc.includes(n.replace(/\\'/g, "'")), n);
  for (const t of ENEMY_ORDER) assert.ok(text.includes(t) && md.includes(t));
  assert.ok(md.includes('## How to read this'));
  assert.ok(!/NaN|undefined|Infinity/.test(text + md));
});

test('a real collection: counts match the telemetry, no NaN, deterministic', () => {
  const args = { seeds: [1001, 1002], styles: ['lanceHeavy'], waves: 15, knobs: PROTOCOL.botKnobs };
  const obs = collectBaselineObservations(args);
  assert.deepEqual(collectBaselineObservations(args), obs);
  assert.ok(obs.length > 0 && obs.length % ENEMY_ORDER.length === 0);
  for (const seed of args.seeds) {
    const r = playGame({ seed, bot: createStyleBot('lanceHeavy', args.knobs), mode: 'static', totalWaves: 15, telemetry: 'summary' });
    const complete = r.run.waves.filter((w) => w.complete);
    const expected = complete.reduce((n, w) => n + ENEMY_ORDER.reduce((m, t) => m + w.byType[t].spawned, 0), 0);
    assert.equal(obs.filter((x) => x.seed === seed).reduce((n, x) => n + x.units, 0), expected);
    assert.equal(new Set(obs.filter((x) => x.seed === seed).map((x) => x.wave)).size, complete.length);
    if (r.result === 'won') assert.equal(expected, r.run.totals.spawned);
  }
  for (const x of obs) for (const key of ['units', 'killed', 'leaked', 'progressSum', 'threatCost', 'leakDamage']) assert.ok(Number.isFinite(x[key]), `${key} in ${JSON.stringify(x)}`);
  const d = diagnose(obs);
  assert.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(d)));
  assert.equal(d.baseline1.overall.armoredGrunt.cells > 0, true);
  assert.equal(rewardOfCell('armoredGrunt', 10, 5), 0.025);
});
