// Drawing helpers shared by the figures: every function returns an SVG markup string. Text is always escaped.
import { FIGURE_PALETTE as P } from './palette.js';
import { escapeXml, fmt, markerPath } from './svg.js';

export const MODE_MARKERS = Object.freeze({ static: 'circle', adaptive: 'square', random: 'triangle' });
export const MODE_PATTERNS = Object.freeze({ static: 'solid', adaptive: 'diagonal', random: 'dots' });
export const MODE_LABELS = Object.freeze({ static: 'Static', adaptive: 'Adaptive', random: 'Random control' });

/** Attributes as ` key="value"` pairs (values escaped; undefined and null skipped). */
const attrs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => ` ${k}="${escapeXml(v)}"`).join('');

export function text(x, y, s, { size = 12, anchor = 'start', weight = 'normal', fill = P.ink, data } = {}) {
  return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" fill="${fill}"${attrs(data ?? {})}>${escapeXml(s)}</text>`;
}

export function line(x1, y1, x2, y2, { stroke = P.grid, width = 1, dash } = {}) {
  return `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}

export function rect(x, y, w, h, { fill = 'none', stroke = 'none', width = 1, data } = {}) {
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"${attrs(data ?? {})}/>`;
}

/** A marker: filled shapes use `fill`, the cross is drawn as strokes. */
export function marker(shape, x, y, size, { fill = P.ink, stroke = P.ink, data } = {}) {
  const cross = shape === 'cross';
  return `<path d="${markerPath(shape, x, y, size)}" fill="${cross ? 'none' : fill}" stroke="${stroke}" stroke-width="${cross ? 2 : 1.5}"${attrs(data ?? {})}/>`;
}

/**
 * Pattern definitions for fills that differ by texture, not only by color.
 * @param {string} prefix unique id prefix within the document @param {{name: string, color: string, kind: 'solid'|'diagonal'|'dots'|'horizontal'|'cross'}[]} items
 * @returns {{defs: string, fill: (name: string) => string}}
 */
export function patterns(prefix, items) {
  const defs = [];
  const fills = {};
  for (const { name, color, kind } of items) {
    if (kind === 'solid') { fills[name] = color; continue; }
    const id = `${prefix}-${name}`;
    const art = {
      diagonal: `<path d="M -1 7 L 7 -1 M -1 1 L 1 -1 M 5 7 L 7 5" stroke="${color}" stroke-width="1.6" fill="none"/>`,
      dots: `<circle cx="3" cy="3" r="1.4" fill="${color}"/>`,
      horizontal: `<path d="M 0 2 H 6 M 0 5 H 6" stroke="${color}" stroke-width="1.5" fill="none"/>`,
      cross: `<path d="M 3 0 V 6 M 0 3 H 6" stroke="${color}" stroke-width="1.5" fill="none"/>`,
    }[kind];
    defs.push(`<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${P.background}"/>${art}</pattern>`);
    fills[name] = `url(#${id})`;
  }
  return { defs: defs.length ? `<defs>${defs.join('')}</defs>` : '', fill: (name) => fills[name] };
}

/** A legend row: swatch (a rect with the same fill as the data) or marker, then the label. Items are laid out left to right from x. */
export function legend(x, y, items, { swatchWidth = 22 } = {}) {
  let cx = x;
  const out = [];
  for (const it of items) {
    if (it.marker) out.push(marker(it.marker, cx + swatchWidth / 2, y - 4, 10, { fill: it.hollow ? P.background : it.color, stroke: it.color }));
    else out.push(rect(cx, y - 12, swatchWidth, 12, { fill: it.fill, stroke: it.color, width: 1.2 }));
    out.push(text(cx + swatchWidth + 6, y - 1, it.label, { size: 12 }));
    cx += swatchWidth + 6 + it.label.length * 6.6 + 18;
  }
  return out.join('\n');
}

/** Wraps a caption to lines of at most `chars` characters. */
export function wrap(captionText, chars) {
  const lines = [];
  let cur = '';
  for (const w of captionText.split(' ')) {
    if (cur && (cur + ' ' + w).length > chars) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function caption(x, y, captionText, { chars = 130 } = {}) {
  return wrap(captionText, chars).map((l, i) => text(x, y + i * 16, l, { size: 12, fill: P.muted })).join('\n');
}
