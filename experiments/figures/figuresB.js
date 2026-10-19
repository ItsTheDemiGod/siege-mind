// Figures 4-6 (pure builders). Enemy types differ by marker shape or fill pattern; weights by a triangle glyph as well as by color.
import { ENEMIES, ENEMY_ORDER } from '../../src/data/enemies.js';
import { MARKERS, PATTERNS } from '../../src/ui/directorChart.js';
import { FIGURE_PALETTE as P } from './palette.js';
import { svgDocument, scaleLinear, niceTicks, fmt } from './svg.js';
import { text, line, rect, marker, patterns, legend, caption, MODE_MARKERS, MODE_LABELS } from './draw.js';
import { WIDTH } from './figuresA.js';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** Mix white toward `color` by t in [0, 1] (plain arithmetic). */
const tint = (color, t) => `#${hex(color).map((c) => Math.round(255 + (c - 255) * t).toString(16).padStart(2, '0')).join('')}`;
const DEAD_ZONE = [0.91, 1.1]; // weights inside this band show no glyph

const tri = (x, y, dir, fill) => `<path d="${dir === 'up' ? `M ${fmt(x)} ${fmt(y - 6)} L ${fmt(x + 6)} ${fmt(y + 5)} L ${fmt(x - 6)} ${fmt(y + 5)} Z` : `M ${fmt(x - 6)} ${fmt(y - 5)} L ${fmt(x + 6)} ${fmt(y - 5)} L ${fmt(x)} ${fmt(y + 6)} Z`}" fill="${fill}" stroke="${P.ink}" stroke-width="1"/>`;

/** Figure 4: mean final weight per style and enemy type (adaptive mode) as a labelled heatmap. */
export function weightsHeatmapFigure(analysis) {
  const tilts = analysis.tiltAlignment.tilts;
  const styles = Object.keys(tilts);
  const L = 150;
  const T = 100;
  const cw = 142;
  const ch = 56;
  const out = [text(WIDTH / 2, 28, 'Figure 4. Mean final enemy weight per bot style, adaptive mode (tuning set)', { size: 16, anchor: 'middle', weight: 'bold' })];
  ENEMY_ORDER.forEach((t, j) => {
    const cx = L + j * cw + cw / 2;
    out.push(marker(MARKERS[t], cx - 52, T - 36, 10, { fill: P.ink, stroke: P.ink }), text(cx - 42, T - 31, ENEMIES[t].name, { size: 12, weight: 'bold' }));
  });
  styles.forEach((s, i) => {
    const y = T + i * ch;
    out.push(text(L - 12, y + ch / 2 + 4, s, { size: 12, anchor: 'end' }));
    ENEMY_ORDER.forEach((t, j) => {
      const w = tilts[s][t].mean;
      const d = Math.min(1, Math.abs(w - 1) / 0.5) * 0.7;
      const fill = w >= 1 ? tint(P.up, d) : tint(P.down, d);
      const x = L + j * cw;
      out.push(`<g data-cell="${s}:${t}">`, rect(x + 1, y + 1, cw - 2, ch - 2, { fill, stroke: P.background, width: 2 }), text(x + cw / 2 + 8, y + ch / 2 + 6, w.toFixed(2), { size: 17, anchor: 'middle', weight: 'bold' }));
      if (w > DEAD_ZONE[1]) out.push(tri(x + 16, y + ch / 2, 'up', P.background));
      else if (w < DEAD_ZONE[0]) out.push(tri(x + 16, y + ch / 2, 'down', P.background));
      out.push('</g>');
    });
  });
  const B = T + styles.length * ch;
  out.push(tri(L + 6, B + 22, 'up', P.background), text(L + 18, B + 26, 'weight above 1.10 (raised)', { size: 12 }), tri(L + 220, B + 22, 'down', P.background), text(L + 232, B + 26, 'weight below 0.91 (lowered)', { size: 12 }));
  out.push(caption(16, B + 54, 'Cell value: the mean over seeds of the applied weight (tilt) at the last eligible wave, adaptive mode; 1.00 means the static mix. Blue fill: below 1; vermillion fill: above 1; the triangle glyph repeats the direction for cells outside 0.91 to 1.10. Tuning-set results are exploratory.'));
  return svgDocument({ width: WIDTH, height: B + 54 + 3 * 16 + 12, title: 'Mean final enemy weight per style', desc: 'Heatmap of the Director\'s mean final weight per enemy type for each bot style in adaptive mode.', body: out.join('\n') });
}

