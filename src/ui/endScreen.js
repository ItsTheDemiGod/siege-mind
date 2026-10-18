// Functional end screen (Phase 4B restyles and animates it): a dialog with the result, a table, and retry / new seed.
import { config } from '../data/config.js';
import { EVENT_TYPES } from '../sim/events.js';
import { h } from './dom.js';
import { endScreenRows } from './format.js';
import { buildRestartUrl } from './restart.js';

const FOCUSABLE = 'button, [tabindex]:not([tabindex="-1"])';

/**
 * @param {{root: HTMLElement, game: object, newSeed: () => number, navigate?: (url: string) => void, href?: () => string}} o
 * @returns {{readonly isOpen: boolean}}
 */
export function createEndScreen({ root, game, newSeed, navigate = (url) => window.location.assign(url), href = () => window.location.href }) {
  let open = false;
  let backdrop = null;
  let showButton = null;

  const go = (seed) => navigate(buildRestartUrl(href(), { seed }));

  function close() {
    if (!backdrop) return;
    backdrop.hidden = true;
    open = false;
    if (showButton) {
      showButton.hidden = false;
      showButton.focus();
    }
  }

  function show() {
    const victory = game.result === 'won';
    const rows = endScreenRows(game);
    const title = h('h2', { id: 'end-title', class: victory ? 'is-victory' : 'is-defeat', text: victory ? 'VICTORY' : 'DEFEAT' });
    const table = h('table', {}, rows.map((r) => h('tr', {}, [h('th', { scope: 'row', text: r.label }), h('td', { text: r.value })])));
    const retry = h('button', { type: 'button', class: 'btn btn--primary', text: 'Retry same seed', 'aria-label': 'Retry the same seed' });
    const fresh = h('button', { type: 'button', class: 'btn', text: 'New seed', 'aria-label': 'Start again with a new seed' });
    retry.addEventListener('click', () => go(game.seed));
    fresh.addEventListener('click', () => go(newSeed()));
    const card = h('div', { class: 'panel end-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'end-title' }, [
      title, table, h('div', { class: 'actions' }, [retry, fresh]), h('div', { class: 'hint', text: 'Press Esc to close' }),
    ]);
    card.style.setProperty('--end-width', `${config.ui.endScreenWidth}px`);
    backdrop = h('div', { class: 'end-backdrop' }, [card]);
    backdrop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const items = [...card.querySelectorAll(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    root.append(backdrop);

    // "Show results" lives where the wave control was, so the card can be reopened after Esc
    const { waveControlWidth: w, waveControlHeight: hh, waveControlBottomMargin: bottom } = config.ui;
    showButton = h('button', { type: 'button', class: 'btn btn--primary show-results', text: 'Show results', 'aria-label': 'Show results' });
    Object.assign(showButton.style, { left: `${(config.view.width - w) / 2}px`, top: `${config.view.height - bottom - hh}px`, width: `${w}px`, height: `${hh}px` });
    showButton.hidden = true;
    showButton.addEventListener('click', () => { showButton.hidden = true; backdrop.hidden = false; open = true; retry.focus(); });
    root.append(showButton);
    open = true;
    retry.focus();
  }

  game.events.on(EVENT_TYPES.GAME_OVER, show);
  return { get isOpen() { return open; } };
}
