// Tower build tray in the centre of the HUD strip: 5 buttons, icon + current price + hotkey badge.
// Refreshes on GOLD_CHANGED, TOWER_PLACED, TOWER_SOLD and armed-tower changes (prices grow with the towers owned).
import { TOWER_ORDER, TOWERS } from '../data/towers.js';
import { EVENT_TYPES } from '../sim/events.js';
import { h } from './dom.js';
import { iconSvg } from './icons.js';
import { tooltipTitle, tooltipBody } from './towerInfo.js';
import { trayEntry } from './trayState.js';

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
      'aria-label': trayEntry(game, id).label,
      'data-tooltip-title': tooltipTitle(id), 'data-tooltip': `${tooltipBody(id)}\n${trayEntry(game, id).priceLine}`,
    }, [
      h('span', { class: 'tray-icon', html: iconSvg(`tower-${id}`, 26) }),
      h('span', { class: 'tray-cost' }, [h('span', { html: iconSvg('gold', 11) }), h('span', { class: 'tray-price', text: String(trayEntry(game, id).cost) })]),
      h('span', { class: 'tray-key', text: d.hotkey.toUpperCase(), 'aria-hidden': 'true' }),
    ]);
    btn.addEventListener('click', () => {
      buildState.armTower(id);
      if (buildState.state.mode === 'placing' && !trayEntry(game, id).affordable) toaster.show('Not enough gold');
      btn.blur(); // keep Space for pause
    });
    buttons[id] = btn;
    tray.append(btn);
  }
  bar.append(tray);

  function refresh() {
    for (const id of TOWER_ORDER) {
      const e = trayEntry(game, id);
      const poor = !e.affordable;
      const btn = buttons[id];
      btn.setAttribute('aria-disabled', String(poor));
      btn.classList.toggle('is-unaffordable', poor);
      btn.setAttribute('aria-pressed', String(buildState.state.mode === 'placing' && buildState.state.typeId === id));
      btn.setAttribute('aria-label', e.label);
      btn.setAttribute('data-tooltip', `${tooltipBody(id)}\n${e.priceLine}`);
      btn.querySelector('.tray-price').textContent = String(e.cost);
    }
  }
  for (const type of [EVENT_TYPES.GOLD_CHANGED, EVENT_TYPES.TOWER_PLACED, EVENT_TYPES.TOWER_SOLD]) game.events.on(type, refresh);
  let lastKey = ''; // armed state only (ignore hover); affordability itself changes on GOLD_CHANGED
  buildState.subscribe(() => {
    const k = `${buildState.state.mode}:${buildState.state.typeId}`;
    if (k !== lastKey) { lastKey = k; refresh(); }
  });
  refresh();
  return { refresh };
}
