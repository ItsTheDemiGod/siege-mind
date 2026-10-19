import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadFigureInputs, replicationTable, pairContrasts, loadTrainingRows, replicationPairTable, distinctRows, rowLabel } from '../experiments/figuresV4/data.js';
import { analyzeConfirmatory } from '../experiments/confirmatory.js';
import { makeAnalysis, syntheticRows, FAST_PROTOCOL } from './figuresV4Fixtures.js';

const held = () => makeAnalysis('CONFIRMATORY');
const train = (shift = 0.125) => makeAnalysis('EXPLORATORY DRY RUN', shift);

test('loadFigureInputs accepts a matching pair and returns the shared keys', () => {
  const r = loadFigureInputs({ heldout: held(), training: train() });
  assert.equal(r.pairs.length, 40);
  assert.equal(r.contrasts.length, 15);
  assert.equal(r.pairs[0], 'random-static|livesLost');
});

test('loadFigureInputs names every kind of problem', () => {
  const ok = { heldout: held(), training: train() };
  const bad = (mut, re) => { const i = { heldout: held(), training: train() }; mut(i); assert.throws(() => loadFigureInputs(i), re); };
  assert.doesNotThrow(() => loadFigureInputs(ok));
  assert.throws(() => loadFigureInputs({ heldout: train(), training: held() }), /held-out analysis: label must be 'CONFIRMATORY'/);
  bad((i) => { i.training.label = 'CONFIRMATORY'; }, /training analysis: label must be 'EXPLORATORY DRY RUN'/);
  bad((i) => { i.heldout.protocolVersion = 3; }, /protocolVersion must be 4, got 3/);
  bad((i) => { i.heldout.completeness.complete = false; }, /held-out analysis: the analysis is not complete/);
  bad((i) => { delete i.training.contrasts; }, /training analysis: missing contrasts/);
  bad((i) => { i.heldout.confirmatory.pop(); }, /K1, K2, K3 in order/);
  bad((i) => { i.training.protocolHash = 'other'; }, /different protocol hashes/);
  bad((i) => { i.training.estimands.pop(); }, /different estimand pairs or metrics/);
  bad((i) => { i.training.contrasts.pop(); }, /different contrast waves or modes/);
  bad((i) => { i.heldout.estimands[3].estimate = null; }, /estimand .* has no estimate/);
  bad((i) => { i.training.contrasts[2].estimate = null; }, /contrast .* has no estimate/);
  assert.throws(() => loadFigureInputs({ heldout: null, training: train() }), /not an analysis object/);
});

test('replicationTable returns the 28 rows with exact overlap and sign flags', () => {
  const rows = replicationTable(held(), train(0.125));
  assert.equal(rows.length, 28);
  assert.deepEqual(rows.slice(0, 3).map((r) => r.id), ['K1', 'K2', 'K3']);
  assert.deepEqual(rows.map((r) => r.group).filter((g, i, a) => a.indexOf(g) === i), ['confirmatory', 'livesLost', 'won', 'contrast']);
  assert.equal(rows.filter((r) => r.group === 'livesLost').length, 8);
  assert.equal(rows.filter((r) => r.group === 'contrast').length, 9);
  assert.deepEqual(rows.filter((r) => r.group === 'contrast').slice(0, 3).map((r) => r.id), ['adaptive@5', 'adaptive2@5', 'counter@5']);
  const k1 = rows[0];
  assert.deepEqual(k1.heldout, { estimate: 0.5, ci95: [0.25, 0.75] });
  assert.deepEqual(k1.training, { estimate: 0.625, ci95: [0.375, 0.875] });
  assert.equal(k1.overlap, true);
  assert.equal(k1.sameSign, true);
  assert.ok(rows.every((r) => r.overlap && r.sameSign));
});

test('replicationTable flags intervals that do not overlap and signs that differ', () => {
  const rows = replicationTable(held(), train(-0.75));
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.deepEqual(byId.K1.training, { estimate: -0.25, ci95: [-0.5, 0] });
  assert.equal(byId.K1.overlap, false); // [0.25, 0.75] against [-0.5, 0]
  assert.equal(byId.K1.sameSign, false);
  assert.equal(byId.K3.overlap, false); // [-0.125, 0.375] against [-0.875, -0.375]
  assert.equal(byId['adaptive@5'].sameSign, false); // 0.2 against -0.55
  const touching = replicationTable(held(), train(0.5)); // K1 held-out [0.25, 0.75], training [0.75, 1.25]: sharing an endpoint overlaps
  assert.equal(touching[0].overlap, true);
  assert.deepEqual(replicationTable(held(), train(0.5)), touching);
});

const rowsOf = () => syntheticRows({ seeds: 4, jitter: 0.1, earlyLoss: { style: 'noPoison', seed: 4 } });