/** Figure 5: tilt-alignment rate, adaptive versus random, per style with a prediction. */
export function tiltAlignmentFigure(analysis) {
  const per = analysis.tiltAlignment.perStyle;
  const styles = Object.keys(per);
  const L = 230;
  const R = WIDTH - 40;
  const T = 96;
  const rowH = 74;
  const x = scaleLinear([0, 1], [L, R]);
  const B = T + styles.length * rowH;
  const out = [text(WIDTH / 2, 28, 'Figure 5. How often the final weights lean toward the predicted enemy types (tuning set)', { size: 16, anchor: 'middle', weight: 'bold' })];
  out.push(legend(L, 58, ['adaptive', 'random'].map((m) => ({ marker: MODE_MARKERS[m], color: P.modes[m], label: MODE_LABELS[m] }))));
  for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1]) { out.push(line(x(t), T - 10, x(t), B, { stroke: P.grid })); out.push(text(x(t), B + 18, `${Math.round(t * 100)}%`, { size: 11, anchor: 'middle', fill: P.muted })); }
  styles.forEach((s, i) => {
    const cy = T + i * rowH + rowH / 2;
    out.push(text(L - 14, cy - 2, s, { size: 12, anchor: 'end', weight: 'bold' }), text(L - 14, cy + 14, `predicted: ${per[s].predictedTypes.join(', ')}`, { size: 11, anchor: 'end', fill: P.muted }));
    ['adaptive', 'random'].forEach((m, mi) => {
      const c = per[s][m];
      const y = cy + (mi - 0.5) * 22;
      out.push(`<g data-point="${s}:${m}">`, line(x(c.wilson[0]), y, x(c.wilson[1]), y, { stroke: P.modes[m], width: 2 }), marker(MODE_MARKERS[m], x(c.rate), y, 11, { fill: P.modes[m], stroke: P.modes[m] }), '</g>');
    });
  });
  out.push(text((L + R) / 2, B + 38, 'share of games with a final weight of at least 1.15 on a predicted type', { size: 12, anchor: 'middle' }));
  out.push(caption(16, B + 62, 'Only games that reached an eligible wave are counted (amendment A1). Whiskers are Wilson 95% intervals. Tuning-set results are exploratory.'));
  return svgDocument({ width: WIDTH, height: B + 62 + 16 + 14, title: 'Tilt alignment, adaptive versus random', desc: 'Dot and whisker chart of the share of games whose final enemy weights lean toward the predicted types, adaptive versus random control.', body: out.join('\n') });
}

