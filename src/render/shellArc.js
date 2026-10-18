// Visual-only ballistic arc for mortar shells (the sim moves them in a straight line).
import { config } from '../data/config.js';

/**
 * Write { lift, scale, shadowScale } for a shell at `progress` (0..1) of its flight.
 * lift is 0 at both ends and arcHeight at the middle; the shell grows slightly toward the apex and its ground shadow shrinks.
 * @param {number} progress @param {number} arcHeight
 * @param {{lift: number, scale: number, shadowScale: number}} out
 * @returns {typeof out}
 */
export function shellArc(progress, arcHeight, out) {
  const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  const h = 4 * p * (1 - p); // 0 at the ends, 1 at the apex
  out.lift = arcHeight * h;
  out.scale = 1 + config.fx.shellScaleGain * h;
  out.shadowScale = 1 - config.fx.shellShadowShrink * h;
  return out;
}
