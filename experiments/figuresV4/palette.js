// Palette of the protocol-v4 figures: one style per mode (color AND marker AND pattern differ for every pair) and one tag per evidence status.
// Ink and font reuse the legacy figure palette read-only.
import { FIGURE_PALETTE, FONT } from '../figures/palette.js';

export const MODE_STYLE = Object.freeze({
  static: Object.freeze({ color: '#0072B2', marker: 'circle', pattern: 'solid' }),
  random: Object.freeze({ color: '#009E73', marker: 'triangle', pattern: 'dots' }),
  prior: Object.freeze({ color: '#CC79A7', marker: 'diamond', pattern: 'horizontal' }),
  adaptive: Object.freeze({ color: '#D55E00', marker: 'square', pattern: 'diagonal' }),
  adaptive2: Object.freeze({ color: '#E69F00', marker: 'cross', pattern: 'cross' }),
  counter: Object.freeze({ color: '#56B4E9', marker: 'plus', pattern: 'vertical' }),
});

export const MODE_LABEL = Object.freeze({
  static: 'Static', random: 'Random control', prior: 'Prior control', adaptive: 'Director v1', adaptive2: 'Director v2', counter: 'Counter arm (reference)',
});

/** tag: the text drawn on the figure; dash: stroke-dasharray of whiskers (null = solid). */
export const STATUS_STYLE = Object.freeze({
  confirmatory: Object.freeze({ tag: 'CONFIRMATORY (pre-registered test)', dash: null }),
  estimate: Object.freeze({ tag: 'ESTIMATE (interval, no p-value)', dash: '6 3' }),
  'post hoc': Object.freeze({ tag: 'POST HOC (not pre-registered)', dash: '2 3' }),
});

export const INK = Object.freeze({ ink: FIGURE_PALETTE.ink, muted: FIGURE_PALETTE.muted, grid: FIGURE_PALETTE.grid, background: FIGURE_PALETTE.background });
export { FONT };
