// Volume math (pure, plain multiplication): the taper is volume squared, so the lower half of a slider is genuinely quiet.
import { audioConfig } from './audioConfig.js';

/** @param {*} x @param {number} [fallback] @returns {number} x clamped to [0, 1]; non-finite input gives the fallback */
export function clampVolume(x, fallback = 0) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return fallback;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** @returns {{master: number, sfx: number}} the two gain-node values (the master one includes cfg.masterGain; both 0 when muted) */
export function gainsFor(settings, cfg = audioConfig) {
  if (settings && settings.muted) return { master: 0, sfx: 0 };
  const m = clampVolume(settings && settings.masterVolume, cfg.defaults.masterVolume);
  const s = clampVolume(settings && settings.sfxVolume, cfg.defaults.sfxVolume);
  return { master: cfg.masterGain * (m * m), sfx: s * s };
}

/** @returns {number} masterGain * master^2 * sfx^2, or 0 when muted */
export function effectiveGain(settings, cfg = audioConfig) {
  const g = gainsFor(settings, cfg);
  return g.master * g.sfx;
}
