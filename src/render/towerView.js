// Render-side per-tower view state. Two small Maps keyed by tower id (event-time allocation only):
//  - the smoothed aim angle (turrets rotate at a limited turn rate; the sim angle snaps instantly)
//  - the time of the last upgrade (drives the brief brightness flash)
// Entries are created lazily on the first draw / the upgrade event and DELETED when the tower is sold.
import { TOWER_VISUALS } from '../data/towerVisuals.js';
import { smoothAngle } from './towerAnim.js';

export function createTowerView() {
  const angles = new Map();
  const upgrades = new Map();
  return {
    /** Smoothed render angle for a tower, advanced by the real frame dt (0 while paused). */
    angle(tower, dt) {
      const prev = angles.get(tower.id);
      if (prev === undefined) {
        angles.set(tower.id, tower.angle);
        return tower.angle;
      }
      const next = smoothAngle(prev, tower.angle, TOWER_VISUALS[tower.type].turnRate, dt);
      angles.set(tower.id, next);
      return next;
    },
    /** Last smoothed angle without advancing it (for the sell ghost). */
    peek(id) { return angles.get(id); },
    markUpgrade(id, time) { upgrades.set(id, time); },
    /** 1 right after an upgrade, fading to 0 over `duration` seconds. */
    upgradeAmount(id, time, duration) {
      const t0 = upgrades.get(id);
      if (t0 === undefined) return 0;
      const a = 1 - (time - t0) / duration;
      if (a <= 0) { upgrades.delete(id); return 0; }
      return a;
    },
    forget(id) { angles.delete(id); upgrades.delete(id); },
    get size() { return angles.size; },
  };
}
