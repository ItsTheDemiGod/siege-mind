// Incoming-wave preview: sits just above the wave control during prep and intermission, hidden while a wave runs.
import { config } from '../data/config.js';
import { EVENT_TYPES } from '../sim/events.js';
import { getWavePreview } from '../sim/waves.js';
import { h } from './dom.js';
import { describePreview } from './bannerState.js';
import { compositionChips } from './compositionChips.js';

const REFRESH_MS = 250; // phase flips happen after WAVE_ENDED fires, so a slow poll is the simplest correct trigger

/**
 * @param {{root: HTMLElement, game: object, controlRect: {left: number, top: number, w: number, h: number}}} o
 * @returns {{refresh: () => void}}
 */
export function createWavePreview({ root, game, controlRect }) {
  const { wavePreviewWidth: w, wavePreviewHeight: hh, wavePreviewGap: gap } = config.ui;
  const title = h('span', { class: 'wp-title' });
  const chips = h('span', { class: 'wp-chips' });
  const hp = h('span', { class: 'wp-hp' });
  const el = h('div', { class: 'panel wave-preview', role: 'group', 'aria-label': 'Incoming wave', hidden: true }, [title, chips, hp]);
  Object.assign(el.style, { left: `${(config.view.width - w) / 2}px`, top: `${controlRect.top - gap - hh}px`, width: `${w}px`, height: `${hh}px` });
  root.append(el);

  let lastKey = '';
  function refresh() {
    const preview = game.over ? null : getWavePreview(game);
    const key = preview ? `${preview.wave}|${game.waves.phase}` : 'none';
    if (key === lastKey) return;
    lastKey = key;
    const d = describePreview(preview, game.totalWaves);
    el.hidden = d === null;
    if (!d) return;
    title.textContent = d.title;
    hp.textContent = d.hpLine;
    chips.replaceChildren(...compositionChips(d.items));
    el.classList.toggle('is-fixed', d.fixed);
    el.classList.toggle('is-final', d.final);
  }

  for (const type of [EVENT_TYPES.WAVE_STARTED, EVENT_TYPES.GAME_OVER]) game.events.on(type, refresh);
  setInterval(refresh, REFRESH_MS);
  refresh();
  return { refresh };
}
