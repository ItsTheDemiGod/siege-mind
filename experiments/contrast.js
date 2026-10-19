// The style-contrast statistic (pure + CLI). Definition (pre-registered as T2 / T0 in protocol version 3):
//  - Eligible rows: row.mode === mode and row.tiltObserved === 1 (rows with tiltObserved 0 are counted in `excluded`).
//  - S = the styles in `styles` whose predictions[style] is a non-empty array.
//  - For a seed g, a style s in S and a type t in predictions[s]: the pair is usable when the row (s, g) is eligible and at least `minReference`
//    rows (s', g) with s' in S minus {s} are eligible. pairValue = tilt_t(s, g) - mean over those reference rows of tilt_t(s', g).
//  - seedValue = mean of the usable pair values of the seed; seeds with no usable pair are dropped (droppedSeeds).
//  The contrast asks: does a style's final weight on the type its missing tower would have countered exceed the same weight under the other styles?
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { roundTo } from '../src/sim/telemetrySchema.js';
import { PROTOCOL } from './protocol.js';
import { LEGACY_FOCUS_PREDICTIONS, LEGACY_FOCUS_STYLES } from './legacyPredictions.js';
import { mean, bootstrapCI, signFlipTest } from './stats.js';

const r6 = (x) => roundTo(x, 6);

/**
 * @param {object[]} rows @param {{mode: string, styles: string[], predictions: Record<string, string[]|null>, minReference?: number}} o
 * @returns {{seeds: number[], values: number[], perPair: {style: string, type: string, mean: number, n: number}[], used: number, excluded: number, droppedSeeds: number[]}}
 * @throws {Error} on a duplicate (style, mode, seed) row
 */
export function contrastPerSeed(rows, { mode, styles, predictions, minReference = 1 }) {
  const seen = new Set();
  const cell = new Map();
  let excluded = 0;
  for (const r of rows) {
    if (r.mode !== mode || !styles.includes(r.style)) continue;
    const key = `${r.style}|${r.seed}`;
    if (seen.has(key)) throw new Error(`duplicate row ${r.style}/${mode}/seed ${r.seed}`);
    seen.add(key);
    if (r.tiltObserved === 1) cell.set(key, r); else excluded++;
  }
  const S = styles.filter((s) => Array.isArray(predictions[s]) && predictions[s].length > 0);
  const seeds = [...new Set([...seen].map((k) => Number(k.split('|')[1])))].sort((a, b) => a - b);
  const keptSeeds = [];
  const values = [];
  const droppedSeeds = [];
  const pairAcc = new Map();
  for (const seed of seeds) {
    const pairs = [];
    for (const s of S) {
      const row = cell.get(`${s}|${seed}`);
      if (!row) continue;
      const refs = S.filter((x) => x !== s).map((x) => cell.get(`${x}|${seed}`)).filter(Boolean);
      if (refs.length < minReference) continue;
      for (const t of predictions[s]) {
        const v = row[`tilt_${t}`] - mean(refs.map((x) => x[`tilt_${t}`]));
        pairs.push(v);
        const k = `${s}|${t}`;
        pairAcc.set(k, [...(pairAcc.get(k) ?? []), v]);
      }
    }
    if (pairs.length === 0) { droppedSeeds.push(seed); continue; }
    keptSeeds.push(seed);
    values.push(mean(pairs));
  }
  const perPair = [...pairAcc.entries()].map(([k, v]) => { const [style, type] = k.split('|'); return { style, type, mean: mean(v), n: v.length }; })
    .sort((a, b) => (a.style < b.style ? -1 : a.style > b.style ? 1 : a.type < b.type ? -1 : a.type > b.type ? 1 : 0));
  return { seeds: keptSeeds, values, perPair, used: cell.size, excluded, droppedSeeds };
}

/** @param {number[]} values @param {{stats: object}} o @returns {{n: number, mean: number, ci95: [number, number], pRaw: number}} two-sided sign-flip against 0 */
export function contrastSummary(values, { stats }) {
  const ci = bootstrapCI(values, { resamples: stats.bootstrapResamples, alpha: stats.alpha, seed: stats.seed });
  const p = signFlipTest(values, { resamples: stats.signFlipResamples, exactMaxN: stats.exactMaxN, seed: stats.seed }).p;
  return { n: values.length, mean: r6(mean(values)), ci95: [r6(ci[0]), r6(ci[1])], pRaw: r6(p) };
}

/** Pairs two per-seed results by seed (only seeds in both). @returns {{seeds: number[], diffs: number[]}} diffs are A minus B */
export function pairedContrastDifference(a, b) {
  const mapB = new Map(b.seeds.map((s, i) => [s, b.values[i]]));
  const seeds = [];
  const diffs = [];
  a.seeds.forEach((s, i) => { if (mapB.has(s)) { seeds.push(s); diffs.push(a.values[i] - mapB.get(s)); } });
  return { seeds, diffs };
}

