// Text and markdown renderings of a firstLook result (pure, deterministic).
const f = (x, d = 3) => (x === null || x === undefined ? '-' : x.toFixed(d));
const ci = (c) => (c ? `[${f(c[0])}, ${f(c[1])}]` : '-');
const pct = (x) => `${(100 * x).toFixed(0)}%`;

function textTable(title, headers, rows, leftCols = 1) {
  const all = [headers, ...rows.map((r) => r.map(String))];
  const widths = headers.map((_, c) => Math.max(...all.map((r) => r[c].length)));
  const line = (r) => r.map((v, c) => (c < leftCols ? v.padEnd(widths[c]) : v.padStart(widths[c]))).join('  ');
  return [title, line(headers), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map((r) => line(r.map(String)))].join('\n');
}
const mdTable = (headers, rows) => [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(String).join(' | ')} |`)].join('\n');

/** Every table as { title, headers, rows, left } so text and markdown share the content. */
function tables(r) {
  const out = [];
  const p = r.population;
  out.push({ title: 'Population (units whose static game reached wave 5 or later)', headers: ['units', 'seeds', 'units excluded', 'all units', 'all seeds'], rows: [[p.units, p.seeds, p.excluded, p.totalUnits, p.allSeeds]], left: 0 });
  const styles = Object.keys(r.descriptive.livesLost.byStyleMode);
  for (const [metric, label] of [['livesLost', 'Lives lost'], ['won', 'Win rate'], ['finalWave', 'Final wave'], ['leakFraction', 'Leak fraction'], ['penetration', 'Penetration']]) {
    const cell = (c) => (metric === 'won' ? `${pct(c.mean)} ${ci(c.wilson)} (n ${c.n})` : `${f(c.mean)} (sd ${f(c.sd)}, n ${c.n})`);
    out.push({
      title: `${label} by style and mode, on the population`, headers: ['style', ...r.modes],
      rows: [...styles.map((s) => [s, ...r.modes.map((m) => cell(r.descriptive[metric].byStyleMode[s][m]))]), ['all', ...r.modes.map((m) => cell(r.descriptive[metric].byMode[m]))]], left: 1,
    });
  }
  for (const metric of ['livesLost', 'won', 'finalWave']) {
    out.push({
      title: `Paired mode differences in ${metric} (A - B, seed-level, population; exploratory, NOT adjusted)`, headers: ['A', 'B', 'seeds', 'mean diff', '95% CI', 'dz', 'p raw'],
      rows: r.pairs.filter((x) => x.metric === metric).map((x) => [x.a, x.b, x.n, f(x.meanDiff), ci(x.ci95), f(x.dz, 2), f(x.pRaw, 4)]), left: 2,
    });
  }
  out.push({
    title: 'Fixed-wave style contrast (final weight of a style on its predicted type minus the other styles; tilt taken from the wave itself)',
    headers: ['wave', 'mode', 'observed units', 'coverage', 'seeds', 'mean contrast', '95% CI', 'p raw'],
    rows: r.fixedWave.map((c) => [c.wave, c.mode, `${c.observedUnits}/${c.popUnits}`, pct(c.coverage), c.seeds, f(c.mean), ci(c.ci95), f(c.pRaw, 4)]), left: 2,
  });
  out.push({
    title: `Per (style, type) contrast at wave ${r.bestWave} (the wave with the best coverage)`, headers: ['mode', 'style', 'type', 'n', 'mean contrast'],
    rows: r.perPairAtBest.flatMap((c) => c.perPair.map((x) => [c.mode, x.style, x.type, x.n, f(x.mean)])), left: 3,
  });
  out.push({ title: 'Units that ended before wave 5, by mode', headers: ['mode', 'units', 'ended early', 'won'], rows: Object.entries(r.earlyEnds.byMode).map(([m, x]) => [m, x.units, x.endedEarly, x.won]), left: 1 });
  return out;
}

const earlyLine = (r) => (r.earlyEnds.identical
  ? 'Early-ends invariant holds: the same (style, seed) units ended before wave 5 in every mode.'
  : `WARNING: AN INVARIANT IS VIOLATED: the early-ending units differ between modes (${r.earlyEnds.mismatches.length} units, e.g. ${r.earlyEnds.mismatches.slice(0, 3).map((m) => m.unit).join(', ')}).`);
const head = (r) => `First look at the research arms: modes ${r.modes.join(', ')}; ${r.population.units} of ${r.population.totalUnits} units in the population.`;

/** @param {object} r firstLook() result @returns {string} aligned plain text */
export function formatFirstLook(r) {
  return [head(r), ...tables(r).map((t) => textTable(t.title, t.headers, t.rows, t.left)), earlyLine(r), `Notes:\n${r.notes.map((n) => `- ${n}`).join('\n')}`, ''].join('\n\n');
}

/** @param {object} r firstLook() result @returns {string} GitHub-flavored markdown */
export function firstLookToMarkdown(r) {
  const L = ['# First look at the new arms (exploratory, training seeds)', '', head(r), ''];
  for (const t of tables(r)) L.push(`## ${t.title}`, '', mdTable(t.headers, t.rows), '');
  L.push(earlyLine(r), '', '## Notes', '', ...r.notes.map((n) => `- ${n}`), '');
  return L.join('\n');
}
