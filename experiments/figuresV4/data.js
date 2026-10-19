// Pure data preparation for the protocol-v4 figures and the results document: input validation, the training/held-out replication table and
// per-pair fixed-wave contrasts. The per-pair values come from the SAME contrast function as the confirmatory analysis (contrastSeedValues).
import { readFileSync } from 'node:fs';
import { roundTo } from '../../src/sim/telemetrySchema.js';
import { PROTOCOL } from '../protocol.js';
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

const TRAIN_SEEDS = Object.freeze({ from: 1001, to: 1020 });
const PAIR_WAVES = Object.freeze([5, 9]);
const PAIR_MODES = Object.freeze(['adaptive', 'adaptive2', 'counter']);

/**
 * Read and validate the training rows (docs/results/firstlook-train6.rows.json, read-only): tuning set, train seeds, six modes, every unit once.
 * @param {string} path @param {{styles: string[], confirmatory: {modes: string[]}}} [protocol] @returns {object[]} the rows @throws {Error} naming the problem
 */
export function loadTrainingRows(path, protocol = PROTOCOL) {
  let file;
  try { file = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { throw new Error(`cannot read the training rows ${path}: ${e.message}`); }
  check(file && file.set === 'tuning', `the training rows must come from the tuning set, got '${String(file && file.set)}'`);
  check(Array.isArray(file.rows), 'the training rows file has no rows array');
  const bad = file.rows.filter((r) => !(r.seed >= TRAIN_SEEDS.from && r.seed <= TRAIN_SEEDS.to));
  check(bad.length === 0, `the training rows must be the train split (seeds ${TRAIN_SEEDS.from}-${TRAIN_SEEDS.to}); ${bad.length} rows are outside it`);
  const seen = new Map();
  for (const r of file.rows) seen.set(`${r.style}|${r.mode}|${r.seed}`, (seen.get(`${r.style}|${r.mode}|${r.seed}`) ?? 0) + 1);
  const missing = [];
  for (let seed = TRAIN_SEEDS.from; seed <= TRAIN_SEEDS.to; seed++) for (const style of protocol.styles) for (const mode of protocol.confirmatory.modes) if (!seen.has(`${style}|${mode}|${seed}`)) missing.push(`${style}/${mode}/${seed}`);
  check(missing.length === 0, `the training rows are missing units, for example ${missing.slice(0, 3).join(', ')}`);
  check([...seen.values()].every((c) => c === 1) && file.rows.length === seen.size, 'the training rows contain a duplicate unit');
  return file.rows;
}

/**
 * Per-pair replication: for waves 5 and 9 and the modes adaptive, adaptive2, counter, every unlocked (style -> predicted type) pair estimated on the training rows and
 * on the held-out rows with the same machinery (pairContrasts, population units only).
 * @param {object[]} heldoutRows @param {object[]} trainingRows @param {object} protocol
 * @returns {{wave: number, mode: string, pair: string, training: object, heldout: object, overlap: boolean, sameSign: boolean, diff: number}[]}
 */
export function replicationPairTable(heldoutRows, trainingRows, protocol) {
  const opts = { waves: [...PAIR_WAVES], modes: [...PAIR_MODES] };
  const key = (p) => `${p.wave}|${p.mode}|${p.style}|${p.type}`;
  const train = new Map(pairContrasts(trainingRows, protocol, opts).map((p) => [key(p), p]));
  const side = (p) => ({ estimate: p.mean, ci95: p.ci95, seeds: p.seeds, units: p.units });
  return pairContrasts(heldoutRows, protocol, opts).map((h) => {
    const t = train.get(key(h));
    check(t, `the pair ${h.style} -> ${h.type} at wave ${h.wave} for ${h.mode} has no training estimate`);
    return { wave: h.wave, mode: h.mode, pair: `${h.style} -> ${h.type}`, training: side(t), heldout: side(h), overlap: intervalsOverlap(h.ci95, t.ci95), sameSign: sign(h.mean) === sign(t.mean), diff: r6(h.mean - t.mean) };
  });
}

/** @returns {string} the display label of a replicationTable row (K rows keep their id) */
export const rowLabel = (r) => (r.group === 'confirmatory' ? r.id : `${r.group}: ${r.label}`);

/**
 * Split the replication rows into distinct rows and rows that repeat another row (the K rows are the same quantity as three estimand and contrast rows).
 * @param {object[]} rows replicationTable rows @param {Record<string, string>} aliasMap K id to the label of the row it repeats
 * @returns {{distinct: object[], duplicates: {id: string, alias: string}[]}} @throws {Error} when an alias is missing or its four numbers differ
 */
export function distinctRows(rows, aliasMap) {
  const same = (a, b) => a.estimate === b.estimate && a.ci95[0] === b.ci95[0] && a.ci95[1] === b.ci95[1];
  const duplicates = [];
  for (const [id, alias] of Object.entries(aliasMap)) {
    const k = rows.find((r) => r.id === id);
    const a = rows.find((r) => rowLabel(r) === alias);
    check(k && a, `alias ${id} -> '${alias}': row not found`);
    check(same(k.training, a.training) && same(k.heldout, a.heldout), `${id} is not identical to '${alias}' (training and held-out estimate and interval must match)`);
    duplicates.push({ id, alias });
  }
  const dup = new Set(duplicates.map((d) => d.id));
  return { distinct: rows.filter((r) => !dup.has(r.id)), duplicates };
}

/** The confirmatory rows repeat these replication rows exactly (same estimand, same machinery). */
export const K_ALIASES = Object.freeze({ K1: 'livesLost: random - static', K2: 'contrast: adaptive at wave 9', K3: 'contrast: adaptive2 at wave 9' });
