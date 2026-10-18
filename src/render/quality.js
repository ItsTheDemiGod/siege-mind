// Quality tier controller: manual tiers plus an auto-downgrade that never upgrades by itself (avoids oscillation).
import { config } from '../data/config.js';

const ORDER = ['high', 'medium', 'low'];
const SMOOTHING = 0.1; // EMA weight of each new frame

/**
 * @param {{tier?: string, auto?: boolean, config?: object}} [options]
 * @returns {object} controller with update/setTier/setAuto/onChange, `tier`, `params`, `auto`, `fps`
 */
export function createQualityController({ tier = 'high', auto = true, config: cfg = config } = {}) {
  const { thresholdFps, sustainSeconds, cooldownSeconds, ignoreFrameSeconds } = cfg.autoDowngrade;
  let current = tier;
  let autoOn = auto;
  let fps = 60;
  let seeded = false; // first sample after (re)start seeds the average instead of blending from 60
  let lowFor = 0;
  let cooldown = 0;
  const listeners = [];

  const notify = (reason) => { for (const l of listeners) l(current, reason); };

  return {
    /** Call once per rendered frame while visible and running. */
    update(frameSeconds) {
      if (frameSeconds <= 0 || frameSeconds > ignoreFrameSeconds) return; // stalls are not load
      if (seeded) fps += (1 / frameSeconds - fps) * SMOOTHING;
      else { fps = 1 / frameSeconds; seeded = true; }
      if (cooldown > 0) cooldown -= frameSeconds;
      if (!autoOn) return;
      if (fps < thresholdFps) lowFor += frameSeconds;
      else lowFor = 0;
      const idx = ORDER.indexOf(current);
      if (lowFor >= sustainSeconds && cooldown <= 0 && idx < ORDER.length - 1) {
        current = ORDER[idx + 1];
        lowFor = 0;
        cooldown = cooldownSeconds;
        seeded = false; // judge the new tier on fresh frames
        notify('auto');
      }
    },
    setTier(name) {
      if (!cfg.quality[name] || name === current) return;
      current = name;
      lowFor = 0;
      notify('manual');
    },
    setAuto(on) { autoOn = on; lowFor = 0; },
    /** Forget the measured FPS (call after pause/hidden so stale frames are not judged). */
    reset() { seeded = false; lowFor = 0; },
    /** @returns {() => void} unsubscribe */
    onChange(listener) {
      listeners.push(listener);
      return () => { const i = listeners.indexOf(listener); if (i >= 0) listeners.splice(i, 1); };
    },
    get tier() { return current; },
    get params() { return cfg.quality[current]; },
    get auto() { return autoOn; },
    get fps() { return fps; },
  };
}
