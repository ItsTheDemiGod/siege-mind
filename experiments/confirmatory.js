// The confirmatory analysis of amendment A3 (pure, deterministic): three hypotheses K1-K3 with Holm, estimands with CIs only, coverage, sensitivity.
// It never computes a statistic on incomplete data. docs/EXPERIMENT.md ("Amendment A3") is the pre-registration.
import { roundTo } from '../src/sim/telemetrySchema.js';
import { PROTOCOL, hashOf } from './protocol.js';
import { holmAdjust } from './stats.js';
import { contrastSeedValues } from './firstLookContrast.js';
import { coverageTable, chooseFixedWave, FIXED_WAVE_CANDIDATES } from './fixedWave.js';
import {
  populationOf, seedValuesMetric, estimateOf, pRawOf, hypothesisValues, powerOf, observedUnits, keyOf,
} from './confirmatoryStats.js';

export { formatConfirmatory, confirmatoryToMarkdown } from './confirmatoryFormat.js';

const r6 = (x) => roundTo(x, 6);
const ZERO_TOLERANCE = 1e-9;
const ZERO_BY_CONSTRUCTION = ['random', 'prior'];
export const BANNERS = Object.freeze({ CONFIRMATORY: 'CONFIRMATORY ANALYSIS OF THE HELD-OUT RUN (amendment A3)', 'EXPLORATORY DRY RUN': 'EXPLORATORY DRY RUN ON TRAINING DATA: NOT CONFIRMATORY' });
export const NOTES = Object.freeze([
  'The confirmatory family is exactly K1-K3; everything else in this report is estimation (point estimates and confidence intervals, no p-values).',
  'The bots are scripted players on one map with fixed tower mixes, not humans.',
  'The validation seeds were not used for confirmation because they are not pristine (they were part of the tuning set that was read earlier).',
  'The counter arm reads the tower loadout and is a reference, not a fair competitor.',
  'The random and prior contrasts are zero by construction: their tilts cannot depend on the defense.',
  'The attribution pairs are estimates, not tests: they split a Director\'s total effect into composition variability, enemy-durability bias and learning.',
]);

function completenessOf(rows, protocol) {
  const modes = protocol.confirmatory.modes;
  const seeds = [...new Set(rows.map((r) => r.seed))].sort((a, b) => a - b);
  const counts = new Map();
  for (const r of rows) { const k = `${r.seed}|${r.style}|${r.mode}`; counts.set(k, (counts.get(k) ?? 0) + 1); }
  const missing = [];
  const duplicates = [];
  for (const seed of seeds) for (const style of protocol.styles) for (const mode of modes) {
    const c = counts.get(`${seed}|${style}|${mode}`) ?? 0;
    if (c === 0) missing.push(`${style}/${mode}/${seed}`); else if (c > 1) duplicates.push(`${style}/${mode}/${seed}`);
  }
  const unknown = rows.filter((r) => !protocol.styles.includes(r.style) || !modes.includes(r.mode)).length;
  const expected = seeds.length * protocol.styles.length * modes.length;
  return { complete: seeds.length > 0 && missing.length === 0 && duplicates.length === 0 && unknown === 0, expected, actual: rows.length, missing: missing.slice(0, 20), duplicates: duplicates.slice(0, 20), unknownRows: unknown, seeds };
}

/**
 * @param {object[]} rows result rows (every confirmatory mode for every style and seed) @param {{protocol?: typeof PROTOCOL, label?: 'CONFIRMATORY'|'EXPLORATORY DRY RUN'}} [o]
 * @returns {object} plain JSON-serializable result; when the data are incomplete only the header and `completeness` are filled and NO statistic is computed
 */
