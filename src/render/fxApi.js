// The renderer's fx API: what event handlers (fxEvents.js) and dev tools call to produce visuals.
// Event-time helpers may allocate option objects; drip() is time-driven and calls the particle pool directly.
import { KIND } from './particles.js';
import { hash01 } from './hash.js';
import { THEME } from './theme.js';

const TAU = Math.PI * 2;
const SCAN_SECONDS = 0.9;

/**
 * @param {{particles: object, floatText: object, shake: object, rng: object, colorIds: object, overlay: object, tweens: object,
 *   beams: object, decals: object, ghosts: object, view: object, corePos: object, clock: () => number}} d
 * @returns {object} fx
 */
export function createFxApi(d) {
  const { particles, floatText, shake, rng, colorIds, overlay, tweens, beams, decals, ghosts, view, corePos, clock } = d;
  const poisonId = particles.registerColor(THEME.tower.poison);

  return {
    /** Spark burst in world (map) coordinates. */
    burst(x, y, opts = {}) { particles.burst(x, y, { color: colorIds.primary, ...opts }); },
    ring(x, y, opts = {}) { particles.ring(x, y, { color: colorIds.primary, ...opts }); },
    floatText(text, x, y, opts) { floatText.spawn(text, x, y, opts); },
    /** Thin additive line particle. */
    line(x, y, tx, ty, opts = {}) { particles.line(x, y, tx - x, ty - y, { color: colorIds.primary, ...opts }); },
    shake,
    /** Full-stage translucent flash that decays. */
    flash(color, intensity) {
      overlay.flashColor = color;
      overlay.flashAlpha = Math.min(1, Math.max(overlay.flashAlpha, intensity));
    },
    /** Violet sweep across the HUD area (Phase 7 calls this when the Director changes composition). */
    directorScan() {
      overlay.scan = 0;
      tweens.cancel(overlay);
      tweens.start(overlay, 'scan', 1, SCAN_SECONDS, undefined, 0);
    },
    /** Reduced-motion version of directorScan: the HUD strip fades once (about 0.12 s), nothing sweeps. */
    directorFade() { overlay.scanFade = 1; },
    colors: colorIds,
    color: (hex) => particles.registerColor(hex),
    corePulse() { overlay.corePulse = 1; },
    /** The core falls: shockwaves, a danger flash, a shake and the darkening/shard timers (driven by the renderer). */
    coreDestroy() {
      overlay.destroyClock = 0;
      for (let i = 0; i < 3; i++) particles.ring(corePos.x, corePos.y, { color: colorIds.danger, size0: 10, size1: 90 + i * 50, life: 0.7 + i * 0.25 });
      particles.burst(corePos.x, corePos.y, { count: 40, speed: 260, life: 0.9, size0: 5, color: colorIds.danger });
      overlay.flashColor = THEME.colors.danger;
      overlay.flashAlpha = 1;
      shake.add(0.9);
    },
    /** The defense holds: a defense-colored flash; rings and spark arcs follow from the renderer's victory timer. */
    coreVictory() {
      overlay.victoryClock = 0;
      overlay.victoryAcc = 0;
      overlay.flashColor = THEME.colors.primary;
      overlay.flashAlpha = 0.6;
    },
    /** One victory beat: an expanding ring plus sparks arcing upward. */
    victoryPulse() {
      particles.ring(corePos.x, corePos.y, { color: colorIds.primary, size0: 12, size1: 120, life: 0.9 });
      for (let i = 0; i < 6; i++) {
        particles.emit(KIND.SPARK, corePos.x, corePos.y, (rng.next() - 0.5) * 120, -90 - rng.next() * 90, 1.1, 5, 1, colorIds.white, 0.6);
      }
    },
    corePos,
    clear() { particles.clear(); floatText.clear(); beams.clear(); decals.clear(); ghosts.clear(); },

    // ---- Phase 3B ----
    /** Sniper beam from (x1,y1) to (x2,y2). */
    beam(x1, y1, x2, y2, life) { beams.spawn(x1, y1, x2, y2, life); },
    /** Mortar scorch mark. */
    decal(x, y, r, life) { decals.spawn(x, y, r, life); },
    /** Sell dissolve ghost at the tower's last render angle. */
    ghost(tower, life) { ghosts.spawn(tower.type, tower.x, tower.y, view.peek(tower.id) ?? tower.angle, tower.level, life); },
    forgetTower(id) { view.forget(id); },
    markUpgrade(id) { view.markUpgrade(id, clock()); },
    /** Falling poison drip (time-driven, no option objects). */
    drip(x, y, k) {
      particles.emit(KIND.SPARK, x + (hash01(k) * 2 - 1) * 2, y, (hash01(k, 1) * 2 - 1) * 14, 24 + hash01(k, 2) * 20, 0.35, 3, 1, poisonId, 1.5);
    },
    /** Short elongated ice shards flying outward. */
    shards(x, y, count, colorId) {
      for (let i = 0; i < count; i++) {
        const a = rng.next() * TAU;
        const sp = 90 + rng.next() * 70;
        particles.emit(KIND.STREAK, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.35, 2.2, 1, colorId, 2.2);
      }
    },
    /** Sparks flying along an angle (piercing streaks). */
    sparksAlong(x, y, angle, count, speed, colorId, life) {
      for (let i = 0; i < count; i++) {
        const a = angle + (rng.next() - 0.5) * 0.25;
        const sp = speed * (0.7 + rng.next() * 0.6);
        particles.emit(KIND.STREAK, x, y, Math.cos(a) * sp, Math.sin(a) * sp, life, 2.4, 1, colorId, 1.2);
      }
    },
    /** Large soft drifting cloud blobs inside a radius. */
    cloud(x, y, radius, count, life, colorId) {
      for (let i = 0; i < count; i++) {
        const a = rng.next() * TAU;
        const r = Math.sqrt(rng.next()) * radius;
        particles.emit(KIND.CLOUD, x + Math.cos(a) * r, y + Math.sin(a) * r, (rng.next() - 0.5) * 6, -10 - rng.next() * 6, life * (0.7 + rng.next() * 0.3), radius * 0.5, radius * 0.9, colorId, 0.4);
      }
    },
  };
}
