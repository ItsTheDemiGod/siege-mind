// Wave control (bottom centre): what is happening with waves and the Start Wave button. Functional; Phase 4B restyles it.
import { config } from '../data/config.js';
import { EVENT_TYPES } from '../sim/events.js';
import { startNextWave, enemiesRemaining, getWaveCountdownSeconds } from '../sim/waveRunner.js';
import { waveInfo, TOTAL_WAVES } from '../data/waves.js';
import { describeWaveControl } from './waveControlState.js';
import { reasonText } from './towerInfo.js';
import { h } from './dom.js';

const COUNTDOWN_REFRESH_MS = 250; // 4 Hz, never per frame

/**
 * @param {{root: HTMLElement, game: object, toaster: {show: Function}}} o
 * @returns {{refresh: () => void, start: () => void, readonly rect: {left: number, top: number, w: number, h: number}}}
 */
export function createWaveControl({ root, game, toaster }) {
  const { waveControlWidth: w, waveControlHeight: hh, waveControlBottomMargin: bottom } = config.ui;
  const { width, height } = config.view;
  const left = (width - w) / 2;
  const top = height - bottom - hh;

  const title = h('div', { class: 'wc-title' });
  const sub = h('div', { class: 'wc-sub' });
  const button = h('button', { type: 'button', class: 'btn btn--primary' });
  const fill = h('i');
  const bar = h('div', { class: 'wc-bar', 'aria-hidden': 'true' }, [fill]);
  const el = h('div', { class: 'panel wave-control', role: 'region', 'aria-label': 'Wave control' }, [title, sub, button, bar]);
  Object.assign(el.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${hh}px` });
  root.append(el);

  const start = () => {
    const r = startNextWave(game);
    if (!r.ok) toaster.show(reasonText(r.reason));
  };
  button.addEventListener('click', () => { start(); button.blur(); });

  let timer = 0;
  let last = '';
  function refresh() {
    if (game.over) { el.hidden = true; clearInterval(timer); timer = 0; return; }
    const next = game.waves.nextWave;
    const d = describeWaveControl(game.waves, {
      enemiesRemaining: enemiesRemaining(game), countdownSeconds: getWaveCountdownSeconds(game), totalWaves: TOTAL_WAVES,
      nextWaveName: next <= TOTAL_WAVES ? waveInfo(next).name : null,
    });
    const key = `${d.mode}|${d.title}|${d.subtitle}|${d.buttonLabel}|${d.progress}`;
    if (key === last) return;
    last = key;
    title.textContent = d.title;
    sub.textContent = d.subtitle;
    button.hidden = !d.buttonLabel;
    button.textContent = d.buttonLabel;
    button.setAttribute('aria-label', d.buttonLabel ? `${d.buttonLabel}, hotkey Enter` : '');
    button.setAttribute('aria-disabled', String(!d.canStart));
    bar.hidden = d.progress === null;
    if (d.progress !== null) fill.style.transform = `scaleX(${d.progress})`;
  }

  for (const type of [EVENT_TYPES.WAVE_STARTED, EVENT_TYPES.WAVE_ENDED, EVENT_TYPES.ENEMY_SPAWNED, EVENT_TYPES.ENEMY_KILLED, EVENT_TYPES.ENEMY_LEAKED, EVENT_TYPES.GAME_OVER]) {
    game.events.on(type, refresh);
  }
  timer = setInterval(refresh, COUNTDOWN_REFRESH_MS);
  refresh();
  return { refresh, start, rect: { left, top, w, h: hh } };
}
