// Layout kit of the v4 figures: the figure frame (title, status tag, N line, legend, caption) and the forest panel (rows of estimates with
// interval whiskers, optional waterfall bars). Pure, deterministic, plain arithmetic.
import { escapeXml, fmt, niceTicks, scaleLinear, svgDocument } from '../figures/svg.js';
import { text, line, rect, wrap, caption } from '../figures/draw.js';
import { MODE_STYLE, MODE_LABEL, STATUS_STYLE, INK } from './palette.js';
import { mark, modePatterns } from './markers.js';
import { fmtEst } from '../resultsFormat.js';

export const WIDTH = 960;
export const BODY_Y = 76;
const LEFT = 20;

/** @returns {string} markup of one legend: marker plus pattern swatch plus label per mode, three per line */
function legendOf(modes, y, pats) {
  const out = [];
  modes.forEach((m, i) => {
    const x = LEFT + (i % 3) * 300;
    const yy = y + Math.floor(i / 3) * 20;
    const s = MODE_STYLE[m];
    out.push(mark(s.marker, x + 7, yy - 4, 10, { color: s.color }));
    out.push(rect(x + 20, yy - 10, 18, 12, { fill: pats.fill(m), stroke: s.color, width: 1.2 }));
    out.push(text(x + 46, yy, MODE_LABEL[m], { size: 12 }));
  });
  return out.join('\n');
}

/**
 * @param {{num: number, title: string, desc: string, n: string, status: keyof typeof STATUS_STYLE, caption: string, bodyHeight: number, body: string, legendModes?: string[], note?: string}} o
 * @returns {string} a complete SVG document
 */
export function figure({ num, title, desc, n, status, caption: cap, bodyHeight, body, legendModes = [], note = '' }) {
  const st = STATUS_STYLE[status];
  if (!st) throw new RangeError(`unknown status: ${String(status)}`);
  const pats = modePatterns(MODE_STYLE);
  const tagW = st.tag.length * 7.4 + 18;
  let y = BODY_Y + bodyHeight + 10;
  const legend = legendModes.length ? legendOf(legendModes, y + 8, pats) : '';
  if (legendModes.length) y += Math.ceil(legendModes.length / 3) * 20 + 8;
  const noteMarkup = note ? text(LEFT, y + 8, note, { size: 12 }) : '';
  if (note) y += 20;
  const capLines = wrap(cap, 125).length;
  const height = y + 20 + capLines * 16 + 14;
  const head = [
    text(LEFT, 30, `Figure ${num}. ${title}`, { size: 18, weight: 'bold' }),
    `<rect x="${fmt(WIDTH - LEFT - tagW)}" y="12" width="${fmt(tagW)}" height="26" fill="none" stroke="${INK.ink}" stroke-width="1.5"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''} data-status="${escapeXml(status)}"/>`,
    text(WIDTH - LEFT - tagW / 2, 30, st.tag, { size: 12, weight: 'bold', anchor: 'middle' }),
    text(LEFT, 54, n, { size: 12, fill: INK.muted }),
  ].join('\n');
  const foot = `${noteMarkup}\n${caption(LEFT, y + 14, cap, { chars: 125 })}`;
  return svgDocument({ width: WIDTH, height, title: `Figure ${num}. ${title}`, desc, body: [pats.defs, head, body, legend, foot].join('\n') });
}

/**
 * One forest panel. A row is {id, label, items: [{est, ci, style: {color, marker}, hollow?}], right?: string[], status?} or {header}.
 * A row may carry bar: {from, to, mode, value} (a waterfall bar drawn behind the whisker).
 * @returns {{markup: string, height: number}}
 */
