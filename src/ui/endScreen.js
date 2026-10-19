// End screen adapter: waits a beat after GAME_OVER (the core's fall or victory plays first), then shows the dialog.
// Escape is handled by the single resolver in main.js, which calls hide().
import { config } from '../data/config.js';
import { EVENT_TYPES } from '../sim/events.js';
import { h } from './dom.js';
import { buildEndModel } from './endModel.js';
import { renderEndScreen } from './endScreenView.js';
import { buildRestartUrl } from './restart.js';
import { buildMenuUrl } from './menuState.js';

const REDUCED_DELAY = 0.2;

/**
 * @param {{root: HTMLElement, game: object, newSeed: () => number, reducedMotion?: () => boolean, navigate?: (url: string) => void, href?: () => string,
 *   onDownloadJson?: () => void, onDownloadWaves?: () => void}} o
 * @returns {{readonly isOpen: boolean, hide: () => void}}
 */
export function createEndScreen({ root, game, newSeed, onDownloadJson, onDownloadWaves, reducedMotion = () => false, navigate = (url) => window.location.assign(url), href = () => window.location.href }) {
  let open = false;
  let view = null;
  let showButton = null;

  const go = (seed) => navigate(buildRestartUrl(href(), { seed }));

  function hide() {
    if (!view) return;
    view.el.hidden = true;
    open = false;
    showButton.hidden = false;
    showButton.focus();
  }

  function present() {
    view = renderEndScreen(buildEndModel(game), { onRetry: () => go(game.seed), onNewSeed: () => go(newSeed()), onMenu: () => navigate(buildMenuUrl(href())), onDownloadJson, onDownloadWaves });
    root.append(view.el);

    // "Show results" lives where the wave control was, so the dialog can be reopened after Esc
    const { waveControlWidth: w, waveControlHeight: hh, waveControlBottomMargin: bottom } = config.ui;
    showButton = h('button', { type: 'button', class: 'btn btn--primary show-results', text: 'Show results', 'aria-label': 'Show results' });
    Object.assign(showButton.style, { left: `${(config.view.width - w) / 2}px`, top: `${config.view.height - bottom - hh}px`, width: `${w}px`, height: `${hh}px` });
    showButton.hidden = true;
    showButton.addEventListener('click', () => { showButton.hidden = true; view.el.hidden = false; open = true; view.focusFirst(); });
    root.append(showButton);
    open = true;
    view.focusFirst();
  }

  game.events.on(EVENT_TYPES.GAME_OVER, () => {
    const seconds = reducedMotion() ? REDUCED_DELAY : game.result === 'won' ? config.ui.endScreenDelayWon : config.ui.endScreenDelayLost;
    setTimeout(present, seconds * 1000);
  });
  return { get isOpen() { return open; }, hide };
}
