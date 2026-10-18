// Color math: hex parsing, mixing, WCAG contrast, CIELAB deltaE and colorblind simulation.

/**
 * Parse "#rgb" or "#rrggbb" (case-insensitive).
 * @param {string} hex
 * @returns {[number, number, number]} 0-255 channels
 */
export function hexToRgb(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Invalid hex color: ${hex}`);
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * @param {number} r @param {number} g @param {number} b - 0-255 (rounded and clamped)
 * @returns {string} "#rrggbb"
 */
export function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Linear mix of two hex colors (sRGB space).
 * @param {string} a @param {string} b @param {number} t - 0 gives a, 1 gives b
 * @returns {string}
 */
export function mixHex(a, b, t) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

/** @param {string} hex @param {number} a - 0-1 @returns {string} css rgba() string (build once, not per frame) */
export function withAlpha(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** @param {string} hex @param {number} t @returns {string} mixed toward white */
export const lighten = (hex, t) => mixHex(hex, '#ffffff', t);
/** @param {string} hex @param {number} t @returns {string} mixed toward black */
export const darken = (hex, t) => mixHex(hex, '#000000', t);

/** @param {number} c - 0-255 sRGB channel @returns {number} 0-1 linear */
export function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** @param {number} v - 0-1 linear @returns {number} 0-255 sRGB channel (unrounded) */
export function linearToSrgb(v) {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return c * 255;
}

/** @param {string} hex @returns {number} WCAG relative luminance */
export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @param {string} a @param {string} b @returns {number} WCAG contrast ratio (1-21), symmetric */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** @param {string} hex @returns {[number, number, number]} CIELAB (D65) */
export function rgbToLab(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** @param {string} a @param {string} b @returns {number} CIE76 color difference */
export function deltaE76(a, b) {
  const p = rgbToLab(a);
  const q = rgbToLab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/**
 * Colorblind simulation matrices, row-major, applied to LINEAR RGB.
 * Source: Machado, Oliveira & Fernandes (2009), "A Physiologically-based Model for Simulation of
 * Color Vision Deficiency", Table 1, severity 1.0 (dichromacy);
 * https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
 * Achromatopsia uses luminance and has no matrix entry here (all rows = luminance weights).
 */
export const CVD_MATRICES = Object.freeze({
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
  achromatopsia: [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722],
});

/**
 * Simulate how a color appears under a color-vision deficiency.
 * @param {string} hex
 * @param {'protanopia'|'deuteranopia'|'tritanopia'|'achromatopsia'} kind
 * @returns {string} "#rrggbb"
 */
export function simulateColorblind(hex, kind) {
  const m = CVD_MATRICES[kind];
  if (!m) throw new Error(`Unknown colorblind kind: ${kind}`);
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const out = [0, 1, 2].map((i) => linearToSrgb(m[i * 3] * r + m[i * 3 + 1] * g + m[i * 3 + 2] * b));
  return rgbToHex(out[0], out[1], out[2]);
}
