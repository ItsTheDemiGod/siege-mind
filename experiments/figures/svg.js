// Tiny SVG toolkit for the figures: escaping, number formatting, ticks, scales, markers and the document wrapper. Pure and deterministic
// (plain arithmetic only; no pow, exp or log).
import { FIGURE_PALETTE, FONT } from './palette.js';

/** @param {*} s @returns {string} text safe for XML text and attribute values */
export const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** @param {number} x @returns {string} the number rounded to 2 decimals without trailing zeros (-0 becomes 0) @throws {TypeError} for non-finite input */
export function fmt(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new TypeError(`fmt needs a finite number, got ${String(x)}`);
  const r = Math.round(x * 100) / 100;
  return String(r === 0 ? 0 : r);
}

/**
 * About `count` tick values with a 1, 2 or 5 step that cover [min, max].
 * @param {number} min @param {number} max @param {number} [count] @returns {number[]}
 */
export function niceTicks(min, max, count = 5) {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  let mag = 1;
  while (mag * 10 <= raw) mag *= 10;
  while (mag > raw) mag /= 10;
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const ticks = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step);
  return ticks.map((t) => Math.round(t * 1e9) / 1e9 + 0); // + 0 turns -0 into 0
}

/** @param {[number, number]} domain @param {[number, number]} range @returns {(x: number) => number} */
export function scaleLinear([d0, d1], [r0, r1]) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (x) => r0 + (x - d0) * k;
}

/**
 * Path of a marker centered on (x, y); `size` is its width in px.
 * @param {'circle'|'square'|'triangle'|'diamond'|'cross'} shape @returns {string} an SVG path d attribute
 */
export function markerPath(shape, x, y, size) {
  const r = size / 2;
  const [X, Y, R] = [fmt(x), fmt(y), fmt(r)];
  switch (shape) {
    case 'circle': return `M ${fmt(x - r)} ${Y} a ${R} ${R} 0 1 0 ${fmt(size)} 0 a ${R} ${R} 0 1 0 ${fmt(-size)} 0 Z`;
    case 'square': return `M ${fmt(x - r)} ${fmt(y - r)} h ${fmt(size)} v ${fmt(size)} h ${fmt(-size)} Z`;
    case 'triangle': return `M ${X} ${fmt(y - r)} L ${fmt(x + r)} ${fmt(y + r)} L ${fmt(x - r)} ${fmt(y + r)} Z`;
    case 'diamond': return `M ${X} ${fmt(y - r)} L ${fmt(x + r)} ${Y} L ${X} ${fmt(y + r)} L ${fmt(x - r)} ${Y} Z`;
    case 'cross': return `M ${fmt(x - r)} ${fmt(y - r)} L ${fmt(x + r)} ${fmt(y + r)} M ${fmt(x - r)} ${fmt(y + r)} L ${fmt(x + r)} ${fmt(y - r)}`;
    default: throw new RangeError(`unknown marker shape: ${String(shape)}`);
  }
}

/**
 * @param {{width: number, height: number, title: string, desc: string, body: string}} o body is already-built SVG markup
 * @returns {string} a complete standalone SVG document with a viewBox, title, description and a white background
 */
export function svgDocument({ width, height, title, desc, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(width)} ${fmt(height)}" width="${fmt(width)}" height="${fmt(height)}" role="img" aria-labelledby="fig-title fig-desc">
<title id="fig-title">${escapeXml(title)}</title>
<desc id="fig-desc">${escapeXml(desc)}</desc>
<rect width="${fmt(width)}" height="${fmt(height)}" fill="${FIGURE_PALETTE.background}"/>
<g font-family="${FONT}" fill="${FIGURE_PALETTE.ink}">
${body}
</g>
</svg>
`;
}
