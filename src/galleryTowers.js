// Gallery: towers. Uses the same renderer, fx handlers and sim events as the game. 15 real towers (5 types x levels 0-2)
// shoot a stream of real enemies; buttons fire each effect on its own by emitting the same sim events.
import { THEME } from './render/theme.js';
import { TOWER_ORDER } from './data/towers.js';
import { towerPaths } from './render/towerPaths.js';
import { EVENT_TYPES } from './sim/events.js';
import { placeTower, upgradeTower, sellTower, getTowerById } from './sim/towers.js';
import { h } from './ui/dom.js';

const LAYOUT = [ // [col, row, level] per type: level 0 along the top, level 1 further along the top, level 2 along the bottom
  ...[1, 3, 5, 7, 9].map((col, i) => [TOWER_ORDER[i], col, 0, 0]),
  ...[11, 13, 15, 17, 19].map((col, i) => [TOWER_ORDER[i], col, 0, 1]),
  ...[3, 5, 7, 9, 11].map((col, i) => [TOWER_ORDER[i], col, 8, 2]),
];
const SPARE_TILE = { col: 15, row: 8 };
const REBUILD_DELAY_MS = 1400;

/** Flat one-color silhouettes of every tower at every level (proves they differ by shape alone). */
function silhouetteRow(el) {
  const W = 760;
  const H = 150;
  const canvas = h('canvas', { width: W * 2, height: H * 2, style: `width:${W}px;height:${H}px;max-width:100%`, 'aria-label': 'Tower silhouettes in one flat color' });
  el.append(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = THEME.colors.bg0;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = THEME.colors.text;
  ctx.strokeStyle = THEME.colors.text;
  ctx.lineWidth = 2;
  TOWER_ORDER.forEach((type, i) => {
    for (let level = 0; level < 3; level++) {
      const p = towerPaths(type, level);
      ctx.save();
      ctx.translate(60 + i * 140, 30 + level * 45);
      ctx.scale(0.7, 0.7);
      ctx.rotate(-Math.PI / 2 + 0.5);
      for (const g of [p.base, p.turret, p.barrel]) {
        ctx.fill(g.fill); ctx.fill(g.brightFill); ctx.stroke(g.stroke); ctx.stroke(g.thin); ctx.stroke(g.thick); ctx.stroke(g.bright);
      }
      ctx.restore();
    }
  });
}

/**
 * @param {HTMLElement} el section element @param {object} game the towers stage game @returns {void}
 */
export function towersSection(el, game) {
  el.append(h('p', { class: 'note', text: 'Top row left to right: level 0 Lance, Mortar, Frost, Poison, Sniper, then level 1 of each; bottom row: level 2. Enemies stream along the path so every tower fires its real projectile, trail and impact.' }));
  const byKey = new Map();
  for (const [type, col, row, level] of LAYOUT) {
    const r = placeTower(game, type, col, row);
    if (!r.ok) continue;
    for (let l = 0; l < level; l++) upgradeTower(game, r.tower.id);
    byKey.set(`${type}${level}`, r.tower);
  }
  const emit = (type, payload) => game.events.emit(type, { tick: game.tick, ...payload });
  const any = (type) => byKey.get(`${type}0`);

  const effects = [
    ['Lance impact', () => { const t = any('lance'); emit(EVENT_TYPES.PROJECTILE_IMPACT, { kind: 'bolt', type: 'lance', x: t.x + 90, y: t.y + 70, hit: true, hits: 1, radius: 0, angle: 0.6 }); }],
    ['Mortar impact', () => { const t = any('mortar'); emit(EVENT_TYPES.PROJECTILE_IMPACT, { kind: 'shell', type: 'mortar', x: t.x + 60, y: t.y + 90, hit: true, hits: 2, radius: 60, angle: 0.8 }); }],
    ['Frost pulse', () => { const t = any('frost'); emit(EVENT_TYPES.TOWER_FIRED, { towerId: t.id, type: 'frost', kind: 'pulse', x: t.x, y: t.y, targetId: -1, tx: t.x, ty: t.y }); }],
    ['Poison cloud', () => { const t = any('poison'); emit(EVENT_TYPES.PROJECTILE_IMPACT, { kind: 'bolt', type: 'poison', x: t.x + 50, y: t.y + 80, hit: true, hits: 3, radius: 28, angle: 1 }); }],
    ['Sniper beam', () => { const t = any('sniper'); emit(EVENT_TYPES.TOWER_FIRED, { towerId: t.id, type: 'sniper', kind: 'hitscan', x: t.x, y: t.y, targetId: -1, tx: t.x + 260, ty: t.y + 120 }); }],
  ];
  const build = () => {
    const t = game.towers.find((x) => x.col === SPARE_TILE.col && x.row === SPARE_TILE.row);
    if (t) sellTower(game, t.id);
    setTimeout(() => placeTower(game, 'lance', SPARE_TILE.col, SPARE_TILE.row), t ? 300 : 0);
  };
  const dissolve = () => {
    const t = byKey.get('mortar1');
    if (!t || !getTowerById(game, t.id)) return;
    sellTower(game, t.id);
    setTimeout(() => {
      const r = placeTower(game, 'mortar', t.col, t.row);
      if (r.ok) { upgradeTower(game, r.tower.id); byKey.set('mortar1', r.tower); }
    }, REBUILD_DELAY_MS);
  };
  el.append(h('div', { class: 'g-row' }, [
    ...effects.map(([label, fn]) => h('button', { type: 'button', class: 'btn', text: label, onclick: fn })),
    h('button', { type: 'button', class: 'btn btn--primary', text: 'Sell dissolve (level 1 Mortar)', onclick: dissolve }),
    h('button', { type: 'button', class: 'btn btn--primary', text: 'Build-in', onclick: build }),
  ]));
  el.append(h('h3', { text: 'Silhouette only (one flat color, three levels per tower)' }));
  silhouetteRow(el);
}
