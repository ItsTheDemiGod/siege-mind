// ONE shared pure formatter for every number shown in the v4 figures and in docs/RESULTS.md (no number is ever typed by hand).

const fixed = (x, d) => {
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new TypeError(`cannot format ${String(x)}`);
  const s = x.toFixed(d);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s; // no negative zero
};

/** Estimates of lives lost and contrasts: 2 decimals. */
export const fmtEst = (x) => fixed(x, 2);
/** Rates and fractions (win rate, coverage, leak fraction): 3 decimals. */
export const fmtRate = (x) => fixed(x, 3);
/** Percentage of a fraction with one decimal, for coverage labels. */
export const fmtPct = (x) => `${fixed(x * 100, 1)}%`;
/** p-values: '< 0.0001' below 0.0001, else 4 decimals. */
export const fmtP = (p) => (p < 0.0001 ? '< 0.0001' : fixed(p, 4));
/** Interval '[lo, hi]' with the given number formatter (default 2 decimals). */
export const fmtCI = (ci, f = fmtEst) => `[${f(ci[0])}, ${f(ci[1])}]`;
/** Estimate with sign for tables, e.g. '+0.19'. */
export const fmtSigned = (x, f = fmtEst) => (x > 0 ? `+${f(x)}` : f(x));
