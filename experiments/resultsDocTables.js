// Tables and guards of the generated results document. Everything is read from the analysis objects through the shared formatter (resultsFormat.js).
import { MODE_LABEL } from './figuresV4/palette.js';
import { loadFigureInputs, replicationTable } from './figuresV4/data.js';
import { fmtEst, fmtRate, fmtP, fmtCI, fmtPct } from './resultsFormat.js';

export const METRIC_TITLE = Object.freeze({ livesLost: 'Lives lost (a lost game counts as 20)', won: 'Win rate', finalWave: 'Final wave reached', leakFraction: 'Leaked threat fraction', penetration: 'Mean path progress (penetration)' });
export const METRIC_FMT = Object.freeze({ livesLost: fmtEst, won: fmtRate, finalWave: fmtEst, leakFraction: fmtRate, penetration: fmtRate });
export const ESTIMATE_METRICS = ['finalWave', 'leakFraction', 'penetration', 'won']; // the four tables after the lives-lost table
const HARDER_IF_POSITIVE = { livesLost: true, won: false, finalWave: false, leakFraction: true, penetration: true };

const fail = (msg) => { throw new Error(`results document: ${msg}`); };
const table = (headers, rows) => [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const label = (m) => MODE_LABEL[m];
export const pairName = (a, b) => `${label(a)} - ${label(b)}`;

/** @returns {object} the estimand entry for (pair, metric) @throws {Error} when absent */
export function estimandOf(a, pair, metric) {
  const e = a.estimands.find((x) => x.pair === pair && x.metric === metric);
  return e ?? fail(`missing estimand ${pair} ${metric}`);
}
/** @returns {object} the contrast entry for (mode, wave) @throws {Error} when absent */
export function contrastOf(a, mode, wave) {
  const c = a.contrasts.find((x) => x.mode === mode && x.wave === wave);
  return c ?? fail(`missing contrast ${mode} wave ${wave}`);
}

/**
 * Throws when the fixed text of the document would be wrong for these data. The supported flags are the main guard; the other checks cover every claim
 * the fixed sentences make about the data (direction, size, mixed sign, overlap with zero, coverage rule).
 * @param {object} h held-out analysis @param {object} t training analysis
 */
export function assertFixedTextHolds(h, t) {
  if (h.label !== 'CONFIRMATORY') fail(`the held-out analysis is labelled '${String(h.label)}', not 'CONFIRMATORY'`);
  const flags = h.confirmatory.map((k) => `${k.id}:${k.supported}`).join(' ');
  if (flags !== 'K1:false K2:true K3:true') fail(`the fixed text needs K1 not supported and K2, K3 supported, got ${flags}`);
  const E = (p, m) => estimandOf(h, p, m);
  const total = E('adaptive-static', 'livesLost').estimate;
  const [rs, pr, ap] = [E('random-static', 'livesLost').estimate, E('prior-random', 'livesLost').estimate, E('adaptive-prior', 'livesLost').estimate];
  if (!(pr > 0 && pr > rs && pr > Math.abs(ap))) fail('the fixed text says the fixed durability lean is the largest part of the attribution, but prior - random is not');
  if (!(Math.abs(ap) < Math.abs(total) / 2)) fail('the fixed text says the learning-on-top part is small, but it is at least half of the total');
  const dirs = Object.keys(HARDER_IF_POSITIVE).map((m) => { const x = E('adaptive-prior', m).estimate; return x === 0 ? 0 : (x > 0) === HARDER_IF_POSITIVE[m] ? 1 : -1; });
  if (!(dirs.includes(1) && dirs.includes(-1))) fail('the fixed text says the sign of the learning-on-top part is not consistent across metrics, but it is');
  for (const m of ['livesLost', 'won']) { const e = E('adaptive2-static', m); if (!(e.ci95[0] <= 0 && e.ci95[1] >= 0)) fail(`the fixed text says Director v2 is not detectably different from static, but the ${m} interval excludes 0`); }
  if (!(contrastOf(h, 'counter', 9).estimate > h.confirmatory[1].estimate)) fail('the fixed text says the counter arm separates defenses more strongly than Director v1, but it does not at wave 9');
  if (h.coverageAtPrimary.metRule !== false) fail('the fixed text says the coverage rule was not met, but the computed coverage met it');
  if (!(contrastOf(t, 'adaptive', 5).estimate < contrastOf(h, 'adaptive', 5).estimate / 2)) fail('the fixed text says the wave-5 contrast was much smaller on training data, but it is not');
}

export function confirmatoryTable(h) {
  return table(['ID', 'Hypothesis', 'Seeds', 'Estimate', '95% CI', 'Holm p', 'Supported'], h.confirmatory.map((k) => [k.id, k.label, k.n, fmtEst(k.estimate), fmtCI(k.ci95), fmtP(k.pHolm), k.supported ? 'yes' : 'no']));
}

/** One table of the eight estimand pairs for one metric. */
export function estimandTable(h, metric) {
  const f = METRIC_FMT[metric];
  return `**${METRIC_TITLE[metric]}**\n\n${table(['Pair', 'Estimate', '95% CI'], h.estimands.filter((e) => e.metric === metric).map((e) => [pairName(e.a, e.b), f(e.estimate), fmtCI(e.ci95, f)]))}`;
}

export function contrastTable(h) {
  return table(['Wave', 'Mode', 'Estimate', '95% CI', 'Coverage', 'Seeds', 'Zero check'], h.contrasts.map((c) => [c.wave, label(c.mode), fmtEst(c.estimate), fmtCI(c.ci95), `${fmtPct(c.coverage)} (${c.unitsObserved}/${c.populationUnits})`, c.n, c.zeroCheck === undefined ? '' : c.zeroCheck ? 'zero, as constructed' : 'NOT ZERO']));
}

export function matchedTable(h) {
  return table(['Wave', 'Mode', 'Matched units', 'Seeds', 'Estimate', '95% CI'], h.contrasts.filter((c) => c.matched).map((c) => [c.wave, label(c.mode), c.matched.units, c.matched.n, fmtEst(c.matched.estimate), fmtCI(c.matched.ci95)]));
}

export function pairTable(pairs, waves) {
  return table(['Wave', 'Mode', 'Defense style -> enemy type', 'Estimate', '95% CI', 'Seeds', 'Units'], pairs.filter((p) => waves.includes(p.wave)).map((p) => [p.wave, label(p.mode), `${p.style} -> ${p.type}`, fmtEst(p.mean), fmtCI(p.ci95), p.seeds, p.units]));
}

/** @returns {{markdown: string, apart: string[], total: number}} the replication table and the ids of the rows whose intervals do not overlap */
export function replicationMarkdown(h, t) {
  const rows = replicationTable(h, t);
  const f = (r) => (r.group === 'won' ? fmtRate : fmtEst);
  const cell = (r, side) => `${f(r)(r[side].estimate)} ${fmtCI(r[side].ci95, f(r))}`;
  const markdown = table(['Row', 'Training (exploratory)', 'Held-out', 'Intervals overlap', 'Same sign'], rows.map((r) => [r.group === 'confirmatory' ? r.id : `${r.group}: ${r.label}`, cell(r, 'training'), cell(r, 'heldout'), r.overlap ? 'yes' : 'no', r.sameSign ? 'yes' : 'no']));
  return { markdown, apart: rows.filter((r) => !r.overlap).map((r) => (r.group === 'confirmatory' ? r.id : `${r.group}: ${r.label}`)), total: rows.length };
}

export { loadFigureInputs };
