// Wave control (bottom centre): what is happening with waves, the Start Wave button and the intermission countdown ring.
import { config } from '../data/config.js';
import { EVENT_TYPES } from '../sim/events.js';
import { startNextWave, enemiesRemaining, getWaveCountdownSeconds } from '../sim/waveRunner.js';
import { waveInfo, hpMultiplierForWave } from '../data/waves.js';
import { describeWaveControl, ringDashOffset } from './waveControlState.js';
import { reasonText } from './towerInfo.js';
import { h } from './dom.js';

const TICK_MS = 100; // 10 Hz; the ring and text update on this clock, never per frame
const REDUCED_EVERY = 3; // reduced motion: update every 3rd tick (about 3 Hz) so the ring steps instead of sweeping
const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

/**
 * @param {{root: HTMLElement, game: object, toaster: {show: Function}, reducedMotion?: () => boolean}} o
 * @returns {{refresh: () => void, start: () => void, readonly rect: {left: number, top: number, w: number, h: number}}}
 */
export function createWaveControl({ root, game, toaster, reducedMotion = () => false }) {
  const { waveControlWidth: w, waveControlHeight: hh, waveControlBottomMargin: bottom, ringSize, ringStroke } = config.ui;
  const { width, height } = config.view;
  const left = (width - w) / 2;
  const top = height - bottom - hh;
  const radius = (ringSize - ringStroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const title = h('div', { class: 'wc-title' });
  const sub = h('div', { class: 'wc-sub' });
  const button = h('button', { type: 'button', class: 'btn btn--primary' });
  const arc = svg('circle', { class: 'ring-arc', cx: ringSize / 2, cy: ringSize / 2, r: radius, 'stroke-dasharray': circumference });
  const ring = h('span', { class: 'wc-ring', 'aria-hidden': 'true', hidden: true });
  const ringSvg = svg('svg', { width: ringSize, height: ringSize, viewBox: `0 0 ${ringSize} ${ringSize}` });
  ringSvg.append(svg('circle', { class: 'ring-track', cx: ringSize / 2, cy: ringSize / 2, r: radius }), arc);
  const ringText = h('span', { class: 'ring-text' });
  ring.append(ringSvg, ringText);
  const el = h('div', { class: 'panel wave-control', role: 'region', 'aria-label': 'Wave control' }, [title, sub, ring, button]);
  Object.assign(el.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${hh}px` });
  el.style.setProperty('--ring-size', `${ringSize}px`);
  root.append(el);

  const start = () => {
    const r = startNextWave(game);
    if (!r.ok) toaster.show(reasonText(r.reason));
  };
  button.addEventListener('click', () => { start(); button.blur(); });

  let timer = 0;
  let last = '';
  let ticks = 0;
  function refresh() {
    if (game.over) { el.hidden = true; clearInterval(timer); timer = 0; return; }
    const next = game.waves.nextWave;
    const countdown = getWaveCountdownSeconds(game);
    const d = describeWaveControl(game.waves, {
      enemiesRemaining: enemiesRemaining(game), countdownSeconds: countdown, totalWaves: game.totalWaves,
      nextWaveName: next <= game.totalWaves ? waveInfo(next).name : null, hpMultNext: hpMultiplierForWave(next),
    });
    const seconds = Math.ceil(countdown);
    const key = `${d.mode}|${d.title}|${d.subtitle}|${d.buttonLabel}|${d.mode === 'intermission' ? d.progress.toFixed(2) : ''}`;
    if (key === last) return;
    last = key;
    title.textContent = d.title;
    sub.textContent = d.subtitle;
    button.hidden = !d.buttonLabel;
    button.textContent = d.buttonLabel;
    button.setAttribute('aria-label', d.buttonLabel ? `${d.buttonLabel}, hotkey Enter` : '');
    button.setAttribute('aria-disabled', String(!d.canStart));
    ring.hidden = d.progress === null;
    if (d.progress !== null) {
      arc.setAttribute('stroke-dashoffset', String(ringDashOffset(1 - d.progress, circumference))); // drains as the countdown runs down
      ringText.textContent = String(seconds);
    }
  }

  for (const type of [EVENT_TYPES.WAVE_STARTED, EVENT_TYPES.WAVE_ENDED, EVENT_TYPES.ENEMY_SPAWNED, EVENT_TYPES.ENEMY_KILLED, EVENT_TYPES.ENEMY_LEAKED, EVENT_TYPES.GAME_OVER]) {
    game.events.on(type, refresh);
  }
  timer = setInterval(() => { ticks++; if (!reducedMotion() || ticks % REDUCED_EVERY === 0) refresh(); }, TICK_MS);
  refresh();
  return { refresh, start, rect: { left, top, w, h: hh } };
}
