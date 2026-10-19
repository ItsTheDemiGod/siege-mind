// Figures 1-3 (pure builders: an analysis result in, an SVG string out). Width 960, text at least 11 px, captions inside the SVG.
import { FIGURE_PALETTE as P } from './palette.js';
import { svgDocument, niceTicks, scaleLinear, fmt } from './svg.js';
import { text, line, rect, marker, patterns, legend, caption, MODE_MARKERS, MODE_PATTERNS, MODE_LABELS } from './draw.js';

export const WIDTH = 960;
const MODES = ['static', 'adaptive', 'random'];
const FAMILY_MARKER = { primary: 'circle', secondary: 'square', descriptive: 'diamond' };
const PANELS = [['Lives lost', ['P1', 'P2', 'C1']], ['Win rate', ['S1', 'S2']], ['Leaked threat fraction', ['S3', 'S4']], ['Path penetration', ['S5', 'S6']], ['Final wave reached', ['S7', 'S8']], ['Tilt alignment', ['T1']]];

/** Figure 1: forest plot of every hypothesis, one small panel per metric. */
export function forestFigure(analysis) {
  const byId = Object.fromEntries(analysis.hypotheses.map((h) => [h.id, h]));
  const out = [text(WIDTH / 2, 28, 'Figure 1. Differences between modes: mean difference with 95% CI (seed-level, tuning set)', { size: 16, anchor: 'middle', weight: 'bold' })];
  const PW = 316;
  const PH = 196;
  PANELS.forEach(([title, ids], i) => {
    const hyps = ids.map((id) => byId[id]).filter(Boolean);
    const x0 = 8 + (i % 3) * PW;
    const y0 = 56 + Math.floor(i / 3) * PH;
    const plotL = x0 + 92;
    const plotR = x0 + 196;
    const lo = Math.min(0, ...hyps.map((h) => h.ci95[0]));
    const hi = Math.max(0, ...hyps.map((h) => h.ci95[1]));
    const pad = (hi - lo || 1) * 0.08;
    const ticks = niceTicks(lo - pad, hi + pad, 3);
    const x = scaleLinear([Math.min(lo - pad, ticks[0]), Math.max(hi + pad, ticks.at(-1))], [plotL, plotR]);
    const axisY = y0 + 36 + 3 * 42;
    out.push(text(x0, y0 + 18, title, { size: 14, weight: 'bold' }));
    for (const t of ticks) { out.push(line(x(t), y0 + 28, x(t), axisY, { stroke: P.grid })); out.push(text(x(t), axisY + 15, fmt(t), { size: 11, anchor: 'middle', fill: P.muted })); }
    out.push(line(x(0), y0 + 28, x(0), axisY, { stroke: P.ink, dash: '4 3' }));
    hyps.forEach((h, j) => {
      const y = y0 + 52 + j * 42;
      const pText = h.pHolm === null ? `p ${h.pRaw.toFixed(4)} (unadj.)` : `Holm p ${h.pHolm.toFixed(4)}`;
      out.push(`<g data-id="${h.id}">`, text(x0, y - 2, h.id, { size: 12, weight: 'bold' }), text(x0, y + 12, `${h.modeA} - ${h.modeB}`, { size: 11, fill: P.muted }),
        line(x(h.ci95[0]), y, x(h.ci95[1]), y, { stroke: P.ink, width: 2 }), line(x(h.ci95[0]), y - 5, x(h.ci95[0]), y + 5, { stroke: P.ink, width: 2 }), line(x(h.ci95[1]), y - 5, x(h.ci95[1]), y + 5, { stroke: P.ink, width: 2 }),
        marker(FAMILY_MARKER[h.family], x(h.meanDiff), y, 11, { fill: h.family === 'secondary' ? P.background : P.ink }), text(x0 + 204, y + 4, pText, { size: 11 }), '</g>');
    });
  });
  const ly = 56 + 2 * PH + 8;
  out.push(legend(16, ly, [{ marker: 'circle', color: P.ink, label: 'primary' }, { marker: 'square', color: P.ink, label: 'secondary', hollow: true }, { marker: 'diamond', color: P.ink, label: 'descriptive' }]));
  out.push(caption(16, ly + 26, 'Each marker is the mean over seeds of (first mode minus second mode), averaged over the five bot styles; the whisker is the 95% cluster-bootstrap interval; the dashed line marks no difference. Holm p is adjusted within the primary or the secondary family. Tuning-set results are exploratory.'));
  const height = ly + 26 + 3 * 16 + 14;
  return svgDocument({ width: WIDTH, height, title: 'Differences between modes', desc: `Forest plot of ${analysis.hypotheses.length} mode comparisons with 95% confidence intervals and Holm-adjusted p-values.`, body: out.join('\n') });
}