export function forestPanel({ y, title, xTitle, rows, status = 'estimate', domain, fmtTick = fmtEst, labelW = 300, plotW = 420, labelChars = 46, rowH = 26 }) {
  const XL = LEFT + labelW;
  const XR = XL + plotW;
  const RX = XR + 14;
  const pats = modePatterns(MODE_STYLE);
  let lo = 0;
  let hi = 0;
  for (const r of rows) {
    for (const it of r.items ?? []) { lo = Math.min(lo, it.ci[0], it.est); hi = Math.max(hi, it.ci[1], it.est); }
    if (r.bar) { lo = Math.min(lo, r.bar.from, r.bar.to); hi = Math.max(hi, r.bar.from, r.bar.to); }
  }
  const pad = (hi - lo) * 0.06 || 1;
  const ticks = niceTicks(domain ? domain[0] : lo - pad, domain ? domain[1] : hi + pad, 5);
  const d0 = domain ? domain[0] : Math.min(lo - pad, ticks[0]);
  const d1 = domain ? domain[1] : Math.max(hi + pad, ticks.at(-1));
  const x = scaleLinear([d0, d1], [XL, XR]);
  const heights = rows.map((r) => (r.header ? 24 : Math.max(rowH, wrap(r.label, labelChars).length * 14 + 10, (r.right?.length ?? 0) * 14 + 10, (r.items?.length ?? 1) * 10 + 12)));
  const top = y + 26;
  const bottom = top + heights.reduce((a, b) => a + b, 0);
  const out = [text(LEFT, y + 14, title, { size: 13, weight: 'bold' })];
  for (const t of ticks) {
    out.push(line(x(t), top, x(t), bottom, { stroke: t === 0 ? INK.ink : INK.grid, width: t === 0 ? 1.4 : 1 }));
    out.push(text(x(t), bottom + 15, fmtTick(t), { size: 11, anchor: 'middle', fill: INK.muted }));
  }
  out.push(line(XL, bottom, XR, bottom, { stroke: INK.muted }));
  out.push(text((XL + XR) / 2, bottom + 33, xTitle, { size: 12, anchor: 'middle', fill: INK.muted }));
  let cy = top;
  rows.forEach((r, i) => {
    const h = heights[i];
    const mid = cy + h / 2;
    cy += h;
    if (r.header) { out.push(text(LEFT, mid + 4, r.header, { size: 12, weight: 'bold', fill: INK.muted })); return; }
    const g = [];
    const lines = wrap(r.label, labelChars);
    lines.forEach((l, k) => g.push(text(LEFT, mid + 4 + (k - (lines.length - 1) / 2) * 14, l, { size: 12 })));
    if (r.bar) {
      const b = r.bar;
      const [bx0, bx1] = [x(Math.min(b.from, b.to)), x(Math.max(b.from, b.to))];
      g.push(`<rect x="${fmt(bx0)}" y="${fmt(mid - 8)}" width="${fmt(bx1 - bx0)}" height="16" fill="${pats.fill(b.mode)}" stroke="${MODE_STYLE[b.mode].color}" stroke-width="1.4" data-bar="${escapeXml(r.id)}" data-from="${b.from}" data-value="${b.value}"/>`);
    }
    const dash = STATUS_STYLE[r.status ?? status].dash;
    const k = r.items.length;
    r.items.forEach((it, j) => {
      const yy = mid + (j - (k - 1) / 2) * 9;
      const c = it.style.color;
      if (it.ci[1] > it.ci[0]) {
        g.push(line(x(it.ci[0]), yy, x(it.ci[1]), yy, { stroke: c, width: 2, dash: dash ?? undefined }));
        for (const e of it.ci) g.push(line(x(e), yy - 4, x(e), yy + 4, { stroke: c, width: 2 }));
      }
      g.push(mark(it.style.marker, x(it.est), yy, 10, { color: c, hollow: it.hollow }));
    });
    (r.right ?? []).forEach((l, j) => g.push(text(RX, mid + 4 + (j - ((r.right.length) - 1) / 2) * 14, l, { size: 12, fill: INK.muted })));
    out.push(`<g data-id="${escapeXml(r.id)}">${g.join('')}</g>`);
  });
  return { markup: out.join('\n'), height: bottom + 40 - y };
}
