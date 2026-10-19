// Text and markdown renderings of an analysis result (pure, deterministic).
import { ENEMY_ORDER } from '../src/data/enemies.js';

const f = (x, d = 3) => (x === null || x === undefined ? '-' : x.toFixed(d));
const ci = (c) => (c ? `[${f(c[0])}, ${f(c[1])}]` : '-');
const pct = (x) => `${(100 * x).toFixed(0)}%`;
const yesNo = (b) => (b ? 'yes' : 'no');

/** Aligned plain-text table; the first `leftCols` columns are left-aligned. */
function textTable(title, headers, rows, leftCols = 1) {
  const all = [headers, ...rows.map((r) => r.map(String))];
  const widths = headers.map((_, c) => Math.max(...all.map((r) => r[c].length)));
  const line = (r) => r.map((v, c) => (c < leftCols ? v.padEnd(widths[c]) : v.padStart(widths[c]))).join('  ');
  return [title, line(headers), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map((r) => line(r.map(String)))].join('\n');
}

const mdTable = (headers, rows) => [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(String).join(' | ')} |`)].join('\n');

const HYP_HEADERS = ['id', 'hypothesis', 'A - B', 'mean diff', '95% CI', 'dz', 'p raw', 'p Holm', 'supports'];
const hypRow = (h) => [h.id, h.label, `${h.modeA} - ${h.modeB} ${h.metric}, expect ${h.direction}`, f(h.meanDiff), ci(h.ci95), f(h.dz, 2), f(h.pRaw, 4), h.pHolm === null ? '-' : f(h.pHolm, 4), yesNo(h.supportsDirection)];

/** Every table of the report as { title, headers, rows } so text and markdown share the content. */
function sections(r) {
  const byFamily = (fam) => r.hypotheses.filter((h) => h.family === fam).map(hypRow);
  const styles = Object.keys(r.descriptive.livesLost.byStyleMode);
  const modes = Object.keys(r.descriptive.livesLost.byMode);
  const lines = [];
  for (const [metric, label, fmt] of [['livesLost', 'Mean lives lost', (s) => f(s.mean, 2)], ['won', 'Win rate (Wilson 95%)', (s) => `${pct(s.mean)} ${ci(s.wilson)}`]]) {
    lines.push({
      title: `${label} by style and mode`, headers: ['style', ...modes],
      rows: [...styles.map((s) => [s, ...modes.map((m) => fmt(r.descriptive[metric].byStyleMode[s][m]))]), ['all', ...modes.map((m) => fmt(r.descriptive[metric].byMode[m]))]],
    });
  }
  const types = ENEMY_ORDER;
  const tilt = r.tiltAlignment;
  return {
    primary: { title: 'Primary hypotheses (Holm-adjusted within the primary family)', headers: HYP_HEADERS, rows: byFamily('primary') },
    secondary: { title: 'Secondary hypotheses (Holm-adjusted within the secondary family)', headers: HYP_HEADERS, rows: byFamily('secondary') },
    descriptive: { title: 'Descriptive comparison (no adjustment)', headers: HYP_HEADERS, rows: byFamily('descriptive') },
    alignment: {
      title: `Tilt alignment (a final weight of at least ${tilt.threshold} on a predicted type)`, headers: ['style', 'predicted', 'adaptive', 'adaptive 95%', 'random', 'random 95%'],
      rows: Object.entries(tilt.perStyle).map(([s, a]) => [s, a.predictedTypes.join('+'), pct(a.adaptive.rate), ci(a.adaptive.wilson), pct(a.random.rate), ci(a.random.wilson)]),
    },
    tilts: { title: `Mean final weight per enemy type, adaptive mode (95% CI over seeds; ${tilt.rowsUsed.adaptive} games used, ${tilt.rowsExcluded.adaptive} excluded: no eligible wave reached; random: ${tilt.rowsUsed.random} used, ${tilt.rowsExcluded.random} excluded)`, headers: ['style', ...types], rows: Object.entries(tilt.tilts).map(([s, t]) => [s, ...types.map((x) => `${f(t[x].mean, 2)} ${ci(t[x].ci95)}`)]) },
    descriptiveTables: lines,
    guard: { title: 'Static win rate per style (the calibration guard)', headers: ['style', 'win rate'], rows: [...Object.entries(r.staticWinRateGuard.perStyle).map(([s, v]) => [s, pct(v)]), ['mean', pct(r.staticWinRateGuard.mean)]] },
    power: { title: 'Power (80%, alpha 0.05): seeds needed for the primary comparisons', headers: ['id', 'sd of seed diffs', 'observed effect', 'seeds for observed effect', 'seeds for half the effect'], rows: Object.entries(r.power).map(([id, p]) => [id, f(p.sdSeedDiffs), f(p.observedEffect), p.nForObservedEffect ?? '-', p.nForHalfEffect ?? '-']) },
  };
}

const head = (r) => `Analysis of the ${r.set} set: ${r.n.seeds} seeds x ${r.n.styles} styles x ${r.n.modes} modes = ${r.n.rows} games.`;
const completenessLine = (r) => (r.completeness.complete ? `Completeness: every style x mode x seed present exactly once (${r.completeness.actual} of ${r.completeness.expected}).` : `Completeness: INCOMPLETE (${r.completeness.actual} rows, ${r.completeness.expected} expected; missing ${r.completeness.missing.slice(0, 5).join(', ') || 'none'}; duplicates ${r.completeness.duplicates.slice(0, 5).join(', ') || 'none'}).`);

/** @param {object} r analyze() result @returns {string} aligned plain text */
export function formatAnalysis(r) {
  if (!r.completeness.complete) return `${head(r)}\n${completenessLine(r)}\n${r.notes.map((n) => `- ${n}`).join('\n')}\n`;
  const s = sections(r);
  const t = (x, left = 1) => textTable(x.title, x.headers, x.rows, left);
  return [
    head(r),
    'Difference = first mode minus second mode, averaged over styles within each seed. 95% CI: cluster bootstrap over seeds. p: two-sided sign-flip permutation test. Holm adjustment within a family.',
    t(s.primary, 2), t(s.secondary, 2), t(s.descriptive, 2), t(s.alignment, 2), t(s.tilts), ...s.descriptiveTables.map((x) => t(x)), t(s.guard), t(s.power),
    completenessLine(r), `Notes:\n${r.notes.map((n) => `- ${n}`).join('\n')}`, '',
  ].join('\n\n');
}

/** @param {object} r analyze() result @returns {string} GitHub-flavored markdown */
export function analysisToMarkdown(r) {
  const lines = [`# Experiment analysis: ${r.set} set`, '', head(r), ''];
  lines.push('## How to read this', '',
    '- Every comparison is "mode A minus mode B", computed per seed (averaged over the five bot styles) and then summarized over seeds.',
    '- A positive lives-lost difference for adaptive versus a control means the Director cost the player more lives.',
    '- A 95% interval that includes 0 means no detectable effect at this sample size; the p-values test the same thing.',
    '- Primary and secondary p-values are Holm-adjusted within their own family; descriptive rows are not adjusted.', '');
  if (!r.completeness.complete) return `${lines.join('\n')}\n## Completeness\n\n${completenessLine(r)}\n\n## Notes\n\n${r.notes.map((n) => `- ${n}`).join('\n')}\n`;
  const s = sections(r);
  const md = (x) => [`## ${x.title}`, '', mdTable(x.headers, x.rows), ''];
  for (const x of [s.primary, s.secondary, s.descriptive, s.alignment, s.tilts, ...s.descriptiveTables, s.guard, s.power]) lines.push(...md(x));
  lines.push('## Completeness', '', completenessLine(r), '', '## Notes', '', ...r.notes.map((n) => `- ${n}`), '');
  return lines.join('\n');
}
