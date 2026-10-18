// Pure tower animation values derived from sim state (no render-side state, no allocation).
import { easeOutCubic, clamp01 } from './tween.js';

const TAU = Math.PI * 2;

/**
 * Write buildT, recoil, flash and charge (all 0..1) for a tower into `out`.
 * Time since the last shot is (intervalTicks - cooldown + alpha) steps; before the first shot or once the tower is ready
 * again recoil and flash are 0.
 * @param {{builtTick: number, shots: number, cooldown: number, targetId: number}} tower
 * @param {{intervalTicks: number}} stats
 * @param {number} tickFloat - game.tick + interpolation alpha
 * @param {number} stepSeconds
 * @param {{buildSeconds: number, recoilSeconds: number, flashSeconds: number, chargeSeconds: number}} visual
 * @param {{buildT: number, recoil: number, flash: number, charge: number}} out
 * @returns {typeof out}
 */
export function towerAnim(tower, stats, tickFloat, stepSeconds, visual, out) {
  const alpha = tickFloat - Math.floor(tickFloat);
  out.buildT = visual.buildSeconds > 0 ? clamp01(((tickFloat - tower.builtTick) * stepSeconds) / visual.buildSeconds) : 1;
  out.recoil = 0;
  out.flash = 0;
  out.charge = 0;
  if (tower.shots > 0 && tower.cooldown > 0) {
    const since = (stats.intervalTicks - tower.cooldown + alpha) * stepSeconds;
    if (visual.recoilSeconds > 0) out.recoil = 1 - easeOutCubic(since / visual.recoilSeconds);
    if (visual.flashSeconds > 0) out.flash = clamp01(1 - since / visual.flashSeconds);
  }
  if (visual.chargeSeconds > 0 && tower.targetId >= 0) {
    const untilShot = tower.cooldown > 0 ? Math.max(0, (tower.cooldown - alpha) * stepSeconds) : 0;
    out.charge = clamp01(1 - untilShot / visual.chargeSeconds);
  }
  return out;
}

/**
 * Rotate `current` toward `target` along the shortest arc, at most turnRate * dt. turnRate 0 leaves the angle unchanged.
 * @param {number} current @param {number} target @param {number} turnRate - rad/s @param {number} dt - seconds
 * @returns {number} new angle in (-PI, PI]
 */
export function smoothAngle(current, target, turnRate, dt) {
  if (!(turnRate > 0) || !(dt > 0)) return current;
  let delta = target - current;
  delta -= Math.round(delta / TAU) * TAU; // shortest arc
  const max = turnRate * dt;
  const step = Math.max(-max, Math.min(max, delta));
  let next = current + step;
  next -= Math.round(next / TAU) * TAU;
  return next;
}

/** @param {number} timeSeconds @param {number} spinRate - rad/s @returns {number} angle */
export function spinAngle(timeSeconds, spinRate) {
  return timeSeconds * spinRate;
}
