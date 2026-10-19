// Direction marks: a small triangle (shape, plus text for assistive tech) showing that the Director raised or lowered an enemy type.
import { svg } from './svg.js';
import { h } from './dom.js';
import { ENEMY_ORDER } from '../data/enemies.js';

const TEXT = { up: 'Director raised this type', down: 'Director lowered this type' };
const POINTS = { up: '5,1 9,8 1,8', down: '1,2 9,2 5,9' };

/** @param {'up'|'down'} dir @returns {HTMLElement} a small triangle; up points up, down points down */
export function directionMark(dir) {
  const mark = h('span', { class: `dir-mark dir-${dir}`, 'aria-hidden': 'true' });
  mark.append(svg('svg', { width: 10, height: 10, viewBox: '0 0 10 10' }, [svg('polygon', { points: POINTS[dir] })]));
  return mark;
}

/**
 * Additive pass over composition chips (see compositionChips.js): adds a mark and a tooltip to every chip whose type moved.
 * @param {HTMLElement[]|ArrayLike<HTMLElement>} chips chips with data-type @param {Record<string, 'up'|'down'|'flat'>|null} directions
 * @returns {void}
 */
export function markChips(chips, directions) {
  if (!directions) return;
  for (const chip of chips) {
    const type = chip.dataset.type;
    const dir = directions[type];
    if (!ENEMY_ORDER.includes(type) || (dir !== 'up' && dir !== 'down')) continue;
    chip.append(directionMark(dir));
    chip.setAttribute('data-tooltip', `${chip.getAttribute('data-tooltip')}: ${TEXT[dir]}`);
    chip.setAttribute('aria-label', `${chip.getAttribute('aria-label')} (${TEXT[dir]})`);
  }
}