/** Figure 6: diagnostics of the reward signal in static games. */
export function diagnosticsFigure(diag) {
  const pat = patterns('f6', [...ENEMY_ORDER.map((t) => ({ name: t, color: P.ink, kind: PATTERNS[t] })), { name: 'eta-style', color: P.ink, kind: 'solid' }, { name: 'eta-wave', color: P.ink, kind: 'diagonal' }]);
  const out = [pat.defs, text(WIDTH / 2, 28, 'Figure 6. Why the weights follow tankiness: the reward signal in static games (tuning seeds)', { size: 16, anchor: 'middle', weight: 'bold' })];
  const T = 90;
  const B = 340;
  const ratios = ENEMY_ORDER.map((t) => diag.baseline5.overall[t].ratio);
  const yA = scaleLinear([0, Math.max(1.5, ...ratios) * 1.1], [B, T]);
  const L1 = 60;
  const R1 = 450;
  out.push(text(L1, 62, '(a) Reward per unit of threat, relative to the all-type average (waves 5+)', { size: 13, weight: 'bold' }));
  for (const t of niceTicks(0, Math.max(1.5, ...ratios), 4)) { out.push(line(L1, yA(t), R1, yA(t))); out.push(text(L1 - 6, yA(t) + 4, fmt(t), { size: 11, anchor: 'end', fill: P.muted })); }
  const bw = (R1 - L1) / ENEMY_ORDER.length;
  ENEMY_ORDER.forEach((t, i) => {
    const bx = L1 + i * bw + 10;
    out.push(rect(bx, yA(ratios[i]), bw - 20, B - yA(ratios[i]), { fill: pat.fill(t), stroke: P.ink, width: 1.5, data: { 'data-type': t, 'data-panel': 'a' } }), text(bx + (bw - 20) / 2, yA(ratios[i]) - 5, ratios[i].toFixed(2), { size: 11, anchor: 'middle' }));
    ENEMIES[t].name.split(' ').forEach((word, k) => out.push(text(bx + (bw - 20) / 2, B + 16 + k * 14, word, { size: 11, anchor: 'middle' })));
  });
  out.push(line(L1, yA(1), R1, yA(1), { stroke: P.ink, dash: '5 4', width: 1.5 }), text(R1 + 4, yA(1) + 4, '1.0', { size: 11 }), line(L1, B, R1, B, { stroke: P.ink }));
  const L2 = 540;
  const R2 = WIDTH - 20;
  const yB = scaleLinear([0, 1], [B, T]);
  out.push(text(L2, 62, '(b) Share of reward variance explained', { size: 13, weight: 'bold' }));
  for (const t of [0, 0.25, 0.5, 0.75, 1]) { out.push(line(L2, yB(t), R2, yB(t))); out.push(text(L2 - 6, yB(t) + 4, fmt(t), { size: 11, anchor: 'end', fill: P.muted })); }
  const gw = (R2 - L2) / ENEMY_ORDER.length;
  ENEMY_ORDER.forEach((t, i) => {
    const gx = L2 + i * gw + 8;
    [['etaStyle', 'eta-style'], ['etaWave', 'eta-wave']].forEach(([key, name], k) => {
      const v = diag.variance[t][key];
      const bx = gx + k * 26;
      out.push(rect(bx, yB(v), 24, B - yB(v), { fill: pat.fill(name), stroke: P.ink, width: 1.5, data: { 'data-type': t, 'data-panel': 'b', 'data-series': key } }), text(bx + 12, yB(v) - 5, v.toFixed(2), { size: 11, anchor: 'middle' }));
    });
    ENEMIES[t].name.split(' ').forEach((word, k) => out.push(text(gx + 25, B + 16 + k * 14, word, { size: 11, anchor: 'middle' })));
  });
  out.push(line(L2, B, R2, B, { stroke: P.ink }));
  out.push(legend(L2, B + 64, [{ fill: pat.fill('eta-style'), color: P.ink, label: 'explained by style' }, { fill: pat.fill('eta-wave'), color: P.ink, label: 'explained by wave' }]));
  out.push(caption(16, B + 92, 'These are static-mode measurements: no Director influenced the games. (a) A bar above 1 means an enemy type earns more reward per unit of threat than the average type, whatever the player builds. (b) Eta squared is the share of the variance of the per-wave reward of a type explained by the bot style (solid) or by the wave (hatched).'));
  return svgDocument({ width: WIDTH, height: B + 92 + 3 * 16 + 12, title: 'Reward signal diagnostics in static games', desc: 'Bar charts of the reward ratio per enemy type and of the share of reward variance explained by style and wave, measured in static games.', body: out.join('\n') });
}
