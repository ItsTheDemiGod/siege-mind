// Gallery: enemy states (health, shield, spawn, hit flash, statuses) drawn with the real drawEnemy, plus sim-event effect buttons.
import { config } from './data/config.js';
import { ENEMIES, ENEMY_ORDER } from './data/enemies.js';
import { THEME } from './render/theme.js';
import { createGlowCache } from './render/glow.js';
import { drawEnemy } from './render/enemyRenderer.js';
import { EVENT_TYPES } from './sim/events.js';
import { h } from './ui/dom.js';

const STATES = [
  ['full', (e) => e],
  ['50% hp', (e) => ({ ...e, hp: e.maxHp * 0.5 })],
  ['20% hp', (e) => ({ ...e, hp: e.maxHp * 0.2 })],
  ['spawn-in', (e, loop) => ({ ...e, spawnTick: loop.tick - (loop.tick % 90) })],
  ['hit flash', (e, loop) => ({ ...e, lastHitTick: loop.tick - (loop.tick % 90) })],
  ['slowed', (e) => ({ ...e, slowRemaining: 1 })],
  ['poison x1', (e) => ({ ...e, poisonStacks: 1, poisonRemaining: 1 })],
  ['poison x5', (e) => ({ ...e, poisonStacks: 5, poisonRemaining: 1 })],
];
const SHIELD_STATES = [['shield full', 1], ['shield half', 0.5], ['shield down', 0]];
const COL = 110;
const ROW = 96;

const fake = (type) => ({
  type, hp: ENEMIES[type].hp, maxHp: ENEMIES[type].hp, shield: ENEMIES[type].shield, maxShield: ENEMIES[type].shield,
  spawnTick: -1000, lastHitTick: -1, slowRemaining: 0, poisonStacks: 0, poisonRemaining: 0,
});

/**
 * Enemy states grid, animated live.
 * @param {HTMLElement} el @param {() => boolean} isVisible
 * @returns {void}
 */
export function enemyStatesSection(el, isVisible) {
  const W = COL * STATES.length;
  const H = ROW * (ENEMY_ORDER.length + 1) + 30;
  const canvas = h('canvas', { width: W * 2, height: H * 2, style: `width:${W}px;height:${H}px;max-width:100%`, 'aria-label': 'Enemy states grid' });
  el.append(canvas);
  const ctx = canvas.getContext('2d');
  const glow = createGlowCache();
  const pose = { x: 0, y: 0, angle: 0 };
  const info = { tick: 0, alpha: 0, stepSeconds: config.sim.stepSeconds, params: config.quality.high, reducedMotion: false };
  const loop = { tick: 0 };

  const frame = (now) => {
    requestAnimationFrame(frame);
    if (!isVisible()) return;
    const time = now / 1000;
    info.tick = loop.tick = Math.floor(time * 60);
    info.alpha = (time * 60) % 1;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = THEME.colors.bg0;
    ctx.fillRect(0, 0, W, H);
    ctx.font = `600 12px ${THEME.fonts.display}`;
    ctx.fillStyle = THEME.colors.muted;
    ctx.textAlign = 'center';
    STATES.forEach(([label], c) => ctx.fillText(label, COL * c + COL / 2, 14));
    ENEMY_ORDER.forEach((type, r) => {
      STATES.forEach(([, make], c) => {
        pose.x = COL * c + COL / 2;
        pose.y = 30 + ROW * r + ROW / 2 - 4;
        pose.angle = 0;
        drawEnemy(ctx, glow, make(fake(type), loop), pose, time, info);
      });
    });
    SHIELD_STATES.forEach(([label, frac], c) => {
      const e = fake('shieldedBruiser');
      e.shield = e.maxShield * frac;
      pose.x = COL * c + COL / 2;
      pose.y = 30 + ROW * ENEMY_ORDER.length + ROW / 2 - 4;
      drawEnemy(ctx, glow, e, pose, time, info);
      ctx.fillStyle = THEME.colors.muted;
      ctx.fillText(label, pose.x, pose.y + 40);
    });
  };
  requestAnimationFrame(frame);
}

/**
 * Buttons that emit real sim events on the lab game, so the production fx handlers react.
 * @param {HTMLElement} el @param {object} game @param {{range: Function, pick: Function}} rng
 * @returns {void}
 */
export function fxEventButtons(el, game, rng) {
  const at = () => ({ x: rng.range(200, 1080), y: rng.range(100, 520) });
  const emit = (type, payload) => game.events.emit(type, { tick: game.tick, ...payload });
  let id = 1000;
  const buttons = [
    ['Spawn ring', () => { const p = at(); emit(EVENT_TYPES.ENEMY_SPAWNED, { id: id++, type: rng.pick(ENEMY_ORDER), ...p }); }],
    ['Kill burst + gold', () => { const p = at(); const type = rng.pick(ENEMY_ORDER); emit(EVENT_TYPES.ENEMY_KILLED, { id: id++, type, reward: ENEMIES[type].reward, progress: 0.5, source: 'gallery', ...p }); }],
    ['Leak effect', () => emit(EVENT_TYPES.ENEMY_LEAKED, { id: id++, type: 'armoredGrunt', leakDamage: 2, x: 1248, y: 480 })],
    ['Damage numbers', () => {
      const p = at();
      const type = rng.pick(ENEMY_ORDER);
      const eid = id++;
      emit(EVENT_TYPES.ENEMY_DAMAGED, { id: eid, type, amount: 34, shieldDamage: 0, hpDamage: 34, kind: 'direct', source: 'gallery', ...p });
      emit(EVENT_TYPES.ENEMY_DAMAGED, { id: eid, type, amount: 7, shieldDamage: 0, hpDamage: 7, kind: 'dot', source: 'gallery', ...p });
      emit(EVENT_TYPES.ENEMY_DAMAGED, { id: eid + 5000, type: 'shieldedBruiser', amount: 40, shieldDamage: 40, hpDamage: 0, kind: 'direct', source: 'gallery', x: p.x + 40, y: p.y });
    }],
  ];
  el.append(h('div', { class: 'g-row' }, buttons.map(([label, fn]) => h('button', { type: 'button', class: 'btn', text: label, onclick: fn }))));
}
