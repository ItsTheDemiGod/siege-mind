// Director overlay: what the Director decided for the wave and why. Read-only: it renders decisions (plain data) and never touches sim state.
// Data: before a wave (prep / intermission) the pure planner's decision for the upcoming wave; while a wave runs and after the game, the latest logged decision.
import { config } from '../data/config.js';
import { EVENT_TYPES } from '../sim/events.js';
import { planWaveWithDecision } from '../sim/waves.js';
import { h } from './dom.js';
import { iconSvg, enemyIconName } from './icons.js';
import { buildDirectorView, tiltMaxOf } from './directorView.js';
import { directionMark } from './directionMark.js';
import { renderTiltChart } from './directorChartView.js';

const REFRESH_MS = 250; // the wave phase flips after WAVE_ENDED fires, so a slow poll with key de-duplication keeps the panel honest
const STATIC_TOAST = 'The Director overlay is available in Adaptive mode';
const REASON_TEXT = Object.freeze({
  adapted: 'adapted', 'cold-start': 'no evidence yet', random: 'random weights', prior: 'fixed prior weights', 'static-early': 'too early to adapt', 'static-intro': 'new enemy type', 'static-fixed': 'set piece',
});
const pct = (x) => `${Math.round(100 * x)}%`;
const signed = (x) => `${x >= 0 ? '+' : '-'}${Math.abs(x).toFixed(2)}`;

/**
 * @param {{root: HTMLElement, game: object, log: ReturnType<import('./decisionLog.js').createDecisionLog>, toaster: {show: Function}, onChange?: (open: boolean) => void}} o
 * @returns {{el: HTMLElement, toggle: () => void, open: () => void, close: () => void, refresh: () => void, readonly isOpen: boolean}}
 */
export function createDirectorOverlay({ root, game, log, toaster, onChange = () => {} }) {
  const { directorOverlayWidth: w, directorOverlayMaxHeight: maxH, directorOverlayMargin: margin } = config.ui;
  const title = h('div', { class: 'dov-title' });
  const sub = h('div', { class: 'dov-sub' });
  const closeBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--icon dov-close', 'aria-label': 'Close the Director overlay', html: iconSvg('close', 16) });
  const rows = h('div', { class: 'dov-rows' });
  const lines = h('ul', { class: 'dov-lines' });
  const chart = h('div', { class: 'dov-chart' });
  const el = h('aside', { class: 'panel panel--director director-overlay', 'aria-label': 'Director insights', 'data-director-overlay': '', hidden: true }, [
    h('div', { class: 'dov-head' }, [h('div', {}, [title, sub]), closeBtn]), rows, lines, chart,
  ]);
  Object.assign(el.style, { left: `${config.view.width - margin - w}px`, top: `${config.view.hudHeight + margin}px`, width: `${w}px`, maxHeight: `${maxH}px` });
  root.append(el);

  let isOpen = false;
  let lastKey = '';

  /** The decision to show and the entries for the mini chart. */
  function current() {
    if (game.mode === 'static') return { decision: null, entries: [] };
    const entries = log.entries();
    const next = game.waves.nextWave;
    const planning = (game.waves.phase === 'prep' || game.waves.phase === 'intermission') && !game.over && next <= game.totalWaves;
    if (planning) {
      const upcoming = planWaveWithDecision(game, next).decision;
      if (!entries.length || entries.at(-1).wave < upcoming.wave) entries.push(upcoming);
      return { decision: upcoming, entries };
    }
    return { decision: entries.at(-1) ?? null, entries };
  }

  function renderRow(r) {
    const fill = h('i', { class: `dov-fill ${r.barFraction < 0 ? 'is-neg' : 'is-pos'}` });
    fill.style.left = `${50 + Math.min(0, r.barFraction) * 50}%`;
    fill.style.width = `${Math.abs(r.barFraction) * 50}%`;
    const bar = h('div', { class: 'dov-bar', 'aria-hidden': 'true' }, [fill, h('b', { class: 'dov-zero' })]);
    const evidence = r.units > 0
      ? `last wave ${r.units} sent, ${r.leaked} leaked, ${Math.round(100 * r.meanProgress)}% progress, advantage ${signed(r.advantage)}`
      : 'last wave: none sent';
    const value = h('span', { class: 'dov-value' }, [r.direction === 'flat' ? '' : directionMark(r.direction), h('span', { text: `×${r.tilt.toFixed(2)}` })]);
    return h('div', { class: 'dov-row', 'data-type': r.type }, [
      h('div', { class: 'dov-line' }, [h('span', { class: `comp-icon enemy-${r.type}`, html: iconSvg(enemyIconName(r.type), 16) }), h('span', { class: 'dov-name', text: r.label }), bar, value]),
      h('div', { class: 'dov-meta', text: `${pct(r.templateShare)} → ${pct(r.finalShare)} · ${evidence}` }),
    ]);
  }

  function refresh(force = false) {
    if (!isOpen) return;
    const { decision, entries } = current();
    const key = `${decision ? `${decision.wave}|${decision.reason}|${entries.length}` : 'none'}|${game.waves.phase}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    const view = buildDirectorView(decision, { tiltMax: tiltMaxOf(decision.mode) });
    title.textContent = view.title ?? 'Director';
    sub.textContent = decision ? `Wave ${view.wave} · ${REASON_TEXT[view.reason] ?? view.reason}` : 'No decision yet';
    rows.replaceChildren(...view.rows.map(renderRow));
    lines.replaceChildren(...view.lines.slice(0, 2).map((t) => h('li', { text: t })));
    if (entries.length) renderTiltChart(chart, entries, { width: config.report.miniChartWidth, height: config.report.miniChartHeight, mini: true, totalWaves: game.totalWaves });
    else chart.replaceChildren();
  }

  function open() {
    if (game.mode === 'static') { toaster.show(STATIC_TOAST); return; }
    if (isOpen) return;
    isOpen = true;
    el.hidden = false;
    refresh(true);
    onChange(true);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    el.hidden = true;
    onChange(false);
  }
  closeBtn.addEventListener('click', close);
  for (const t of [EVENT_TYPES.GAME_STARTED, EVENT_TYPES.WAVE_STARTED, EVENT_TYPES.WAVE_ENDED, EVENT_TYPES.GAME_OVER]) game.events.on(t, () => refresh());
  setInterval(refresh, REFRESH_MS);

  return { el, toggle() { if (isOpen) close(); else open(); }, open, close, refresh: () => refresh(true), get isOpen() { return isOpen; } };
}
