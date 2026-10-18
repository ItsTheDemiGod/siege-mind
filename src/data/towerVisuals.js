// Visual parameters per tower (Phase 3B). Every key is present for every tower; 0 means "not used by this tower".
// Durations are in seconds, distances in world units, rates in radians per second.

const v = (o) => Object.freeze(o);

export const TOWER_VISUALS = Object.freeze({
  lance: v({
    turnRate: 14, bodyRadius: 18, barrelLength: 28, recoilDistance: 3, recoilSeconds: 0.18, flashSeconds: 0.07, flashSize: 14,
    chargeSeconds: 0, spinRate: 0, trailLength: 46, shellArcHeight: 0, dripEverySeconds: 0, streakLength: 34, ringSeconds: 0,
    scorchSeconds: 0, cloudSeconds: 0, shardCount: 0, beamSeconds: 0, buildSeconds: 0.35, dissolveSeconds: 0.4, upgradeFlashSeconds: 0.4,
  }),
  mortar: v({
    turnRate: 6, bodyRadius: 22, barrelLength: 16, recoilDistance: 7, recoilSeconds: 0.3, flashSeconds: 0.12, flashSize: 24,
    chargeSeconds: 0, spinRate: 0, trailLength: 0, shellArcHeight: 56, dripEverySeconds: 0, streakLength: 0, ringSeconds: 0.35,
    scorchSeconds: 1.4, cloudSeconds: 0, shardCount: 0, beamSeconds: 0, buildSeconds: 0.35, dissolveSeconds: 0.4, upgradeFlashSeconds: 0.4,
  }),
  frost: v({
    turnRate: 0, bodyRadius: 20, barrelLength: 0, recoilDistance: 0, recoilSeconds: 0, flashSeconds: 0.1, flashSize: 0,
    chargeSeconds: 0, spinRate: 0.6, trailLength: 0, shellArcHeight: 0, dripEverySeconds: 0, streakLength: 0, ringSeconds: 0,
    scorchSeconds: 0, cloudSeconds: 0, shardCount: 5, beamSeconds: 0, buildSeconds: 0.35, dissolveSeconds: 0.4, upgradeFlashSeconds: 0.4,
  }),
  poison: v({
    turnRate: 9, bodyRadius: 19, barrelLength: 20, recoilDistance: 3, recoilSeconds: 0.2, flashSeconds: 0.08, flashSize: 12,
    chargeSeconds: 0, spinRate: 0, trailLength: 18, shellArcHeight: 0, dripEverySeconds: 0.06, streakLength: 0, ringSeconds: 0,
    scorchSeconds: 0, cloudSeconds: 0.9, shardCount: 0, beamSeconds: 0, buildSeconds: 0.35, dissolveSeconds: 0.4, upgradeFlashSeconds: 0.4,
  }),
  sniper: v({
    turnRate: 5, bodyRadius: 20, barrelLength: 36, recoilDistance: 8, recoilSeconds: 0.45, flashSeconds: 0.14, flashSize: 26,
    chargeSeconds: 0.6, spinRate: 0, trailLength: 0, shellArcHeight: 0, dripEverySeconds: 0, streakLength: 0, ringSeconds: 0,
    scorchSeconds: 0, cloudSeconds: 0, shardCount: 0, beamSeconds: 0.16, buildSeconds: 0.35, dissolveSeconds: 0.4, upgradeFlashSeconds: 0.4,
  }),
});
