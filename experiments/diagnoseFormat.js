// Text and markdown renderings of a diagnostics result (pure, deterministic).
import { ENEMY_ORDER } from '../src/data/enemies.js';

const f = (x, d = 3) => x.toFixed(d);

function textTable(title, headers, rows) {
  const all = [headers, ...rows.map((r) => r.map(String))];
  const widths = headers.map((_, c) => Math.max(...all.map((r) => r[c].length)));
  const line = (r) => r.map((v, c) => (c === 0 ? v.padEnd(widths[c]) : v.padStart(widths[c]))).join('  ');
  return [title, line(headers), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map((r) => line(r.map(String)))].join('\n');
}
const mdTable = (headers, rows) => [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(String).join(' | ')} |`)].join('\n');

function tables(d) {
  const styles = Object.keys(d.baseline5.perStyle);
  const baseRows = (b) => ENEMY_ORDER.map((t) => [t, b.overall[t].cells, b.overall[t].units, f(b.overall[t].pooledReward, 4), f(b.overall[t].ratio, 2), ...styles.map((s) => f(b.perStyle[s][t].ratio, 2))]);
  const baseHeaders = ['enemy', 'cells', 'units', 'pooled reward', 'ratio', ...styles.map((s) => `${s} ratio`)];
  return [
    { title: 'Static baseline reward per enemy type, all waves (ratio to the all-type pooled reward)', headers: baseHeaders, rows: baseRows(d.baseline1) },
    { title: 'Static baseline reward per enemy type, waves 5 and later (the Director\'s eligible region)', headers: baseHeaders, rows: baseRows(d.baseline5) },
    { title: 'Share of reward variance explained (eta squared)', headers: ['enemy', 'cells', 'etaStyle', 'etaWave'], rows: ENEMY_ORDER.map((t) => [t, d.variance[t].cells, f(d.variance[t].etaStyle), f(d.variance[t].etaWave)]) },
    { title: `Noise floor: median sd of the cell reward over (style, wave) groups with 2+ seeds, against the spread of the per-type pooled rewards (${f(d.noise.spread.value, 4)}, waves ${d.noise.spread.minWave}+)`, headers: ['enemy', 'groups', 'median sd', 'sd / spread'], rows: ENEMY_ORDER.map((t) => [t, d.noise.perType[t].groups, f(d.noise.perType[t].medianSd, 4), f(d.noise.ratio[t], 2)]) },
  ];
}

/** @param {object} d diagnose() result @returns {string} aligned plain text */
export function formatDiagnostics(d) {
  return [...tables(d).map((t) => textTable(t.title, t.headers, t.rows)), `Notes:\n${d.notes.map((n) => `- ${n}`).join('\n')}`, ''].join('\n\n');
}

/** @param {object} d diagnose() result @returns {string} GitHub-flavored markdown */
export function diagnosticsToMarkdown(d) {
  const L = ['# Diagnostics: the reward signal in static games (tuning seeds)', '', '## How to read this', '',
    '- Every number comes from static games: no Director was involved. A ratio above 1 means that enemy type earns more reward per unit of threat than the average type, whatever the player builds.',
    '- eta squared is the share of the variance of the per-wave rewards explained by the player style (etaStyle) or by the wave (etaWave); a low etaStyle means the reward says little about the defense.',
    '- The noise floor compares the wave-to-wave sd of the reward (for the same style, wave and type, across seeds) with the spread between types.', ''];
  for (const t of tables(d)) L.push(`## ${t.title}`, '', mdTable(t.headers, t.rows), '');
  L.push('## Notes', '', ...d.notes.map((n) => `- ${n}`), '');
  return L.join('\n');
}
