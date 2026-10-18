// Turns sim events into visual feedback (Section 6B juice). Cheap handlers; the bus isolates any error from the sim.
import { config } from '../data/config.js';
import { ENEMIES } from '../data/enemies.js';
import { TOWER_ORDER } from '../data/towers.js';
import { TOWER_VISUALS } from '../data/towerVisuals.js';
import { bindTowerFx } from './towerFx.js';
import { EVENT_TYPES } from '../sim/events.js';

const TIER_SCALE = { low: 0.4, medium: 0.7, high: 1 }; // particle count multiplier per quality tier
const SPARKS = { low: 1, medium: 2, high: 3 };
const NUMBER_SLOTS = 256;
const SHARD_BUDGET = { low: 4, medium: 10, high: 20 }; // frost shards per tick, per quality tier

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
  let shardTick = -1;
  let shardBudget = 0;
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
        if (ev.source === 'frost') {
          // ice shards, throttled per tick so one pulse hitting many enemies stays cheap
          if (ev.tick !== shardTick) { shardTick = ev.tick; shardBudget = SHARD_BUDGET[quality.tier]; }
          const n = Math.min(TOWER_VISUALS.frost.shardCount, shardBudget);
          shardBudget -= n;
          if (n > 0) fx.shards(ev.x, ev.y, n, towerColor.frost);
        } else if (ev.source === 'sniper') {
          fx.burst(ev.x, ev.y, { count: SPARKS[quality.tier] * 3, speed: 200, life: 0.35, size0: 5, size1: 1, color: towerColor.sniper });
        } else {
          fx.burst(ev.x, ev.y, { count: SPARKS[quality.tier], speed: 130, life: 0.3, size0: 4, size1: 1, color: colors.byType[ev.type] });
        }
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
  ];
  const unbindTowers = bindTowerFx({ game, fx, settings, quality, theme });
  return () => { for (const off of offs) off(); unbindTowers(); };
}
