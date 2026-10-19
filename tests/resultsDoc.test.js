import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildResultsDoc } from '../experiments/resultsDoc.js';
import { pairContrasts as realPairs } from '../experiments/figuresV4/data.js';
import { PROTOCOL } from '../experiments/protocol.js';
import { generate, parseResultsDocArgs, DEFAULTS, main } from '../experiments/resultsDocCli.js';
import { fmtEst, fmtRate, fmtP, fmtCI, fmtPct, fmtSigned } from '../experiments/resultsFormat.js';
import { makeAliasedAnalysis } from './figuresV4Fixtures.js';
import { distinctRows, replicationTable, K_ALIASES } from '../experiments/figuresV4/data.js';
import { STRONG_PAIR, WEAK_PAIR, COUNTER_MIN, FEW_UNITS } from '../experiments/resultsDocParts.js';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

const PAIRS = [['noMortar', 'swarmling'], ['noSniper', 'shieldedBruiser'], ['noPoison', 'regenerator'], ['noLance', 'armoredGrunt']];
// dyadic values so every formatted string is exact: [estimate, lo, hi] per pair and mode at wave 9
const W9 = {
  adaptive: [[0.25, 0.125, 0.375], [0.3125, 0.25, 0.375], [0.0625, -0.0625, 0.1875], [0.0625, 0.03125, 0.125]],
  adaptive2: [[0.1875, 0.125, 0.25], [0.125, 0.0625, 0.1875], [0.03125, -0.0625, 0.0625], [0.03125, -0.03125, 0.0625]],
  counter: [[0.4375, 0.375, 0.5], [0.375, 0.3125, 0.4375], [0.4375, 0.375, 0.5], [0.5, 0.4375, 0.5625]],
};
const pairContrasts = () => Object.entries(W9).flatMap(([mode, vals]) => PAIRS.map(([style, type], i) => ({ wave: 9, mode, style, type, mean: vals[i][0], ci95: [vals[i][1], vals[i][2]], seeds: 5, units: 6 })));
const pairRow = (wave, mode, pair, tr, tu, ho, hu) => ({ wave, mode, pair, training: { estimate: tr, ci95: [tr - 0.0625, tr + 0.0625], seeds: 5, units: tu }, heldout: { estimate: ho, ci95: [ho - 0.0625, ho + 0.0625], seeds: 9, units: hu }, overlap: Math.abs(ho - tr) <= 0.125, sameSign: ho * tr > 0, diff: ho - tr });
const replicationPairs = (trainingUnits = 10) => [
  pairRow(5, 'adaptive', 'noLance -> armoredGrunt', 0.0625, trainingUnits, 0.25, 60),
  pairRow(5, 'adaptive', 'noMortar -> swarmling', 0.125, 40, 0.1875, 70),
  pairRow(9, 'counter', 'noSniper -> shieldedBruiser', 0.375, 35, 0.4375, 80),
];

function inputs(mutate = () => {}) {
  const heldout = makeAliasedAnalysis('CONFIRMATORY');
  const E = (p, m) => heldout.estimands.find((e) => e.pair === p && e.metric === m);
  for (const m of ['livesLost', 'won']) Object.assign(E('adaptive2-static', m), { estimate: 0, ci95: [-0.25, 0.25] }); // the fixed text says "not detectably different"
  Object.assign(E('random-static', 'finalWave'), { estimate: -0.25, ci95: [-0.375, -0.125] }); // the fixed text says random composition lowered the final wave
  const training = makeAliasedAnalysis('EXPLORATORY DRY RUN', -0.125);
  const a = { heldout, training, lock: { runIndex: 1, createdAt: '2026-01-02T03:04:05.000Z', gitCommit: 'abc123', codeHash: 'def456', protocolHash: 'hash-for-tests' }, pairContrasts: pairContrasts(), replicationPairs: replicationPairs(), distinct: null, rowsSha256: SHA_A, csvSha256: SHA_B, protocolHash: 'hash-for-tests' };
  mutate(a);
  a.distinct = a.distinct ?? distinctRows(replicationTable(a.heldout, a.training), K_ALIASES);
  return a;
}

