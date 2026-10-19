// Wording pieces of docs/RESULTS.md that make claims about the pairings, the final wave and the per-pair replication. Every claim is guarded: the builders
// throw when the data do not support the sentence. The thresholds are the only numbers written in this file (they define the words "strong" and "weak").
import { MODE_LABEL } from './figuresV4/palette.js';
import { estimandOf } from './resultsDocTables.js';
import { fmtEst, fmtCI, fmtP } from './resultsFormat.js';

/** A pair contrast at wave 9 of at least this size counts as a clear separation (contrast units). */
export const STRONG_PAIR = 0.10;
/** A Director v2 pair contrast below this counts as barely separating. */
export const WEAK_PAIR = 0.05;
/** Every counter-arm pair contrast must reach this for the sentence "separates defenses on all four pairings". */
export const COUNTER_MIN = 0.30;
/** Fewer training units than this at a pair is flagged as a thin training estimate. */
export const FEW_UNITS = 30;

const fail = (msg) => { throw new Error(`results document: ${msg}`); };
const STRONG = [['noMortar', 'swarmling'], ['noSniper', 'shieldedBruiser']];
const WEAK = [['noPoison', 'regenerator'], ['noLance', 'armoredGrunt']];

/** @returns {object} the per-pair contrast of (wave, mode, style, type) @throws {Error} when absent */
export function pairAt(pairs, wave, mode, style, type) {
  return pairs.find((p) => p.wave === wave && p.mode === mode && p.style === style && p.type === type) ?? fail(`missing per-pair contrast ${mode} ${style} -> ${type} at wave ${wave}`);
}

/** Throws unless the pairing claims of headline bullet 1 and the final-wave claim of bullet 2 hold. @param {object} h held-out analysis @param {object[]} pairs held-out pair contrasts */
export function assertPairClaims(h, pairs) {
  const P = (mode, [s, t]) => pairAt(pairs, 9, mode, s, t);
  for (const pr of STRONG) for (const mode of ['adaptive', 'adaptive2']) {
    const p = P(mode, pr);
    if (!(p.mean >= STRONG_PAIR && p.ci95[0] > 0)) fail(`the claim that both Directors separate ${pr.join(' -> ')} clearly does not hold for ${mode} (estimate ${p.mean}, interval ${p.ci95})`);
  }
  for (const pr of WEAK) {
    if (!(P('adaptive2', pr).mean < WEAK_PAIR)) fail(`the claim that Director v2 barely separates ${pr.join(' -> ')} does not hold`);
    if (!(P('adaptive', pr).mean < STRONG_PAIR)) fail(`the claim that Director v1 separates ${pr.join(' -> ')} less than clearly does not hold`);
  }
  for (const pr of [...STRONG, ...WEAK]) if (!(P('counter', pr).mean >= COUNTER_MIN)) fail(`the claim that the counter arm separates ${pr.join(' -> ')} (at least ${COUNTER_MIN}) does not hold`);
  const fw = estimandOf(h, 'random-static', 'finalWave');
  if (!(fw.estimate < 0 && fw.ci95[1] < 0)) fail('the claim that random composition lowered the final wave does not hold (the interval does not lie below 0)');
}

/** Headline bullet 1 text. @returns {string} */
export function headlinePairs(h, pairs) {
  const [, k2, k3] = h.confirmatory;
  const one = (pr) => { const a = pairAt(pairs, 9, 'adaptive', ...pr); const b = pairAt(pairs, 9, 'adaptive2', ...pr); return `${pr.join(' -> ')} ${fmtEst(a.mean)} ${fmtCI(a.ci95)} for ${MODE_LABEL.adaptive} and ${fmtEst(b.mean)} ${fmtCI(b.ci95)} for ${MODE_LABEL.adaptive2}`; };
  const counter = [...STRONG, ...WEAK].map((pr) => pairAt(pairs, 9, 'counter', ...pr).mean);
  const overall = h.contrasts.find((c) => c.mode === 'counter' && c.wave === 9).estimate;
  return `Both Directors respond to the player's defense, mainly through two of the four counter relationships. At wave 9 the weights of Director v1 separate defenses in the predicted direction (contrast ${fmtEst(k2.estimate)}, 95% CI ${fmtCI(k2.ci95)}, Holm p ${fmtP(k2.pHolm)}) and so do those of Director v2 (${fmtEst(k3.estimate)}, ${fmtCI(k3.ci95)}, Holm p ${fmtP(k3.pHolm)}). Both confirmatory hypotheses were supported. By pairing (post hoc): ${[...STRONG, ...WEAK].map(one).join('; ')}. The informed counter arm, a reference, separates defenses on all four pairings (${fmtEst(Math.min(...counter))} to ${fmtEst(Math.max(...counter))}; overall ${fmtEst(overall)}).`;
}

/** Per-pair replication section body (table rows are built by the caller). @param {object[]} rows replicationPairTable rows @returns {{wave5: string, thin: string}} */
export function pairReplicationText(rows) {
  const v1 = rows.filter((r) => r.wave === 5 && r.mode === 'adaptive');
  if (v1.length !== 2) fail(`the wave-5 paragraph needs exactly two Director v1 pairs, found ${v1.length}`);
  const [a, b] = v1;
  const [big, small] = Math.abs(a.diff) >= Math.abs(b.diff) ? [a, b] : [b, a];
  const wave5 = `At wave 5 the per-pair estimates for Director v1 were ${a.pair} ${fmtEst(a.training.estimate)} (${a.training.units} training units) and ${b.pair} ${fmtEst(b.training.estimate)} (${b.training.units}) in training, against ${fmtEst(a.heldout.estimate)} and ${fmtEst(b.heldout.estimate)} held-out. The larger difference between training and held-out is in ${big.pair} (held-out minus training ${fmtEst(big.diff)}); the other pair differs by ${fmtEst(small.diff)}. This was not investigated further.`;
  const groups = new Map(); // one sentence per (wave, pair): the training unit counts differ a little between modes
  for (const r of rows.filter((x) => x.training.units < FEW_UNITS)) {
    const k = `${r.wave}|${r.pair}`;
    (groups.get(k) ?? groups.set(k, { wave: r.wave, pair: r.pair, n: [] }).get(k)).n.push(r.training.units);
  }
  const range = (ns) => (Math.min(...ns) === Math.max(...ns) ? `${Math.min(...ns)}` : `${Math.min(...ns)} to ${Math.max(...ns)}`);
  const thin = [...groups.values()].map((g) => `${g.pair} had only ${range(g.n)} training units at wave ${g.wave}.`).join(' ');
  return { wave5, thin };
}
