// Statistics for the experiment (pure, deterministic). Plain arithmetic plus Math.sqrt/floor/ceil/abs/min/max only (no pow, exp or log),
// resampling through createRng so results are identical on every machine.
import { createRng } from '../src/sim/rng.js';

const Z_ALPHA = { 0.05: 1.959964, 0.016667: 2.394 }; // 0.016667 = 0.05 / 3, the Holm level of the smallest of three p-values
const Z_BETA = { 0.8: 0.841621, 0.9: 1.281552 };
const EPS = 1e-12; // tolerance when comparing sums of floats in the permutation test

export const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

/** Sample standard deviation (n - 1); 0 for fewer than two values. */
export function sd(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1));
}

/** Linear-interpolation quantile of an ASCENDING array (the common "type 7" definition). */
export function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  const h = (sorted.length - 1) * q;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

export function median(xs) {
  return quantile([...xs].sort((a, b) => a - b), 0.5);
}

/**
 * Seed-level paired differences: for every seed, the mean over the usable styles of row(modeA)[metric] - row(modeB)[metric].
 * @param {object[]} rows result rows @param {{metric: string, modeA: string, modeB: string, styles: string[]}} o
 * @returns {{seeds: number[], diffs: number[], dropped: number[], perStyle: Record<string, {seeds: number[], diffs: number[]}>}}
 * @throws {Error} when a (style, mode, seed) unit is missing or duplicated
 */
export function seedLevelDiffs(rows, { metric, modeA, modeB, styles }) {
  const cell = new Map();
  for (const r of rows) {
    if ((r.mode !== modeA && r.mode !== modeB) || !styles.includes(r.style)) continue;
    const key = `${r.seed}|${r.style}|${r.mode}`;
    if (cell.has(key)) throw new Error(`duplicate unit ${r.style}/${r.mode}/seed ${r.seed}`);
    cell.set(key, r[metric]);
  }
  const seeds = [...new Set([...cell.keys()].map((k) => Number(k.split('|')[0])))].sort((a, b) => a - b);
  const kept = [];
  const diffs = [];
  const dropped = [];
  const perStyle = Object.fromEntries(styles.map((s) => [s, { seeds: [], diffs: [] }]));
  for (const seed of seeds) {
    const usable = [];
    for (const style of styles) {
      const a = cell.get(`${seed}|${style}|${modeA}`);
      const b = cell.get(`${seed}|${style}|${modeB}`);
      if (a === undefined || b === undefined) throw new Error(`missing unit ${style}/${a === undefined ? modeA : modeB}/seed ${seed}`);
      if (a === null || b === null) continue; // a metric that does not apply to this style (for example no prediction)
      usable.push(a - b);
      perStyle[style].seeds.push(seed);
      perStyle[style].diffs.push(a - b);
    }
    if (usable.length === 0) { dropped.push(seed); continue; }
    kept.push(seed);
    diffs.push(mean(usable));
  }
  return { seeds: kept, diffs, dropped, perStyle };
}

/**
 * Two-sided paired sign-flip permutation test on |mean| of the diffs.
 * @param {number[]} diffs @param {{resamples: number, exactMaxN: number, seed: number}} o
 * @returns {{p: number, statistic: number, n: number, exact: boolean}}
 */
export function signFlipTest(diffs, { resamples, exactMaxN, seed }) {
  const n = diffs.length;
  const observed = Math.abs(mean(diffs));
  if (n === 0 || diffs.every((d) => d === 0)) return { p: 1, statistic: observed, n, exact: n <= exactMaxN };
  if (n <= exactMaxN) {
    const total = 2 ** n;
    let count = 0;
    for (let mask = 0; mask < total; mask++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += (mask >> i) & 1 ? -diffs[i] : diffs[i];
      if (Math.abs(sum / n) >= observed - EPS) count++;
    }
    return { p: count / total, statistic: observed, n, exact: true };
  }
  const rng = createRng(seed).fork('signflip');
  let count = 0;
  for (let b = 0; b < resamples; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += rng.next() < 0.5 ? -diffs[i] : diffs[i];
    if (Math.abs(sum / n) >= observed - EPS) count++;
  }
  return { p: (count + 1) / (resamples + 1), statistic: observed, n, exact: false };
}

/** Percentile bootstrap confidence interval of the mean (seeds are the resampled clusters). @returns {[number, number]} */
export function bootstrapCI(diffs, { resamples, alpha, seed }) {
  const n = diffs.length;
  if (n === 0) return [0, 0];
  const rng = createRng(seed).fork('bootstrap');
  const means = new Array(resamples);
  for (let b = 0; b < resamples; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += diffs[Math.floor(rng.next() * n)];
    means[b] = sum / n;
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor((alpha / 2) * resamples)], means[Math.ceil((1 - alpha / 2) * resamples) - 1]];
}

/** Paired effect size: mean / sd of the differences (0 when sd is 0). */
export function cohensDz(diffs) {
  const s = sd(diffs);
  return s === 0 ? 0 : mean(diffs) / s;
}

/** Holm step-down adjustment (monotone, capped at 1), returned in the input order. */
export function holmAdjust(pvalues) {
  const m = pvalues.length;
  const order = pvalues.map((p, i) => i).sort((a, b) => pvalues[a] - pvalues[b] || a - b);
  const out = new Array(m);
  let running = 0;
  order.forEach((idx, rank) => {
    running = Math.max(running, Math.min(1, (m - rank) * pvalues[idx]));
    out[idx] = running;
  });
  return out;
}

/** Wilson score interval for a proportion. @returns {[number, number]} */
export function wilson(successes, n, z = 1.959964) {
  if (n === 0) return [0, 1];
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

/** Seeds needed to detect `effect` with standard deviation `sd` of the seed-level differences. */
export function requiredN({ sd: sigma, effect, alpha = 0.05, power = 0.8 }) {
  if (!(alpha in Z_ALPHA)) throw new RangeError(`alpha must be 0.05 or 0.016667, got ${String(alpha)}`);
  if (!(power in Z_BETA)) throw new RangeError(`power must be 0.8 or 0.9, got ${String(power)}`);
  if (!(effect > 0)) throw new RangeError(`effect must be > 0, got ${String(effect)}`);
  const k = ((Z_ALPHA[alpha] + Z_BETA[power]) * sigma) / effect;
  return Math.ceil(k * k);
}
