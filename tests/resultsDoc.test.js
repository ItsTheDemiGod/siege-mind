import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildResultsDoc } from '../experiments/resultsDoc.js';
import { generate, parseResultsDocArgs, DEFAULTS, main } from '../experiments/resultsDocCli.js';
import { fmtEst, fmtRate, fmtP, fmtCI, fmtPct, fmtSigned } from '../experiments/resultsFormat.js';
import { makeAnalysis } from './figuresV4Fixtures.js';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

function inputs(mutate = () => {}) {
  const heldout = makeAnalysis('CONFIRMATORY');
  const E = (p, m) => heldout.estimands.find((e) => e.pair === p && e.metric === m);
  for (const m of ['livesLost', 'won']) Object.assign(E('adaptive2-static', m), { estimate: 0, ci95: [-0.25, 0.25] }); // the fixed text says "not detectably different"
  const training = makeAnalysis('EXPLORATORY DRY RUN', -0.125);
  const pairContrasts = [9, 5].flatMap((wave) => ['adaptive', 'adaptive2', 'counter'].map((mode) => ({ wave, mode, style: 'noSniper', type: 'shieldedBruiser', mean: 0.3125, ci95: [0.25, 0.375], seeds: 5, units: 6 })));
  const a = { heldout, training, lock: { runIndex: 1, createdAt: '2026-01-02T03:04:05.000Z', gitCommit: 'abc123', codeHash: 'def456', protocolHash: 'hash-for-tests' }, pairContrasts, rowsSha256: SHA_A, csvSha256: SHA_B, protocolHash: 'hash-for-tests' };
  mutate(a);
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
  assert.deepEqual(heads, ['Siege Mind: results of the pre-registered held-out evaluation', 'What was tested', 'Headline', 'Confirmatory results', 'Estimates', 'Contrast by wave', 'Per-pair contrasts (post hoc)', 'Replication check', 'Limits', 'What this does not show', 'Provenance']);
  assert.ok(!/[{}]/.test(doc) && !/undefined|NaN|Infinity|null/.test(doc), 'unfilled placeholder');
  for (const s of [
    '8 held-out seeds x 5 styles x 6 modes = 240 games, run once (lock run index 1)',
    'contrast 0.25, 95% CI [0.00, 0.50], Holm p 0.0300',
    'K1 (random minus static, lives lost) was 0.50 ([0.25, 0.75]) and was not supported. The training seeds had suggested 0.38 ([0.13, 0.63])',
    'separates defenses more strongly (0.40)',
    'attributes 0.50 to composition variability, 1.50 to the durability bias',
    'and 0.25 to learning on top',
    '(lives lost 0.00 [-0.25, 0.25], win rate 0.000 [-0.250, 0.250])',
    '| K1 | Composition variability costs lives | 8 | 0.50 | [0.25, 0.75] | 0.0300 | no |',
    '| K2 | Director v1 contrast | 8 | 0.25 | [0.00, 0.50] | 0.0300 | yes |',
    'primary population is the 40 units whose static game reached wave 5; wave 9 was fixed in advance although its coverage (70.0%) was below the registered 75% rule',
    '| 9 | Counter arm (reference) | noSniper -> shieldedBruiser | 0.31 | [0.25, 0.38] | 5 | 6 |',
    'The training estimates came from 8 seeds (40 units)',
    '- Protocol version 4, protocol hash hash-for-tests.',
    `sha256 of docs/results/heldout.rows.json: ${SHA_A}`,
    'created 2026-01-02T03:04:05.000Z; git commit of the run abc123; codeHash def456',
  ]) assert.ok(doc.includes(s), `missing: ${s}`);
  assert.ok(!doc.includes('| 13 | Director v1 | noSniper'), 'the per-pair table lists waves 5 and 9 only');
  assert.ok(doc.includes('Post hoc, not pre-registered; shown to see which defenses and enemy types drive the contrast.'));
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
  const est = (a, pair, metric) => a.heldout.estimands.find((e) => e.pair === pair && e.metric === metric);
  t((a) => { est(a, 'prior-random', 'livesLost').estimate = 0.25; }, /durability lean is the largest part/);
  t((a) => { est(a, 'adaptive-prior', 'livesLost').estimate = 1.5; est(a, 'prior-random', 'livesLost').estimate = 1.75; }, /learning-on-top part is small/);
  t((a) => { for (const m of ['livesLost', 'won', 'finalWave', 'leakFraction', 'penetration']) est(a, 'adaptive-prior', m).estimate = m === 'livesLost' || m === 'leakFraction' || m === 'penetration' ? 0.25 : -0.25; }, /sign of the learning-on-top part is not consistent/);
  t((a) => { est(a, 'adaptive2-static', 'won').ci95 = [0.01, 0.5]; }, /interval excludes 0/);
  t((a) => { a.heldout.coverageAtPrimary.metRule = true; }, /coverage rule was not met/);
  t((a) => { a.training.contrasts.find((c) => c.mode === 'adaptive' && c.wave === 5).estimate = 0.2; }, /wave-5 contrast was much smaller/);
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
});