test('pairContrasts gives exact per-pair means, seed counts and population restriction', () => {
  const out = pairContrasts(rowsOf(), FAST_PROTOCOL, { waves: [9], modes: ['adaptive'] });
  assert.deepEqual(out.map((p) => `${p.style}->${p.type}`), ['noLance->armoredGrunt', 'noMortar->swarmling', 'noPoison->regenerator', 'noSniper->shieldedBruiser']);
  const expected = [0.25, 0.35, 0.4 + 0.1 * (2 / 3), 0.55]; // effect 0.2 * (1 + i/2) plus 0.1 * mean(seed % 2) over the seeds in the population
  out.forEach((p, i) => {
    assert.ok(Math.abs(p.mean - expected[i]) < 1e-6, `${p.style}: ${p.mean}`);
    assert.ok(p.ci95[0] <= p.mean && p.mean <= p.ci95[1]);
    assert.equal(p.wave, 9);
    assert.equal(p.mode, 'adaptive');
  });
  assert.deepEqual(out.map((p) => p.seeds), [4, 4, 3, 4]); // the early-loss unit is outside the population
  assert.deepEqual(out.map((p) => p.units), [4, 4, 3, 4]);
});

test('pairContrasts keeps only unlocked pairs and is deterministic', () => {
  const a = pairContrasts(rowsOf(), FAST_PROTOCOL, { waves: [5, 9], modes: ['adaptive', 'counter'] });
  assert.deepEqual(a, pairContrasts(rowsOf(), FAST_PROTOCOL, { waves: [5, 9], modes: ['adaptive', 'counter'] }));
  const w5 = a.filter((p) => p.wave === 5 && p.mode === 'counter');
  assert.deepEqual(w5.map((p) => p.type), ['armoredGrunt', 'swarmling']); // regenerator and bruiser are locked at wave 5
  assert.equal(a.filter((p) => p.wave === 9 && p.mode === 'counter').length, 4);
  assert.ok(Math.abs(w5[0].mean - (0.4 + 0.05)) < 1e-6);
});

test('pairContrasts re-aggregates to the reported contrast and throws when the aggregate differs', () => {
  const rows = rowsOf();
  const analysis = analyzeConfirmatory(rows, { protocol: FAST_PROTOCOL });
  assert.doesNotThrow(() => pairContrasts(rows, FAST_PROTOCOL, { waves: [5, 9, 13], modes: ['adaptive', 'adaptive2', 'counter'], analysis }));
  const wrong = JSON.parse(JSON.stringify(analysis));
  wrong.contrasts.find((c) => c.wave === 9 && c.mode === 'adaptive').estimate += 0.01;
  assert.throws(() => pairContrasts(rows, FAST_PROTOCOL, { waves: [9], modes: ['adaptive'], analysis: wrong }), /do not reproduce the reported aggregate at wave 9 for adaptive/);
  assert.throws(() => pairContrasts(rows, FAST_PROTOCOL, { waves: [9], modes: ['adaptive'], analysis: { contrasts: [] } }), /do not reproduce the reported aggregate/);
});

const ALIASES = { K1: 'livesLost: random - static', K2: 'contrast: adaptive at wave 9', K3: 'contrast: adaptive2 at wave 9' };
/** An analysis whose K rows repeat their alias rows exactly, as in the real data. */
function aliased(label, shift) {
  const a = makeAnalysis(label, shift);
  Object.assign(a.confirmatory[0], { estimate: a.estimands[0].estimate, ci95: a.estimands[0].ci95 });
  const c = (mode) => a.contrasts.find((x) => x.mode === mode && x.wave === 9);
  Object.assign(a.confirmatory[1], { estimate: c('adaptive').estimate, ci95: c('adaptive').ci95 });
  Object.assign(a.confirmatory[2], { estimate: c('adaptive2').estimate, ci95: c('adaptive2').ci95 });
  return a;
}

test('distinctRows: 28 rows with three aliases give 25 distinct rows; a non-identical alias throws', () => {
  const rows = replicationTable(aliased('CONFIRMATORY', 0), aliased('EXPLORATORY DRY RUN', 0.125));
  assert.equal(rowLabel(rows[0]), 'K1');
  assert.equal(rowLabel(rows[3]), 'livesLost: random - static');
  const d = distinctRows(rows, ALIASES);
  assert.equal(rows.length, 28);
  assert.equal(d.distinct.length, 25);
  assert.deepEqual(d.duplicates, [{ id: 'K1', alias: ALIASES.K1 }, { id: 'K2', alias: ALIASES.K2 }, { id: 'K3', alias: ALIASES.K3 }]);
  assert.ok(d.distinct.every((r) => !['K1', 'K2', 'K3'].includes(r.id)));
  assert.deepEqual(distinctRows(rows, ALIASES), d);
  const bad = replicationTable(aliased('CONFIRMATORY', 0), aliased('EXPLORATORY DRY RUN', 0.125));
  bad[1].heldout.ci95 = [bad[1].heldout.ci95[0], bad[1].heldout.ci95[1] + 0.001];
  assert.throws(() => distinctRows(bad, ALIASES), /K2 is not identical to 'contrast: adaptive at wave 9'/);
  assert.throws(() => distinctRows(rows, { K1: 'nope' }), /row not found/);
});