/** Figure 2: mean lives lost by style and mode (grouped bars, error bars of 1.96 standard errors). */
export function livesLostFigure(analysis) {
  const d = analysis.descriptive.livesLost;
  const styles = Object.keys(d.byStyleMode);
  const groups = [...styles.map((s) => ({ name: s, cells: d.byStyleMode[s] })), { name: 'all', cells: d.byMode }];
  const pat = patterns('f2', MODES.map((m) => ({ name: m, color: P.modes[m], kind: MODE_PATTERNS[m] })));
  const L = 70;
  const R = WIDTH - 30;
  const T = 116;
  const B = 400;
  const err = (c) => 1.96 * (c.sd / Math.sqrt(c.n));
  const top = Math.max(...groups.flatMap((g) => MODES.map((m) => g.cells[m].mean + err(g.cells[m]))));
  const ticks = niceTicks(0, top * 1.1, 5);
  const y = scaleLinear([0, Math.max(ticks.at(-1), top * 1.1)], [B, T]);
  const out = [pat.defs, text(WIDTH / 2, 28, 'Figure 2. Mean lives lost by bot style and mode (tuning set)', { size: 16, anchor: 'middle', weight: 'bold' })];
  out.push(legend(L, 56, MODES.map((m) => ({ fill: pat.fill(m), color: P.modes[m], label: MODE_LABELS[m] }))));
  for (const t of ticks) { out.push(line(L, y(t), R, y(t))); out.push(text(L - 8, y(t) + 4, fmt(t), { size: 11, anchor: 'end', fill: P.muted })); }
  out.push(text(18, (T + B) / 2, 'lives lost (of 20)', { size: 12, anchor: 'middle' }).replace('<text ', `<text transform="rotate(-90 18 ${(T + B) / 2})" `));
  const gw = (R - L) / groups.length;
  groups.forEach((g, gi) => {
    const gx = L + gi * gw;
    const bw = 36;
    MODES.forEach((m, mi) => {
      const c = g.cells[m];
      const bx = gx + (gw - 3 * bw - 8) / 2 + mi * (bw + 4);
      const e = err(c);
      out.push(rect(bx, y(c.mean), bw, B - y(c.mean), { fill: pat.fill(m), stroke: P.modes[m], width: 1.5, data: { 'data-bar': `${g.name}:${m}` } }));
      out.push(line(bx + bw / 2, y(c.mean - e), bx + bw / 2, y(c.mean + e), { stroke: P.ink, width: 1.5 }), line(bx + bw / 2 - 5, y(c.mean + e), bx + bw / 2 + 5, y(c.mean + e), { stroke: P.ink, width: 1.5 }), line(bx + bw / 2 - 5, y(c.mean - e), bx + bw / 2 + 5, y(c.mean - e), { stroke: P.ink, width: 1.5 }));
      out.push(text(bx + bw / 2, y(c.mean + e) - 5, c.mean.toFixed(1), { size: 11, anchor: 'middle' }));
    });
    out.push(text(gx + gw / 2, B + 20, g.name, { size: 12, anchor: 'middle' }));
  });
  out.push(line(L, B, R, B, { stroke: P.ink }));
  out.push(caption(16, B + 44, 'Bars are the mean lives lost over seeds (a lost game counts as 20); error bars are mean plus or minus 1.96 standard errors (normal approximation over seeds). Group "all" pools the five styles. Tuning-set results are exploratory.'));
  return svgDocument({ width: WIDTH, height: B + 44 + 3 * 16 + 12, title: 'Mean lives lost by style and mode', desc: 'Grouped bar chart of mean lives lost for static, adaptive and random modes, per bot style and pooled.', body: out.join('\n') });
}

/** Figure 3: win rate by style and mode as dots with Wilson intervals. */
export function winRateFigure(analysis) {
  const d = analysis.descriptive.won;
  const styles = Object.keys(d.byStyleMode);
  const rows = [...styles.map((s) => ({ name: s, cells: d.byStyleMode[s] })), { name: 'all', cells: d.byMode }];
  const L = 150;
  const R = WIDTH - 40;
  const T = 84;
  const rowH = 68;
  const x = scaleLinear([0, 1], [L, R]);
  const B = T + rows.length * rowH;
  const out = [text(WIDTH / 2, 28, 'Figure 3. Win rate by bot style and mode, with Wilson 95% intervals (tuning set)', { size: 16, anchor: 'middle', weight: 'bold' })];
  out.push(legend(L, 56, MODES.map((m) => ({ marker: MODE_MARKERS[m], color: P.modes[m], label: MODE_LABELS[m] }))));
  for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1]) { out.push(line(x(t), T - 8, x(t), B, { stroke: P.grid })); out.push(text(x(t), B + 18, `${Math.round(t * 100)}%`, { size: 11, anchor: 'middle', fill: P.muted })); }
  rows.forEach((r, i) => {
    const cy = T + i * rowH + rowH / 2;
    out.push(text(L - 12, cy + 4, r.name, { size: 12, anchor: 'end', weight: r.name === 'all' ? 'bold' : 'normal' }));
    MODES.forEach((m, mi) => {
      const c = r.cells[m];
      const y = cy + (mi - 1) * 17;
      out.push(`<g data-point="${r.name}:${m}">`, line(x(c.wilson[0]), y, x(c.wilson[1]), y, { stroke: P.modes[m], width: 2 }), marker(MODE_MARKERS[m], x(c.mean), y, 11, { fill: P.modes[m], stroke: P.modes[m] }), '</g>');
    });
  });
  out.push(text((L + R) / 2, B + 38, 'win rate', { size: 12, anchor: 'middle' }));
  out.push(caption(16, B + 62, `Each marker is the share of games won; the whisker is the Wilson 95% interval over the games of that style and mode (${analysis.n.seeds} seeds per style, ${analysis.n.seeds * analysis.n.styles} games per mode). Tuning-set results are exploratory.`));
  return svgDocument({ width: WIDTH, height: B + 62 + 2 * 16 + 14, title: 'Win rate by style and mode', desc: 'Dot and whisker chart of win rates with Wilson intervals for static, adaptive and random modes per bot style.', body: out.join('\n') });
}
