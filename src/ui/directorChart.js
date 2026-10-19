// Pure geometry of the tilt chart (no DOM). Weights are plotted on a ratio scale: x1.00 is the vertical middle.
import { ENEMY_ORDER } from '../data/enemies.js';
import { tiltBarFraction, chartTilt } from './directorView.js';

/** Marker, dash and fill pattern per enemy type: series differ by shape and pattern, never by color alone. */
export const MARKERS = Object.freeze({ armoredGrunt: 'circle', swarmling: 'triangle', fastRunner: 'diamond', regenerator: 'square', shieldedBruiser: 'cross' });
export const DASHES = Object.freeze({ armoredGrunt: '', swarmling: '6 3', fastRunner: '2 3', regenerator: '8 3 2 3', shieldedBruiser: '10 4' });
export const PATTERNS = Object.freeze({ armoredGrunt: 'solid', swarmling: 'diagonal', fastRunner: 'dots', regenerator: 'horizontal', shieldedBruiser: 'cross' });

const X_TICKS = 6;
const r2 = (x) => Math.round(x * 100) / 100;

/**
 * @param {object[]} entries Director decision records, in wave order
 * @param {{width: number, height: number, padLeft: number, padRight: number, padTop: number, padBottom: number, tiltMax: number, totalWaves: number}} o
 * @returns {{plotLeft: number, plotRight: number, plotTop: number, plotBottom: number, baselineY: number, xTicks: object[], yTicks: object[], series: object[]}}
 */
export function tiltChartModel(entries, { width, height, padLeft, padRight, padTop, padBottom, tiltMax, totalWaves }) {
  const plotLeft = padLeft;
  const plotRight = width - padRight;
  const plotTop = padTop;
  const plotBottom = height - padBottom;
  const mid = (plotTop + plotBottom) / 2;
  const half = (plotBottom - plotTop) / 2;
  const xOf = (wave) => r2(plotLeft + ((wave - 1) / Math.max(1, totalWaves - 1)) * (plotRight - plotLeft));
  const yOf = (tilt) => r2(mid - tiltBarFraction(tilt, tiltMax) * half);

  const waves = [];
  for (let i = 0; i < X_TICKS; i++) {
    const w = Math.round(1 + (i * (totalWaves - 1)) / (X_TICKS - 1));
    if (!waves.includes(w)) waves.push(w);
  }
  const xTicks = waves.map((wave) => ({ wave, x: xOf(wave), label: String(wave) }));
  const yTicks = [1 / tiltMax, 1, tiltMax].map((value) => ({ value, y: yOf(value), label: `×${value.toFixed(2)}` }));

  const tilts = entries.map((e) => chartTilt(e));
  const series = ENEMY_ORDER.map((type) => {
    const points = entries.map((e, i) => ({ wave: e.wave, x: xOf(e.wave), y: yOf(tilts[i][type]), tilt: tilts[i][type], eligible: Boolean(e.eligible) }));
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    return { type, points, path };
  });
  return { plotLeft, plotRight, plotTop, plotBottom, baselineY: yOf(1), xTicks, yTicks, series };
}
