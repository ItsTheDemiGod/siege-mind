// Tower build tray in the centre of the HUD strip: 5 buttons, icon + cost + hotkey badge. Refreshes on GOLD_CHANGED only.
import { TOWER_ORDER, TOWERS } from '../data/towers.js';
import { EVENT_TYPES } from '../sim/events.js';
import { h } from './dom.js';
import { iconSvg } from './icons.js';
import { tooltipTitle, tooltipBody } from './towerInfo.js';

/**
 * @param {{bar: HTMLElement, game: object, buildState: object, toaster: {show: Function}}} o - bar is the HUD element
 * @returns {{refresh: () => void}}
 */
export function createBuildTray({ bar, game, buildState, toaster }) {
  const tray = h('div', { class: 'build-tray', role: 'group', 'aria-label': 'Build towers' });
  const buttons = {};

  for (const id of TOWER_ORDER) {
    const d = TOWERS[id];
    const btn = h('button', {
      type: 'button', class: 'tray-btn', 'aria-pressed': 'false', 'aria-disabled': 'false',
      'aria-label': `${d.name} tower, ${d.cost} gold, hotkey ${d.hotkey.toUpperCase()}`,
      'data-tooltip-title': tooltipTitle(id), 'data-tooltip': tooltipBody(id),
    }, [
      h('span', { class: 'tray-icon', html: iconSvg(`tower-${id}`, 26) }),
      h('span', { class: 'tray-cost' }, [h('span', { html: iconSvg('gold', 11) }), h('span', { text: String(d.cost) })]),
      h('span', { class: 'tray-key', text: d.hotkey.toUpperCase(), 'aria-hidden': 'true' }),
    ]);
    btn.addEventListener('click', () => {
      buildState.armTower(id);
      if (buildState.state.mode === 'placing' && game.gold < d.cost) toaster.show('Not enough gold');
      btn.blur(); // keep Space for pause
    });
    buttons[id] = btn;
    tray.append(btn);
  }
  bar.append(tray);

  function refresh() {
    for (const id of TOWER_ORDER) {
      const d = TOWERS[id];
      const poor = game.gold < d.cost;
      const btn = buttons[id];
      btn.setAttribute('aria-disabled', String(poor));
      btn.classList.toggle('is-unaffordable', poor);
      btn.setAttribute('aria-pressed', String(buildState.state.mode === 'placing' && buildState.state.typeId === id));
      btn.setAttribute('aria-label', `${d.name} tower, ${d.cost} gold, hotkey ${d.hotkey.toUpperCase()}${poor ? ', not enough gold' : ''}`);
    }
  }
  game.events.on(EVENT_TYPES.GOLD_CHANGED, refresh);
  let lastKey = ''; // armed state only (ignore hover); affordability itself changes on GOLD_CHANGED
  buildState.subscribe(() => {
    const k = `${buildState.state.mode}:${buildState.state.typeId}`;
    if (k !== lastKey) { lastKey = k; refresh(); }
  });
  refresh();
  return { refresh };
}
