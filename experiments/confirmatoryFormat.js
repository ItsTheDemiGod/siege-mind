// Text and markdown renderings of a confirmatory result (pure, deterministic). The first line is always the banner naming the label.
const f = (x, d = 3) => (x === null || x === undefined ? '-' : x.toFixed(d));
const ci = (c) => (c ? `[${f(c[0])}, ${f(c[1])}]` : '-');
const pct = (x) => `${(100 * x).toFixed(0)}%`;
const yesNo = (b) => (b ? 'yes' : 'no');

function textTable(title, headers, rows) {
  const all = [headers, ...rows.map((r) => r.map(String))];
  const widths = headers.map((_, c) => Math.max(...all.map((r) => r[c].length)));
  const line = (r) => r.map((v, c) => (c === 0 ? v.padEnd(widths[c]) : v.padStart(widths[c]))).join('  ');
  return [title, line(headers), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map((r) => line(r.map(String)))].join('\n');
}
const mdTable = (headers, rows) => [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(String).join(' | ')} |`)].join('\n');

function incompleteLines(r) {
  const c = r.completeness;
  return [`Completeness: INCOMPLETE (${c.actual} rows, ${c.expected} expected; missing ${c.missing.slice(0, 5).join(', ') || 'none'}; duplicates ${c.duplicates.slice(0, 5).join(', ') || 'none'}; unknown rows ${c.unknownRows}). No statistic was computed.`];
}

/** Every table as { title, headers, rows } so text and markdown share the content. */
function tables(r) {
  const out = [];
  out.push({ title: 'Confirmatory family K1-K3 (Holm across exactly these three; supported = predicted sign AND Holm p below 0.05)', headers: ['id', 'hypothesis', 'seeds', 'estimate', '95% CI', 'p raw', 'p Holm', 'supported'], rows: r.confirmatory.map((k) => [k.id, k.label, k.n, f(k.estimate), ci(k.ci95), f(k.pRaw, 4), f(k.pHolm, 4), yesNo(k.supported)]) });
  const metrics = [...new Set(r.estimands.map((e) => e.metric))];
  for (const metric of metrics) out.push({ title: `Estimand ${metric} (A - B, seed-level on the population; estimate and 95% cluster bootstrap CI, no p-values)`, headers: ['pair', 'seeds', 'estimate', '95% CI'], rows: r.estimands.filter((e) => e.metric === metric).map((e) => [e.pair, e.n, f(e.estimate), ci(e.ci95)]) });
  out.push({ title: 'Fixed-wave style contrast (unlocked predicted types only; estimate and 95% CI, no p-values)', headers: ['wave', 'mode', 'seeds', 'observed units', 'coverage', 'estimate', '95% CI', 'zero check'], rows: r.contrasts.map((c) => [c.wave, c.mode, c.n, `${c.unitsObserved}/${c.populationUnits}`, pct(c.coverage), f(c.estimate), ci(c.ci95), c.zeroCheck === undefined ? '-' : (c.zeroCheck ? 'ok' : 'VIOLATED')]) });
  const cv = r.coverageAtPrimary;
  out.push({ title: `Coverage at the primary wave ${cv.wave}`, headers: ['mode', 'observed', 'population', 'coverage'], rows: Object.entries(cv.perMode).map(([m, x]) => [m, x.observed, x.populationUnits, pct(x.coverage)]) });
  const s = r.sensitivity;
  out.push({ title: 'Sensitivity: K1 on all units; K2 and K3 on the matched set', headers: ['analysis', 'units / seeds', 'estimate', '95% CI'], rows: [['K1 on all units', `${s.k1AllUnits.units} units / ${s.k1AllUnits.n} seeds`, f(s.k1AllUnits.estimate), ci(s.k1AllUnits.ci95)], ...['K2', 'K3'].map((id) => [`${id} on the matched set`, `${s.matchedSet.units} units / ${s.matchedSet[id].n} seeds`, f(s.matchedSet[id].estimate), ci(s.matchedSet[id].ci95)])] });
  out.push({ title: 'Sensitivity: leave-one-style-out estimate (the style removed)', headers: ['hypothesis', ...Object.keys(s.leaveOneStyleOut[0].byStyleRemoved), 'min', 'max', 'sign stable'], rows: s.leaveOneStyleOut.map((l) => [l.id, ...Object.values(l.byStyleRemoved).map((x) => f(x)), f(l.min), f(l.max), yesNo(l.signStable)]) });
  out.push({ title: `Power (${r.power.label}): seeds needed for 80% power at the observed estimate and alpha ${r.power.alpha}`, headers: ['id', 'sd of seed values', 'seeds needed'], rows: r.power.hypotheses.map((p) => [p.id, f(p.sd), p.seedsNeeded ?? '-']) });
  return out;
}

function lines(r) {
  const cv = r.coverageAtPrimary;
  const L = [`Population: ${r.population.units} units (${r.population.rule}), ${r.population.excluded} excluded; ${r.n.seeds} seeds x ${r.n.styles} styles x ${r.n.modes} modes = ${r.n.rows} games.`,
    `Coverage rule (${cv.rule}): minimum coverage at wave ${cv.wave} is ${pct(cv.minCoverage)}; rule met at the primary wave: ${yesNo(cv.metRule)}; the rule itself would choose wave ${cv.ruleChoice.chosen} (met: ${yesNo(cv.ruleChoice.metRule)}). Registered: met ${yesNo(cv.registered.coverageRuleMet)}, training coverage ${pct(cv.registered.trainingCoverageAtPrimary)}.`];
  const bad = r.contrasts.filter((c) => c.zeroCheck === false);
  if (bad.length) L.push(`WARNING: THE CONTRAST OF A MODE THAT CANNOT DEPEND ON THE DEFENSE IS NOT 0: ${bad.map((c) => `${c.mode} wave ${c.wave}`).join('; ')}`);
  return L;
}

/** @param {object} r analyzeConfirmatory() result @returns {string} aligned plain text, banner first */
export function formatConfirmatory(r) {
  const head = [r.banner, `Protocol version ${r.protocolVersion}, hash ${r.protocolHash}.`];
  if (!r.completeness.complete) return [...head, ...incompleteLines(r), `Notes:\n${r.notes.map((n) => `- ${n}`).join('\n')}`, ''].join('\n\n');
  return [...head, ...tables(r).slice(0, 1).map((t) => textTable(t.title, t.headers, t.rows)), ...lines(r), ...tables(r).slice(1).map((t) => textTable(t.title, t.headers, t.rows)), `Notes:\n${r.notes.map((n) => `- ${n}`).join('\n')}`, ''].join('\n\n');
}

/** @param {object} r analyzeConfirmatory() result @returns {string} GitHub-flavored markdown, banner first */
export function confirmatoryToMarkdown(r) {
  const L = [`# ${r.banner}`, '', `Protocol version ${r.protocolVersion}, hash \`${r.protocolHash}\`.`, '',
    '## How to read this', '',
    '- Only K1, K2 and K3 are tests. A hypothesis is "supported" only when its estimate has the predicted sign and its Holm-adjusted p-value is below 0.05; otherwise the data show no detectable effect at this sample size, which is not proof of absence.',
    '- K1: does random composition alone (random minus static) cost lives? K2 and K3: do the final weights of Director v1 and v2 separate the defenses in the predicted direction at the primary wave?',
    '- Everything else (the estimand tables, the contrast tables, the attribution pairs) is estimation: a point estimate with a 95% interval over seeds, never a p-value.',
    '- Coverage says how many population units reached the wave at which a weight is observed; low coverage means a noisier contrast.', ''];
  if (!r.completeness.complete) return [...L, '## Completeness', '', ...incompleteLines(r), '', '## Notes', '', ...r.notes.map((n) => `- ${n}`), ''].join('\n');
  const all = tables(r);
  L.push(`## ${all[0].title}`, '', mdTable(all[0].headers, all[0].rows), '', ...lines(r).flatMap((l) => [l, '']));
  for (const t of all.slice(1)) L.push(`## ${t.title}`, '', mdTable(t.headers, t.rows), '');
  L.push('## Notes', '', ...r.notes.map((n) => `- ${n}`), '');
  return L.join('\n');
}