test('loadTrainingRows accepts the train split and names every problem', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trrows-'));
  try {
    const write = (o) => { const p = join(dir, 'r.json'); writeFileSync(p, JSON.stringify(o)); return p; };
    const rows = syntheticRows({ seeds: 20, firstSeed: 1001 });
    assert.equal(loadTrainingRows(write({ set: 'tuning', rows })).length, 600);
    assert.throws(() => loadTrainingRows(write({ set: 'heldout', rows })), /must come from the tuning set/);
    assert.throws(() => loadTrainingRows(write({ set: 'tuning', rows: [...rows, { ...rows[0], seed: 1021 }] })), /train split \(seeds 1001-1020\); 1 rows/);
    assert.throws(() => loadTrainingRows(write({ set: 'tuning', rows: rows.slice(1) })), /missing units, for example/);
    assert.throws(() => loadTrainingRows(write({ set: 'tuning', rows: [...rows, rows[5]] })), /duplicate unit/);
    assert.throws(() => loadTrainingRows(write({ set: 'tuning' })), /no rows array/);
    assert.throws(() => loadTrainingRows(join(dir, 'missing.json')), /cannot read the training rows/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('replicationPairTable gives exact per-pair estimates, units, overlap, sign and difference; locked pairs are excluded', () => {
  const held = syntheticRows({ seeds: 4, jitter: 0.1 });
  const trainRows = syntheticRows({ seeds: 4, jitter: 0, firstSeed: 1001 });
  const t = replicationPairTable(held, trainRows, FAST_PROTOCOL);
  assert.equal(t.length, 18); // wave 5: two unlocked pairs, wave 9: four, for three modes
  assert.deepEqual(t.filter((r) => r.wave === 5 && r.mode === 'adaptive').map((r) => r.pair), ['noLance -> armoredGrunt', 'noMortar -> swarmling']);
  assert.ok(!t.some((r) => r.wave === 5 && /regenerator|shieldedBruiser/.test(r.pair)));
  const r = t.find((x) => x.wave === 9 && x.mode === 'adaptive' && x.pair === 'noLance -> armoredGrunt');
  assert.ok(Math.abs(r.heldout.estimate - 0.25) < 1e-6 && Math.abs(r.training.estimate - 0.2) < 1e-6 && Math.abs(r.diff - 0.05) < 1e-6);
  assert.deepEqual([r.heldout.units, r.training.units, r.heldout.seeds, r.training.seeds], [4, 4, 4, 4]);
  assert.equal(r.overlap, true);
  assert.equal(r.sameSign, true);
  const c = t.find((x) => x.wave === 5 && x.mode === 'counter' && x.pair === 'noMortar -> swarmling');
  assert.ok(Math.abs(c.heldout.estimate - 0.65) < 1e-6 && Math.abs(c.training.estimate - 0.6) < 1e-6); // 0.4 * 1.5 plus 0.05 jitter; 0.6 without
  assert.deepEqual(replicationPairTable(held, trainRows, FAST_PROTOCOL), t);
});

test('replicationPairTable flags intervals that do not overlap and signs that differ', () => {
  const held = syntheticRows({ seeds: 4, jitter: 0.1 });
  const trainRows = syntheticRows({ seeds: 4, jitter: 0, firstSeed: 1001 });
  for (const row of trainRows) if (row.style === 'noLance' && row.mode === 'adaptive') for (const tl of row.tiltByWave) if (tl) tl.armoredGrunt = 0.7;
  const r = replicationPairTable(held, trainRows, FAST_PROTOCOL).find((x) => x.wave === 9 && x.mode === 'adaptive' && x.pair === 'noLance -> armoredGrunt');
  assert.ok(Math.abs(r.training.estimate + 0.3) < 1e-6);
  assert.equal(r.overlap, false);
  assert.equal(r.sameSign, false);
  assert.ok(Math.abs(r.diff - 0.55) < 1e-6);
  const noTrain = syntheticRows({ seeds: 4, firstSeed: 1001 }).filter((x) => x.style !== 'noSniper');
  assert.throws(() => replicationPairTable(held, noTrain, FAST_PROTOCOL), /has no training estimate/);
});
