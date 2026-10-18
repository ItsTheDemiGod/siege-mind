// Tower and projectile event feedback (Phase 3B). Handlers resolve the tower at event time and skip if it was sold.
// All counts respect the quality tier; rings/clouds respect reduced motion; shake respects the shake setting inside fx.shake.
import { TOWER_ORDER } from '../data/towers.js';
import { TOWER_VISUALS } from '../data/towerVisuals.js';
import { EVENT_TYPES } from '../sim/events.js';
import { getTowerById, getTowerStats } from '../sim/towers.js';

const TIER_SCALE = { low: 0.4, medium: 0.7, high: 1 };
const CLOUD_COUNT = { low: 3, medium: 5, high: 8 };
const MUZZLE_SHAKE = 0.12;
const IMPACT_SHAKE = 0.18;

/**
 * @param {{game: object, fx: object, settings: {get: Function}, quality: {tier: string}, theme: object}} o
 * @returns {() => void} unbind
 */
export function bindTowerFx({ game, fx, settings, quality, theme }) {
  const bus = game.events;
  const color = Object.fromEntries(TOWER_ORDER.map((id) => [id, fx.color(theme.tower[id])]));
  const smoke = fx.color(theme.colors.muted);
  const gold = theme.colors.gold;
  const reduced = () => settings.get('reducedMotion');
  const scaled = (n) => Math.max(1, Math.round(n * TIER_SCALE[quality.tier]));

  const offs = [
    bus.on(EVENT_TYPES.TOWER_PLACED, (ev) => {
      fx.ring(ev.x, ev.y, { color: color[ev.type], size0: 8, size1: 40, life: 0.4 });
      fx.burst(ev.x, ev.y, { count: scaled(8), speed: 120, life: 0.4, color: color[ev.type] });
    }),

    bus.on(EVENT_TYPES.TOWER_SOLD, (ev) => {
      fx.ghost({ id: ev.id, type: ev.type, x: ev.x, y: ev.y, level: ev.level, angle: 0 }, TOWER_VISUALS[ev.type].dissolveSeconds);
      fx.forgetTower(ev.id); // the render-side maps must not outlive the tower
      fx.burst(ev.x, ev.y, { count: scaled(14), speed: 150, life: 0.5, size0: 3, size1: 1, color: color[ev.type] }); // fragments
      fx.floatText(`+${ev.refund}`, ev.x, ev.y - 24, { color: gold, size: 20 });
    }),

    bus.on(EVENT_TYPES.TOWER_UPGRADED, (ev) => {
      const t = getTowerById(game, ev.id);
      if (!t) return;
      fx.markUpgrade(ev.id); // brightness flash handled by the tower renderer
      if (!reduced()) fx.ring(t.x, t.y, { color: color[ev.type], size0: 10, size1: 40, life: TOWER_VISUALS[ev.type].upgradeFlashSeconds + 0.1, vy: -60 }); // rises
      fx.burst(t.x, t.y, { count: scaled(8), speed: 100, life: 0.45, color: color[ev.type] });
    }),

    bus.on(EVENT_TYPES.TOWER_FIRED, (ev) => {
      const t = getTowerById(game, ev.towerId);
      if (!t) return;
      const v = TOWER_VISUALS[ev.type];
      const dx = ev.tx - ev.x;
      const dy = ev.ty - ev.y;
      const len = Math.hypot(dx, dy) || 1;
      const mx = ev.x + (dx / len) * v.barrelLength;
      const my = ev.y + (dy / len) * v.barrelLength;
      switch (ev.type) {
        case 'sniper':
          fx.beam(mx, my, ev.tx, ev.ty, v.beamSeconds);
          fx.burst(mx, my, { count: scaled(8), speed: 170, life: 0.25, color: color.sniper });
          break;
        case 'lance':
          fx.burst(mx, my, { count: scaled(3), speed: 120, life: 0.15, size0: 3, color: color.lance });
          break;
        case 'mortar':
          fx.cloud(mx, my, 10, scaled(3), 0.5, smoke);
          if (quality.tier !== 'low') fx.shake.add(MUZZLE_SHAKE);
          break;
        case 'poison':
          fx.burst(mx, my, { count: scaled(4), speed: 60, life: 0.3, size0: 3, color: color.poison });
          break;
        case 'frost': {
          if (reduced()) break;
          const range = getTowerStats(t.type, t.level).range;
          fx.ring(ev.x, ev.y, { color: color.frost, size0: 12, size1: range, life: 0.4 });
          fx.ring(ev.x, ev.y, { color: color.frost, size0: 8, size1: range * 0.6, life: 0.3 }); // faint inner ring
          break;
        }
        default:
      }
    }),

    bus.on(EVENT_TYPES.PROJECTILE_IMPACT, (ev) => {
      const v = TOWER_VISUALS[ev.type];
      if (ev.type === 'lance') {
        if (!ev.hit) return;
        fx.sparksAlong(ev.x, ev.y, ev.angle, scaled(4), 280, color.lance, 0.25);
        fx.ring(ev.x, ev.y, { color: color.lance, size0: 3, size1: 14, life: 0.2 });
      } else if (ev.type === 'poison') {
        fx.cloud(ev.x, ev.y, ev.radius, CLOUD_COUNT[quality.tier], v.cloudSeconds, color.poison);
        if (!reduced()) fx.ring(ev.x, ev.y, { color: color.poison, size0: 4, size1: ev.radius, life: 0.4 });
      } else if (ev.type === 'mortar') {
        if (!reduced()) fx.ring(ev.x, ev.y, { color: color.mortar, size0: 6, size1: ev.radius, life: v.ringSeconds });
        fx.burst(ev.x, ev.y, { count: scaled(12), speed: 150, life: 0.5, size0: 4, color: color.mortar });
        fx.decal(ev.x, ev.y, ev.radius, v.scorchSeconds);
        if (ev.hit && quality.tier !== 'low') fx.shake.add(IMPACT_SHAKE);
      }
    }),
  ];
  return () => { for (const off of offs) off(); };
}