const f = (x) => x.toFixed(3);
const ci = (c) => `[${f(c[0])}, ${f(c[1])}]`;

/** Builds the full report for a rows set. @returns {object} plain JSON-serializable result */
export function buildContrastReport(rows, { styles, predictions, stats = PROTOCOL.stats }) {
  const per = Object.fromEntries(['adaptive', 'random'].map((m) => [m, contrastPerSeed(rows, { mode: m, styles, predictions })]));
  const out = { styles, predictions, modes: {}, difference: null };
  for (const m of Object.keys(per)) out.modes[m] = { ...contrastSummary(per[m].values, { stats }), used: per[m].used, excluded: per[m].excluded, droppedSeeds: per[m].droppedSeeds, perPair: per[m].perPair.map((p) => ({ ...p, mean: r6(p.mean) })) };
  const d = pairedContrastDifference(per.adaptive, per.random);
  out.difference = { ...contrastSummary(d.diffs, { stats }), seeds: d.seeds.length };
  return out;
}

export function contrastToText(r) {
  const L = [];
  for (const [m, x] of Object.entries(r.modes)) L.push(`${m}: ${x.n} seeds, mean contrast ${f(x.mean)}, 95% CI ${ci(x.ci95)}, sign-flip p ${x.pRaw.toFixed(4)} (rows used ${x.used}, excluded ${x.excluded}, dropped seeds ${x.droppedSeeds.length})`);
  L.push(`adaptive minus random: ${r.difference.n} seeds, mean ${f(r.difference.mean)}, 95% CI ${ci(r.difference.ci95)}, sign-flip p ${r.difference.pRaw.toFixed(4)}`, '', 'pair                               mean contrast  n (adaptive)  mean contrast (random)');
  const rnd = new Map(r.modes.random.perPair.map((p) => [`${p.style}|${p.type}`, p]));
  for (const p of r.modes.adaptive.perPair) L.push(`${`${p.style} -> ${p.type}`.padEnd(34)}  ${f(p.mean).padStart(13)}  ${String(p.n).padStart(12)}  ${f(rnd.get(`${p.style}|${p.type}`)?.mean ?? 0).padStart(22)}`);
  return `${L.join('\n')}\n`;
}

export function contrastToMarkdown(r) {
  const rnd = new Map(r.modes.random.perPair.map((p) => [`${p.style}|${p.type}`, p]));
  return ['# Style contrast on archived data', '', 'Exploratory and post-hoc: this statistic was designed after seeing these data; it is a sanity check of the statistic on archived data, not a result.', '',
    '| mode | seeds | mean contrast | 95% CI | sign-flip p | rows used | rows excluded |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...Object.entries(r.modes).map(([m, x]) => `| ${m} | ${x.n} | ${f(x.mean)} | ${ci(x.ci95)} | ${x.pRaw.toFixed(4)} | ${x.used} | ${x.excluded} |`), '',
    `Paired difference, adaptive minus random: ${r.difference.n} seeds, mean ${f(r.difference.mean)}, 95% CI ${ci(r.difference.ci95)}, sign-flip p ${r.difference.pRaw.toFixed(4)}.`, '',
    '| style | predicted type | mean contrast (adaptive) | n | mean contrast (random) |', '| --- | --- | --- | --- | --- |',
    ...r.modes.adaptive.perPair.map((p) => `| ${p.style} | ${p.type} | ${f(p.mean)} | ${p.n} | ${f(rnd.get(`${p.style}|${p.type}`)?.mean ?? 0)} |`), ''].join('\n');
}

function main() {
  const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
  const file = arg('in');
  const preset = arg('preset') ?? 'ablation';
  if (!file) { console.error('--in=<rows file> is required'); return 2; }
  if (!['focus', 'ablation'].includes(preset)) { console.error('--preset must be focus or ablation'); return 2; }
  let rows;
  try { rows = JSON.parse(readFileSync(resolve(file), 'utf8')).rows; } catch (e) { console.error(`cannot read ${file}: ${e.message}`); return 1; }
  if (!Array.isArray(rows)) { console.error(`${file} has no rows array`); return 1; }
  const cfg = preset === 'focus' ? { styles: [...LEGACY_FOCUS_STYLES], predictions: LEGACY_FOCUS_PREDICTIONS } : { styles: [...PROTOCOL.styles], predictions: PROTOCOL.tiltPredictions };
  const report = buildContrastReport(rows, cfg);
  console.log(contrastToText(report));
  const out = arg('out');
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(`${resolve(out)}.json`, `${JSON.stringify(report, null, 1)}\n`);
    writeFileSync(`${resolve(out)}.md`, contrastToMarkdown(report));
    console.log(`wrote ${resolve(out)}.json and .md`);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