test('the shared formatter: 2 decimals for estimates, 3 for rates, p below 0.0001, intervals', () => {
  assert.equal(fmtEst(1.436), '1.44');
  assert.equal(fmtEst(-0.004), '0.00'); // no negative zero
  assert.equal(fmtRate(0.0178), '0.018');
  assert.equal(fmtRate(-0.0004), '0.000');
  assert.equal(fmtP(0.00003), '< 0.0001');
  assert.equal(fmtP(0.6522), '0.6522');
  assert.equal(fmtP(0.0001), '0.0001');
  assert.equal(fmtCI([-0.2226, 0.3508]), '[-0.22, 0.35]');
  assert.equal(fmtCI([0.0002, 0.0178], fmtRate), '[0.000, 0.018]');
  assert.equal(fmtPct(0.7264), '72.6%');
  assert.equal(fmtSigned(0.5), '+0.50');
  assert.throws(() => fmtEst(NaN), TypeError);
  assert.throws(() => fmtEst(undefined), TypeError);
});

test('the document has every section in order, no unfilled placeholder and exact formatted numbers', () => {
  const doc = buildResultsDoc(inputs());
  const heads = [...doc.matchAll(/^(#{1,2}) (.+)$/gm)].map((m) => m[2]);
  assert.deepEqual(heads, ['Siege Mind: results of the pre-registered held-out evaluation', 'What was tested', 'Headline', 'Confirmatory results', 'Estimates', 'Contrast by wave', 'Per-pair contrasts (post hoc)', 'Replication check', 'Per-pair replication (post hoc)', 'Limits', 'What this does not show', 'Provenance']);
  assert.ok(!/[{}]/.test(doc) && !/undefined|NaN|Infinity|null/.test(doc), 'unfilled placeholder');
  for (const s of [
    '8 held-out seeds x 5 styles x 6 modes = 240 games, run once (lock run index 1)',
    "- Both Directors respond to the player's defense, mainly through two of the four counter relationships. At wave 9 the weights of Director v1 separate defenses in the predicted direction (contrast 0.20, 95% CI [",
    'Holm p 0.0300) and so do those of Director v2 (0.10, [',
    'Both confirmatory hypotheses were supported. By pairing (post hoc): noMortar -> swarmling 0.25 [0.13, 0.38] for Director v1 and 0.19 [0.13, 0.25] for Director v2; noSniper -> shieldedBruiser 0.31 [0.25, 0.38] for Director v1 and 0.13 [0.06, 0.19] for Director v2; noPoison -> regenerator 0.06 [-0.06, 0.19] for Director v1 and 0.03 [-0.06, 0.06] for Director v2; noLance -> armoredGrunt 0.06 [0.03, 0.13] for Director v1 and 0.03 [-0.03, 0.06] for Director v2. The informed counter arm, a reference, separates defenses on all four pairings (0.38 to 0.50; overall 0.40).',
    '- Random composition alone had no detectable effect on lives lost. K1 (random minus static, lives lost) was 0.50 ([0.25, 0.75]) and was not supported. That is not proof of no effect: random composition did lower the final wave reached slightly (random minus static -0.25 [-0.38, -0.13] waves, an estimate outside the confirmatory family). The training seeds had suggested 0.38 ([0.13, 0.63]) for lives lost; that estimate did not replicate.',
    "- A fixed, non-learning lean toward durable enemy types reproduces most of Director v1's added difficulty. Of v1's 2.25 extra lives lost against static, an attribution along the path static, random control, prior control, Director v1 assigns 0.50 to composition variability, 1.50 to the durability bias (the prior control: fixed weights from static baselines, no learning, no look at the defense) and 0.25 to learning on top; the last is small and its sign is not consistent across metrics (see the estimates).",
    '- Director v2 removes that bias: its lives lost and win rate are not detectably different from static (lives lost 0.00 [-0.25, 0.25], win rate 0.000 [-0.250, 0.250]) while its weights still separate defenses (K3).',
    '| K1 | Composition variability costs lives | 8 | 0.50 | [0.25, 0.75] | 0.0300 | no |',
    'primary population is the 40 units whose static game reached wave 5; wave 9 was fixed in advance although its coverage (70.0%) was below the registered 75% rule',
    '| 9 | Counter arm (reference) | noSniper -> shieldedBruiser | 0.38 | [0.31, 0.44] | 5 | 6 |',
    '| Row | Same quantity as | Training (exploratory) | Held-out | Intervals overlap | Same sign |',
    '| K1 | livesLost: random - static | 0.38 [0.13, 0.63] | 0.50 [0.25, 0.75] | yes | yes |',
    '| livesLost: random - static |  | 0.38 [0.13, 0.63] | 0.50 [0.25, 0.75] | yes | yes |',
    'The training estimates came from 8 seeds (40 units) and were used to design the confirmatory plan; where they differ from the held-out estimates, the held-out estimates are the ones to report. K1 is the clearest case.',
    '| Wave | Mode | Defense style -> enemy type | Training estimate [CI] (units) | Held-out estimate [CI] (units) | Intervals overlap |',
    '| 5 | Director v1 | noLance -> armoredGrunt | 0.06 [0.00, 0.13] (10) | 0.25 [0.19, 0.31] (60) | no |',
    'At wave 5 the per-pair estimates for Director v1 were noLance -> armoredGrunt 0.06 (10 training units) and noMortar -> swarmling 0.13 (40) in training, against 0.25 and 0.19 held-out. The larger difference between training and held-out is in noLance -> armoredGrunt (held-out minus training 0.19); the other pair differs by 0.06. This was not investigated further.',
    'noLance -> armoredGrunt had only 10 training units at wave 5.',
    'held-out; the per-pair replication table shows where the two differ and the gap was not investigated further.',
    '- The attribution follows one path through the arms (static, random control, prior control, Director v1); the three parts add up exactly, but a different path would split the total differently.',
    '- Protocol version 4, protocol hash hash-for-tests.',
    `sha256 of docs/results/heldout.rows.json: ${SHA_A}`,
    'created 2026-01-02T03:04:05.000Z; git commit of the run abc123; codeHash def456',
  ]) assert.ok(doc.includes(s), `missing: ${s}`);
  assert.ok(!doc.includes('noMortar -> swarmling had only'), 'a pair with enough training units gets no thin-data sentence');
  for (const old of ['much smaller', 'did not cost lives', 'Most of Director v1', 'came from a fixed lean']) assert.ok(!doc.includes(old), `old wording: ${old}`);
  assert.ok(!doc.includes('| 13 | Director v1 | noSniper'), 'the per-pair table lists waves 5 and 9 only');
  assert.ok(doc.includes('Post hoc, not pre-registered; shown to see which defenses and enemy types drive the contrast.'));
});

test('the distinct-row sentence counts K1-K3 once and lists the distinct rows without overlap', () => {
  const a = inputs();
  const rows = replicationTable(a.heldout, a.training);
  const apart = rows.filter((r) => !['K1', 'K2', 'K3'].includes(r.id) && !r.overlap).map((r) => `${r.group}: ${r.label}`);
  const doc = buildResultsDoc(a);
  assert.ok(doc.includes(`${apart.length} of 25 distinct rows (28 rows; K1, K2 and K3 repeat other rows and are counted once) have intervals that do not overlap: ${apart.length ? apart.join('; ') : 'none'}.`));
  const doc2 = buildResultsDoc(inputs((x) => { x.training = makeAliasedAnalysis('EXPLORATORY DRY RUN', -0.75); }));
  assert.ok(doc2.includes('livesLost: random - static') && /\d+ of 25 distinct rows/.test(doc2));
  assert.ok(!/of 25 distinct rows[^\n]*: K1/.test(doc2), 'K1 is counted through its alias row, not twice');
});

test('the thin-training sentence appears only for pairs below FEW_UNITS', () => {
  assert.equal(FEW_UNITS, 30);
  assert.ok(!buildResultsDoc(inputs((a) => { a.replicationPairs = replicationPairs(FEW_UNITS); })).includes('had only'));
  assert.ok(buildResultsDoc(inputs((a) => { a.replicationPairs = replicationPairs(FEW_UNITS - 1); })).includes('noLance -> armoredGrunt had only 29 training units at wave 5.'));
  const modes = buildResultsDoc(inputs((a) => { a.replicationPairs = [...replicationPairs(10), pairRow(5, 'counter', 'noLance -> armoredGrunt', 0.0625, 12, 0.25, 60)]; }));
  assert.ok(modes.includes('noLance -> armoredGrunt had only 10 to 12 training units at wave 5.'));
});

test('the named wording thresholds', () => {
  assert.deepEqual([STRONG_PAIR, WEAK_PAIR, COUNTER_MIN, FEW_UNITS], [0.10, 0.05, 0.30, 30]);
});

test('the document is deterministic', () => {
  assert.equal(buildResultsDoc(inputs()), buildResultsDoc(inputs()));
});

test('the guards refuse flipped flags, a wrong label, a missing lock and stale fixed text', () => {
  const t = (mut, re) => assert.throws(() => buildResultsDoc(inputs(mut)), re);
  t((a) => { a.heldout.confirmatory[1].supported = false; }, /K1 not supported and K2, K3 supported, got K1:false K2:false K3:true/);
  t((a) => { a.heldout.confirmatory[0].supported = true; }, /got K1:true K2:true K3:true/);
  t((a) => { a.heldout.confirmatory[2].supported = false; }, /got K1:false K2:true K3:false/);
  t((a) => { a.heldout.label = 'EXPLORATORY DRY RUN'; }, /CONFIRMATORY/);
  t((a) => { a.lock = null; }, /lock file is missing or incomplete/);
  t((a) => { a.lock.runIndex = 0; }, /lock file is missing or incomplete/);
  t((a) => { a.lock.protocolHash = 'other'; }, /protocol hash of the lock, the analysis and the argument differ/);
  t((a) => { a.rowsSha256 = 'xyz'; }, /64-character hex/);
  t((a) => { a.pairContrasts = []; }, /per-pair contrasts are missing/);
  t((a) => { a.replicationPairs = []; }, /per-pair replication rows are missing/);
  assert.throws(() => buildResultsDoc({ ...inputs(), distinct: null }), /distinct-row split is missing/);
  const est = (a, pair, metric) => a.heldout.estimands.find((e) => e.pair === pair && e.metric === metric);
  t((a) => { est(a, 'prior-random', 'livesLost').estimate = 0.25; }, /durability lean is the largest part/);
  t((a) => { est(a, 'adaptive-prior', 'livesLost').estimate = 1.5; est(a, 'prior-random', 'livesLost').estimate = 1.75; }, /learning-on-top part is small/);
  t((a) => { for (const m of ['livesLost', 'won', 'finalWave', 'leakFraction', 'penetration']) est(a, 'adaptive-prior', m).estimate = m === 'livesLost' || m === 'leakFraction' || m === 'penetration' ? 0.25 : -0.25; }, /sign of the learning-on-top part is not consistent/);
  t((a) => { est(a, 'adaptive2-static', 'won').ci95 = [0.01, 0.5]; }, /interval excludes 0/);
  t((a) => { a.heldout.coverageAtPrimary.metRule = true; }, /coverage rule was not met/);
});

test('one guard per pairing, counter and final-wave claim', () => {
  const pair = (a, mode, style) => a.pairContrasts.find((p) => p.mode === mode && p.style === style);
  const t = (mut, re) => assert.throws(() => buildResultsDoc(inputs(mut)), re);
  t((a) => { pair(a, 'adaptive', 'noMortar').mean = STRONG_PAIR - 0.01; }, /both Directors separate noMortar -> swarmling clearly does not hold for adaptive/);
  t((a) => { pair(a, 'adaptive2', 'noSniper').ci95 = [-0.01, 0.2]; }, /both Directors separate noSniper -> shieldedBruiser clearly does not hold for adaptive2/);
  t((a) => { pair(a, 'adaptive2', 'noPoison').mean = WEAK_PAIR; }, /Director v2 barely separates noPoison -> regenerator does not hold/);
  t((a) => { pair(a, 'adaptive', 'noLance').mean = STRONG_PAIR; }, /Director v1 separates noLance -> armoredGrunt less than clearly does not hold/);
  t((a) => { pair(a, 'counter', 'noSniper').mean = COUNTER_MIN - 0.01; }, /counter arm separates noSniper -> shieldedBruiser \(at least 0.3\) does not hold/);
  t((a) => { a.pairContrasts = a.pairContrasts.filter((p) => !(p.mode === 'adaptive2' && p.style === 'noLance')); }, /missing per-pair contrast adaptive2 noLance -> armoredGrunt at wave 9/);
  const fw = (a) => a.heldout.estimands.find((e) => e.pair === 'random-static' && e.metric === 'finalWave');
  t((a) => { fw(a).estimate = 0.25; fw(a).ci95 = [0.125, 0.375]; }, /random composition lowered the final wave does not hold/);
  t((a) => { fw(a).ci95 = [-0.375, 0.0625]; }, /random composition lowered the final wave does not hold/);
  t((a) => { a.replicationPairs = a.replicationPairs.filter((r) => r.pair !== 'noMortar -> swarmling'); }, /exactly two Director v1 pairs, found 1/);
  assert.throws(() => inputs((a) => { a.heldout.confirmatory[1].estimate += 0.001; }), /K2 is not identical to 'contrast: adaptive at wave 9'/);
});

test('the CLI parses its arguments and writes nothing when a guard fails', () => {
  assert.deepEqual(parseResultsDocArgs([]), DEFAULTS);
  assert.equal(parseResultsDocArgs(['--out=a.md']).out, 'a.md');
  assert.throws(() => parseResultsDocArgs(['--x=1']), /unknown argument/);
  const dir = mkdtempSync(join(tmpdir(), 'resdoc-'));
  try {
    const out = join(dir, 'R.md');
    const [log, err] = [console.log, console.error];
    console.log = () => {}; console.error = () => {};
    let code;
    try { code = main([`--lock=${join(dir, 'missing.json')}`, `--out=${out}`]); } finally { console.log = log; console.error = err; }
    assert.equal(code, 1);
    assert.ok(!existsSync(out));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the real documents produce RESULTS.md with the exact K1-K3 estimates and Holm p-values', () => {
  const real = JSON.parse(readFileSync(new URL('../docs/results/heldout-confirmatory.json', import.meta.url), 'utf8'));
  const doc = generate({ ...DEFAULTS, heldout: 'docs/results/heldout-confirmatory.json' });
  for (const k of real.confirmatory) {
    const p = k.pHolm < 0.0001 ? '< 0.0001' : k.pHolm.toFixed(4);
    const row = `| ${k.id} | ${k.label} | ${k.n} | ${k.estimate.toFixed(2)} | [${k.ci95[0].toFixed(2)}, ${k.ci95[1].toFixed(2)}] | ${p} | ${k.supported ? 'yes' : 'no'} |`;
    assert.ok(doc.includes(row), `missing row: ${row}`);
  }
  assert.ok(doc.includes(`K1 (random minus static, lives lost) was ${real.confirmatory[0].estimate.toFixed(2)}`));
  assert.ok(doc.includes(`contrast ${real.confirmatory[1].estimate.toFixed(2)}, 95% CI`));
  assert.ok(!/[{}]/.test(doc.replace(/`[^`]*`/g, '')) && !/undefined|NaN/.test(doc));
  const rows = JSON.parse(readFileSync(new URL('../docs/results/heldout.rows.json', import.meta.url), 'utf8')).rows;
  for (const p of realPairs(rows, PROTOCOL, { waves: [9], modes: ['adaptive', 'adaptive2'] })) assert.ok(doc.includes(`${p.mean.toFixed(2)} [${p.ci95[0].toFixed(2)}, ${p.ci95[1].toFixed(2)}]`), `${p.mode} ${p.style}`);
  const fw = real.estimands.find((e) => e.pair === 'random-static' && e.metric === 'finalWave');
  assert.ok(doc.includes(`random minus static ${fw.estimate.toFixed(2)} [${fw.ci95[0].toFixed(2)}, ${fw.ci95[1].toFixed(2)}] waves`));
  assert.ok(doc.includes('## Per-pair replication (post hoc)') && doc.includes('| Same quantity as |'));
});
