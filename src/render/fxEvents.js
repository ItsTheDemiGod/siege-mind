// Turns sim events into visual feedback (Section 6B juice). Cheap handlers; the bus isolates any error from the sim.
import { config } from '../data/config.js';
import { ENEMIES } from '../data/enemies.js';
import { TOWER_ORDER } from '../data/towers.js';
import { EVENT_TYPES } from '../sim/events.js';
import { getTowerById, getTowerStats } from '../sim/towers.js';

const TIER_SCALE = { low: 0.4, medium: 0.7, high: 1 }; // particle count multiplier per quality tier
const SPARKS = { low: 1, medium: 2, high: 3 };
const NUMBER_SLOTS = 256;

/**
 * @param {{game: object, fx: object, settings: {get: Function}, quality: {tier: string}, theme: object}} o
 * @returns {() => void} unbind
 */
export function bindFxEvents({ game, fx, settings, quality, theme }) {
  const bus = game.events;
  const { stepSeconds } = config.sim;
  const lastNumber = [new Float32Array(NUMBER_SLOTS), new Float32Array(NUMBER_SLOTS)]; // [direct, dot] last spawn time per enemy id % 256
  const colors = {
    director: fx.color(theme.colors.director),
    danger: fx.color(theme.colors.danger),
    byType: Object.fromEntries(Object.keys(ENEMIES).map((id) => [id, fx.color(theme.enemy[id])])),
  };
  const towerColor = Object.fromEntries(TOWER_ORDER.map((id) => [id, fx.color(theme.tower[id])]));
  const reduced = () => settings.get('reducedMotion');

  const number = (slotKind, ev, text, color, size) => {
    const t = ev.tick * stepSeconds;
    const slot = ev.id % NUMBER_SLOTS;
    if (t - lastNumber[slotKind][slot] < config.fx.damageNumberMinInterval && t >= lastNumber[slotKind][slot]) return;
    lastNumber[slotKind][slot] = t;
    fx.floatText(text, ev.x, ev.y - ENEMIES[ev.type].radius - 12, { color, size, life: 0.7, rise: 24 });
  };

  const offs = [
    bus.on(EVENT_TYPES.ENEMY_SPAWNED, (ev) => {
      if (quality.tier === 'low' || reduced()) return;
      fx.ring(ev.x, ev.y, { color: colors.director, size0: 4, size1: ENEMIES[ev.type].radius * 2.2, life: config.fx.spawnRingSeconds });
    }),

    bus.on(EVENT_TYPES.ENEMY_DAMAGED, (ev) => {
      if (ev.kind === 'direct') {
        fx.burst(ev.x, ev.y, { count: SPARKS[quality.tier], speed: 130, life: 0.3, size0: 4, size1: 1, color: colors.byType[ev.type] });
      }
      if (!settings.get('damageNumbers')) return;
      if (ev.kind === 'dot') {
        number(1, ev, String(Math.round(ev.amount)), theme.colors.tertiary, 14);
        return;
      }
      if (ev.shieldDamage > 0) number(0, ev, String(Math.round(ev.shieldDamage)), theme.enemy.shieldRing, 16);
      else if (ev.hpDamage > 0) number(0, ev, String(Math.round(ev.hpDamage)), theme.colors.text, 16);
    }),

    bus.on(EVENT_TYPES.ENEMY_KILLED, (ev) => {
      const d = ENEMIES[ev.type];
      const count = Math.round((config.fx.killBurstBase + d.radius * config.fx.killBurstPerRadius) * TIER_SCALE[quality.tier]);
      fx.burst(ev.x, ev.y, { count, speed: 150 + d.radius * 5, life: 0.55, size0: 4 + d.radius * 0.2, size1: 1, color: colors.byType[ev.type] });
      if (!reduced()) fx.ring(ev.x, ev.y, { color: colors.byType[ev.type], size0: d.radius * 0.6, size1: d.radius * 3, life: 0.4 });
      fx.floatText(`+${ev.reward}`, ev.x, ev.y - d.radius - 6, { color: theme.colors.gold, size: 20 });
    }),

    bus.on(EVENT_TYPES.ENEMY_LEAKED, (ev) => {
      fx.corePulse();
      fx.flash(theme.colors.danger, reduced() ? 0.3 : 0.8);
      fx.shake.add(0.35);
      fx.burst(ev.x, ev.y, { count: Math.round(16 * TIER_SCALE[quality.tier]), speed: 200, life: 0.5, color: colors.danger });
      fx.floatText(`-${ev.leakDamage}`, ev.x, ev.y - 28, { color: theme.colors.danger, size: 24, life: 1.1 });
    }),

    // Phase 3A: minimal tower feedback (Phase 3B adds the real juice)
    bus.on(EVENT_TYPES.TOWER_PLACED, (ev) => {
      fx.ring(ev.x, ev.y, { color: towerColor[ev.type], size0: 8, size1: 40, life: 0.4 });
      fx.burst(ev.x, ev.y, { count: Math.round(8 * TIER_SCALE[quality.tier]), speed: 120, life: 0.4, color: towerColor[ev.type] });
    }),
    bus.on(EVENT_TYPES.TOWER_SOLD, (ev) => {
      fx.burst(ev.x, ev.y, { count: Math.round(12 * TIER_SCALE[quality.tier]), speed: 140, life: 0.45, color: towerColor[ev.type] });
      fx.floatText(`+${ev.refund}`, ev.x, ev.y - 24, { color: theme.colors.gold, size: 20 });
    }),
    bus.on(EVENT_TYPES.TOWER_UPGRADED, (ev) => {
      const t = getTowerById(game, ev.id);
      if (t) fx.ring(t.x, t.y, { color: towerColor[ev.type], size0: 10, size1: 48, life: 0.45 });
    }),
    bus.on(EVENT_TYPES.TOWER_FIRED, (ev) => {
      if (ev.kind === 'hitscan') {
        fx.line(ev.x, ev.y, ev.tx, ev.ty, { color: towerColor[ev.type], life: 0.15, size: 2 });
      } else if (ev.kind === 'pulse' && !reduced()) {
        const t = getTowerById(game, ev.towerId);
        fx.ring(ev.x, ev.y, { color: towerColor[ev.type], size0: 12, size1: t ? getTowerStats(t.type, t.level).range : 100, life: 0.4 });
      }
    }),
    bus.on(EVENT_TYPES.PROJECTILE_IMPACT, (ev) => {
      fx.burst(ev.x, ev.y, { count: Math.round(5 * TIER_SCALE[quality.tier]), speed: 110, life: 0.3, color: towerColor[ev.type] });
      if (ev.kind === 'shell' && !reduced()) fx.ring(ev.x, ev.y, { color: towerColor[ev.type], size0: 6, size1: ev.radius, life: 0.35 });
    }),
  ];
  return () => { for (const off of offs) off(); };
}