export function analyzeConfirmatory(rows, { protocol = PROTOCOL, label = 'CONFIRMATORY' } = {}) {
  if (!BANNERS[label]) throw new RangeError(`label must be CONFIRMATORY or EXPLORATORY DRY RUN, got ${String(label)}`);
  const C = protocol.confirmatory;
  const st = protocol.stats;
  const completeness = completenessOf(rows, protocol);
  const head = { label, banner: BANNERS[label], protocolVersion: protocol.version, protocolHash: hashOf(protocol), completeness, notes: [...NOTES] };
  if (!completeness.complete) return { ...head, n: { seeds: completeness.seeds.length, styles: protocol.styles.length, modes: C.modes.length, rows: rows.length, populationUnits: null, excludedUnits: null } };
  const allSeeds = completeness.seeds;
  const pop = populationOf(rows, protocol);
  const n = { seeds: allSeeds.length, styles: protocol.styles.length, modes: C.modes.length, rows: rows.length, populationUnits: pop.units, excludedUnits: pop.excluded };
  const primary = C.fixedWave.primary;

  // confirmatory family: K1-K3 with Holm across exactly these three p-values
  const vals = C.hypotheses.map((h) => ({ h, v: hypothesisValues(h, pop.rows, allSeeds, protocol) }));
  const raw = vals.map(({ v }) => pRawOf(v.values, st));
  const holm = holmAdjust(raw);
  const confirmatory = vals.map(({ h, v }, i) => {
    const e = estimateOf(v.values, st);
    const pHolm = Math.round(holm[i] * 1e6) / 1e6;
    const rightSign = e.estimate !== null && (h.direction === 'greater' ? e.estimate > 0 : e.estimate < 0);
    return { id: h.id, label: h.label, direction: h.direction, n: e.n, droppedSeeds: v.dropped, estimate: e.estimate, ci95: e.ci95, pRaw: raw[i], pHolm, supported: rightSign && pHolm < C.alpha };
  });

  // estimands: pairs x metrics, point estimate and CI only (no p-values anywhere in this block)
  const estimands = [];
  for (const [a, b] of C.estimands.pairs) for (const metric of C.estimands.metrics) {
    const v = seedValuesMetric(pop.rows, allSeeds, metric, a, b);
    estimands.push({ pair: `${a}-${b}`, a, b, metric, ...estimateOf(v.values, st) });
  }

  // contrasts at the registered waves, with coverage and the zero-by-construction check
  const contrasts = [];
  for (const wave of C.estimands.contrastWaves) for (const mode of C.estimands.contrastModes) {
    const c = contrastSeedValues(pop.rows, mode, wave, protocol, { unlockedOnly: true });
    const e = estimateOf(c.values, st);
    const entry = { wave, mode, n: e.n, unitsObserved: c.observedUnits, populationUnits: pop.units, coverage: r6(pop.units ? c.observedUnits / pop.units : 0), estimate: e.estimate, ci95: e.ci95, usedPairs: c.perPair.map((p) => `${p.style}->${p.type}`), perPair: c.perPair };
    if (ZERO_BY_CONSTRUCTION.includes(mode)) entry.zeroCheck = e.estimate === null || Math.abs(e.estimate) < ZERO_TOLERANCE;
    contrasts.push(entry);
  }

  // coverage at the primary wave and the pre-registered rule (computed, not asserted)
  const cmodes = C.estimands.contrastModes;
  const perMode = Object.fromEntries(cmodes.map((m) => [m, { observed: observedUnits(pop.rows, m, primary).size, populationUnits: pop.units }]));
  for (const m of cmodes) perMode[m].coverage = r6(pop.units ? perMode[m].observed / pop.units : 0);
  const minCoverage = Math.min(...cmodes.map((m) => perMode[m].coverage));
  const ruleChoice = chooseFixedWave(coverageTable(pop.rows, { modes: cmodes, waves: [...FIXED_WAVE_CANDIDATES], population: pop.keys }), { modes: cmodes });
  const coverageAtPrimary = { wave: primary, perMode, minCoverage, metRule: minCoverage >= 0.75, rule: C.fixedWave.coverageRule, ruleChoice: { chosen: ruleChoice.chosen, metRule: ruleChoice.metRule }, registered: { coverageRuleMet: C.fixedWave.coverageRuleMet, trainingCoverageAtPrimary: C.fixedWave.trainingCoverageAtPrimary } };

  // sensitivity analyses
  const k1all = seedValuesMetric(rows, allSeeds, 'livesLost', 'random', 'static');
  const matchModes = ['adaptive', 'adaptive2', 'counter'];
  const common = matchModes.map((m) => observedUnits(pop.rows, m, primary)).reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
  const sub = pop.rows.filter((r) => common.has(keyOf(r)));
  const matched = Object.fromEntries(C.hypotheses.filter((h) => h.kind === 'contrast').map((h) => { const v = hypothesisValues(h, sub, allSeeds, protocol); return [h.id, estimateOf(v.values, st)]; }));
  const loso = C.hypotheses.map((h) => {
    const byStyleRemoved = {};
    for (const style of protocol.styles) {
      const p2 = { ...protocol, styles: protocol.styles.filter((s) => s !== style) };
      byStyleRemoved[style] = estimateOf(hypothesisValues(h, pop.rows.filter((r) => r.style !== style), allSeeds, p2).values, st).estimate;
    }
    const es = Object.values(byStyleRemoved).filter((x) => x !== null);
    const sign = (x) => (h.direction === 'greater' ? x > 0 : x < 0);
    return { id: h.id, byStyleRemoved, min: es.length ? Math.min(...es) : null, max: es.length ? Math.max(...es) : null, signStable: es.length === protocol.styles.length && es.every(sign) };
  });
  const sensitivity = { k1AllUnits: { ...estimateOf(k1all.values, st), units: rows.length / C.modes.length }, matchedSet: { units: common.size, ...matched }, leaveOneStyleOut: loso };

  const power = { label: 'descriptive and post hoc, not part of the confirmatory plan', alpha: 0.016667, hypotheses: vals.map(({ h, v }) => ({ id: h.id, ...powerOf(v.values) })) };
  return { ...head, n, population: { rule: C.population.rule, units: pop.units, excluded: pop.excluded }, confirmatory, estimands, contrasts, coverageAtPrimary, sensitivity, power };
}
