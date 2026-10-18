// Floating panel for the selected tower: stats, counters, targeting, upgrade and sell.
import { config } from '../data/config.js';
import { TOWERS, TARGET_MODES } from '../data/towers.js';
import { EVENT_TYPES } from '../sim/events.js';
import { getTowerById } from '../sim/towers.js';
import { h } from './dom.js';
import { iconSvg } from './icons.js';
import { statRows } from './towerInfo.js';

const MODE_LABEL = { first: 'First', strongest: 'Strongest', closest: 'Closest' };
const MARGIN = 16;
const HALF_STAGE_X = 640;

/**
 * @param {{root: HTMLElement, game: object, buildState: object, actions: {upgrade: Function, sell: Function, setMode: Function}}} o
 * @returns {{refresh: () => void}}
 */
export function createTowerPanel({ root, game, buildState, actions }) {
  let panel = null;
  let timer = 0;
  let shownId = null;
  const refs = {};

  const upgradeCost = (t) => TOWERS[t.type].upgrades[t.level]?.cost;

  function build(t) {
    const def = TOWERS[t.type];
    refs.title = h('div', { class: 'tp-title', text: `${def.name}` });
    refs.level = h('span', { class: 'tp-level' });
    refs.stats = h('div', { class: 'tp-stats' });
    refs.counters = h('div', { class: 'tp-counters' });
    refs.mode = h('div', { class: 'tp-modes', role: 'group', 'aria-label': 'Targeting mode' });
    refs.modeButtons = {};
    if (t.targetMode !== null) {
      for (const m of TARGET_MODES) {
        const b = h('button', { type: 'button', class: 'btn tp-mode', text: MODE_LABEL[m], 'aria-pressed': 'false', 'aria-label': `Target ${MODE_LABEL[m]}` });
        b.addEventListener('click', () => { actions.setMode(t.id, m); refresh(); b.blur(); });
        refs.modeButtons[m] = b;
        refs.mode.append(b);
      }
    }
    refs.upgrade = h('button', { type: 'button', class: 'btn btn--primary', 'aria-disabled': 'false' });
    refs.upgrade.addEventListener('click', () => { actions.upgrade(t.id); refresh(); refs.upgrade.blur(); });
    refs.sell = h('button', { type: 'button', class: 'btn btn--danger' });
    refs.sell.addEventListener('click', () => { actions.sell(t.id); });
    const close = h('button', { type: 'button', class: 'btn btn--ghost btn--icon tp-close', 'aria-label': 'Deselect tower', html: iconSvg('close', 16) });
    close.addEventListener('click', () => buildState.clearSelection());

    panel = h('div', { class: 'panel tower-panel', role: 'region', 'aria-label': `${def.name} tower` }, [
      h('div', { class: 'tp-head' }, [h('span', { html: iconSvg(`tower-${t.type}`, 26) }), refs.title, refs.level, close]),
      refs.stats, refs.counters, refs.mode,
      h('div', { class: 'tp-actions' }, [refs.upgrade, refs.sell]),
    ]);
    root.append(panel);
    panel.classList.toggle('is-right', t.x < HALF_STAGE_X); // opposite side of the tower so it never covers it
    panel.style.setProperty('--tp-margin', `${MARGIN}px`);
    shownId = t.id;
  }

  function refresh() {
    const { state } = buildState;
    const t = state.mode === 'selected' ? getTowerById(game, state.towerId) : null;
    if (!t) { close(); return; }
    if (shownId !== t.id) { close(); build(t); }
    const r = statRows(t.type, t.level);
    refs.level.textContent = `Lv ${t.level}/${config.towers.maxLevel}`;
    refs.stats.textContent = `Damage ${r.damage}\nRange ${r.range}\nShots/s ${r.shotsPerSecond}\nDPS ${r.dps}`;
    refs.counters.textContent = `Damage dealt ${Math.round(t.damageDealt)}   Kills ${t.kills}`;
    for (const m of TARGET_MODES) refs.modeButtons[m]?.setAttribute('aria-pressed', String(t.targetMode === m));
    const cost = upgradeCost(t);
    if (cost === undefined) {
      refs.upgrade.textContent = 'Max level';
      refs.upgrade.setAttribute('aria-disabled', 'true');
      refs.upgrade.setAttribute('aria-label', 'Max level reached');
    } else {
      const poor = game.gold < cost;
      refs.upgrade.textContent = `Upgrade (${cost} gold)`;
      refs.upgrade.setAttribute('aria-disabled', String(poor));
      refs.upgrade.setAttribute('aria-label', `Upgrade for ${cost} gold${poor ? ', not enough gold' : ''}, hotkey U`);
    }
    const refund = Math.floor(t.invested * config.economy.sellRefundFraction);
    refs.sell.textContent = `Sell (+${refund})`;
    refs.sell.setAttribute('aria-label', `Sell for ${refund} gold, hotkey Delete`);
    if (!timer) timer = setInterval(refresh, config.ui.towerPanelRefreshSeconds * 1000);
  }

  function close() {
    clearInterval(timer);
    timer = 0;
    panel?.remove();
    panel = null;
    shownId = null;
  }

  let lastKey = ''; // ignore hover-only state changes
  buildState.subscribe(() => {
    const k = `${buildState.state.mode}:${buildState.state.towerId}`;
    if (k !== lastKey) { lastKey = k; refresh(); }
  });
  for (const type of [EVENT_TYPES.TOWER_UPGRADED, EVENT_TYPES.GOLD_CHANGED, EVENT_TYPES.TOWER_SOLD]) game.events.on(type, refresh);
  return { refresh };
}
