// DOM chips for a wave composition (shared by the wave banner and the incoming-wave preview). Text and shape, never color alone.
import { h } from './dom.js';
import { iconSvg, enemyIconName } from './icons.js';

const ICON_SIZE = 18;

/**
 * @param {{type: string, label: string, units: number}[]} items from compositionItems/describeBanner/describePreview
 * @returns {HTMLElement[]} one chip per enemy type: icon, "×units", with the full name as the accessible label
 */
export function compositionChips(items) {
  return items.map((it) => h('span', { class: 'comp-chip', role: 'img', 'aria-label': `${it.units} ${it.label}`, 'data-tooltip': it.label }, [
    h('span', { class: `comp-icon enemy-${it.type}`, html: iconSvg(enemyIconName(it.type), ICON_SIZE) }),
    h('span', { class: 'comp-count', text: `×${it.units}` }),
  ]));
}
