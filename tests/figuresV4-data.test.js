import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFigureInputs, replicationTable, pairContrasts } from '../experiments/figuresV4/data.js';
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
