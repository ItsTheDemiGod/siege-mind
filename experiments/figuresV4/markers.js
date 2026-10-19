// Marker drawing for the v4 figures. The legacy svg.js has no 'plus', so shapes are dispatched here without editing it.
import { markerPath, fmt, escapeXml } from '../figures/svg.js';

const STROKE_ONLY = new Set(['cross', 'plus']);

/** @param {string} shape @returns {string} SVG path of the marker centered on (x, y) @throws {RangeError} for an unknown shape */
export function shapePath(shape, x, y, size) {
  if (shape !== 'plus') return markerPath(shape, x, y, size);
  const r = size / 2;
  return `M ${fmt(x - r)} ${fmt(y)} L ${fmt(x + r)} ${fmt(y)} M ${fmt(x)} ${fmt(y - r)} L ${fmt(x)} ${fmt(y + r)}`;
}

/** A marker element; stroke-only shapes ignore `hollow`, closed shapes are filled with `color` or with the background when hollow. */
export function mark(shape, x, y, size, { color, hollow = false, background = '#ffffff' }) {
  const strokeOnly = STROKE_ONLY.has(shape);
  const fill = strokeOnly ? 'none' : hollow ? background : color;
  return `<path d="${shapePath(shape, x, y, size)}" fill="${escapeXml(fill)}" stroke="${escapeXml(color)}" stroke-width="${strokeOnly ? 2.2 : 1.6}"/>`;
}

/** Pattern definitions for the six mode fills (the bar and legend swatches). @returns {{defs: string, fill: (mode: string) => string}} */
export function modePatterns(styleOf, background = '#ffffff') {
  const defs = [];
  const fills = {};
  for (const [mode, { color, pattern }] of Object.entries(styleOf)) {
    if (pattern === 'solid') { fills[mode] = color; continue; }
    const art = {
      diagonal: `<path d="M -1 7 L 7 -1 M -1 1 L 1 -1 M 5 7 L 7 5" stroke="${color}" stroke-width="1.6" fill="none"/>`,
      dots: `<circle cx="3" cy="3" r="1.4" fill="${color}"/>`,
      horizontal: `<path d="M 0 2 H 6 M 0 5 H 6" stroke="${color}" stroke-width="1.5" fill="none"/>`,
      vertical: `<path d="M 2 0 V 6 M 5 0 V 6" stroke="${color}" stroke-width="1.5" fill="none"/>`,
      cross: `<path d="M 3 0 V 6 M 0 3 H 6" stroke="${color}" stroke-width="1.5" fill="none"/>`,
    }[pattern];
    defs.push(`<pattern id="pat-${mode}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${background}"/>${art}</pattern>`);
    fills[mode] = `url(#pat-${mode})`;
  }
  return { defs: `<defs>${defs.join('')}</defs>`, fill: (mode) => fills[mode] };
}
