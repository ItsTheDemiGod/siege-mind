// Pure data preparation for the protocol-v4 figures and the results document: input validation, the training/held-out replication table and
// per-pair fixed-wave contrasts. The per-pair values come from the SAME contrast function as the confirmatory analysis (contrastSeedValues).
import { roundTo } from '../../src/sim/telemetrySchema.js';
import { contrastSeedValues } from '../firstLookContrast.js';
import { populationOf, estimateOf, observedUnits } from '../confirmatoryStats.js';
import { mean } from '../stats.js';

const r6 = (x) => roundTo(x, 6);
const TOLERANCE = 1e-6;
export const REPLICATION_MODES = Object.freeze(['adaptive', 'adaptive2', 'counter']);
export const REPLICATION_WAVES = Object.freeze([5, 9, 13]);

const check = (cond, msg) => { if (!cond) throw new Error(msg); };
const pairKeys = (a) => a.estimands.map((e) => `${e.pair}|${e.metric}`);
const contrastKeys = (a) => a.contrasts.map((c) => `${c.mode}@${c.wave}`);

function checkOne(a, name, label) {
  check(a && typeof a === 'object', `${name}: not an analysis object`);
  check(a.label === label, `${name}: label must be '${label}', got '${String(a.label)}'`);
  check(a.protocolVersion === 4, `${name}: protocolVersion must be 4, got ${String(a.protocolVersion)}`);
  check(a.completeness && a.completeness.complete === true, `${name}: the analysis is not complete`);
  for (const k of ['confirmatory', 'estimands', 'contrasts', 'n', 'population', 'coverageAtPrimary']) check(a[k] !== undefined, `${name}: missing ${k}`);
  check(['K1', 'K2', 'K3'].every((id, i) => a.confirmatory[i] && a.confirmatory[i].id === id), `${name}: confirmatory must be K1, K2, K3 in order`);
  for (const e of a.estimands) check(e.estimate !== null && Array.isArray(e.ci95), `${name}: estimand ${e.pair} ${e.metric} has no estimate`);
  for (const c of a.contrasts) check(c.estimate !== null && Array.isArray(c.ci95), `${name}: contrast ${c.mode}@${c.wave} has no estimate`);
}

/**
 * Validate the held-out (CONFIRMATORY) and training (EXPLORATORY DRY RUN) analyses and return them with their shared keys.
 * @param {{heldout: object, training: object}} o @returns {{heldout: object, training: object, pairs: string[], contrasts: string[]}} @throws {Error} naming the problem
 */
export function loadFigureInputs({ heldout, training }) {
  checkOne(heldout, 'held-out analysis', 'CONFIRMATORY');
  checkOne(training, 'training analysis', 'EXPLORATORY DRY RUN');
  check(heldout.protocolHash !== undefined && heldout.protocolHash === training.protocolHash, 'the held-out and training analyses were produced under different protocol hashes');
  check(pairKeys(heldout).join() === pairKeys(training).join(), 'the held-out and training analyses have different estimand pairs or metrics');
  check(contrastKeys(heldout).join() === contrastKeys(training).join(), 'the held-out and training analyses have different contrast waves or modes');
  return { heldout, training, pairs: pairKeys(heldout), contrasts: contrastKeys(heldout) };
}

const intervalsOverlap = (a, b) => a[0] <= b[1] && b[0] <= a[1];
const sign = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);

/**
 * Rows comparing the training estimate with the held-out estimate: K1-K3, the lives-lost and won estimands and the contrasts at waves 5, 9, 13.
 * @returns {{id: string, group: 'confirmatory'|'livesLost'|'won'|'contrast', label: string, training: {estimate: number, ci95: number[]}, heldout: {estimate: number, ci95: number[]}, overlap: boolean, sameSign: boolean}[]}
 */
export function replicationTable(heldout, training) {
  loadFigureInputs({ heldout, training });
  const rows = [];
  const add = (id, group, label, h, t) => {
    const hh = { estimate: h.estimate, ci95: h.ci95 };
    const tt = { estimate: t.estimate, ci95: t.ci95 };
    rows.push({ id, group, label, training: tt, heldout: hh, overlap: intervalsOverlap(hh.ci95, tt.ci95), sameSign: sign(hh.estimate) === sign(tt.estimate) });
  };
  heldout.confirmatory.forEach((k, i) => add(k.id, 'confirmatory', k.label, k, training.confirmatory[i]));
  for (const metric of ['livesLost', 'won']) {
    heldout.estimands.forEach((e, i) => { if (e.metric === metric) add(`${e.pair}|${metric}`, metric, `${e.a} - ${e.b}`, e, training.estimands[i]); });
  }
  heldout.contrasts.forEach((c, i) => { if (REPLICATION_MODES.includes(c.mode) && REPLICATION_WAVES.includes(c.wave)) add(`${c.mode}@${c.wave}`, 'contrast', `${c.mode} at wave ${c.wave}`, c, training.contrasts[i]); });
  return rows;
}

/**
 * Per-pair fixed-wave contrasts (unlocked pairs only, population units only) with a 95% cluster bootstrap CI over seeds. For every wave and mode the
 * seed-level pair values are re-aggregated exactly like the aggregate contrast and compared with it (and with `analysis.contrasts` when given).
 * @param {object[]} rows held-out result rows @param {object} protocol @param {{waves: number[], modes: string[], analysis?: object}} o
 * @returns {{wave: number, mode: string, style: string, type: string, mean: number, ci95: number[], seeds: number, units: number}[]} @throws {Error} on an inconsistent aggregate
 */
export function pairContrasts(rows, protocol, { waves, modes, analysis }) {
  const pop = populationOf(rows, protocol);
  const out = [];
  for (const wave of waves) for (const mode of modes) {
    const c = contrastSeedValues(pop.rows, mode, wave, protocol, { unlockedOnly: true });
    const bySeed = new Map();
    for (const p of c.pairValues) (bySeed.get(p.seed) ?? bySeed.set(p.seed, []).get(p.seed)).push(p.v);
    const aggregate = mean([...bySeed.keys()].sort((a, b) => a - b).map((s) => mean(bySeed.get(s))));
    check(Math.abs(aggregate - mean(c.values)) < TOLERANCE, `per-pair values do not reproduce the aggregate contrast at wave ${wave} for ${mode}`);
    const reported = analysis?.contrasts.find((x) => x.wave === wave && x.mode === mode);
    if (analysis) check(reported && Math.abs(r6(aggregate) - reported.estimate) < TOLERANCE, `per-pair values do not reproduce the reported aggregate at wave ${wave} for ${mode}`);
    const observed = observedUnits(pop.rows, mode, wave);
    for (const pr of c.perPair) {
      const values = c.pairValues.filter((p) => p.style === pr.style && p.type === pr.type).map((p) => p.v);
      const e = estimateOf(values, protocol.stats);
      out.push({ wave, mode, style: pr.style, type: pr.type, mean: e.estimate, ci95: e.ci95, seeds: values.length, units: [...observed].filter((k) => k.startsWith(`${pr.style}|`)).length });
    }
  }
  return out;
}
