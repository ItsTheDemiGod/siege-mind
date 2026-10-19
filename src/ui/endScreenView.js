// End screen DOM from a plain model (see endModel.js). No game access, so the gallery can render it from fake data.
// Animation is CSS only (staggered via --i) and is switched off by the .reduced-motion class.
import { config } from '../data/config.js';
import { h } from './dom.js';
import { trapTab } from './focusTrap.js';

const STATUS_WORD = { clean: 'no lives lost', hurt: 'lives lost', failed: 'core fell', unreached: 'not reached' };

/**
 * @param {ReturnType<import('./endModel.js').buildEndModel>} model
 * @param {{onRetry: () => void, onNewSeed: () => void, onMenu: () => void}} handlers
 * @returns {{el: HTMLElement, focusFirst: () => void}} el is the full-stage backdrop (not yet attached)
 */
export function renderEndScreen(model, { onRetry, onNewSeed, onMenu }) {
  const verdict = model.victory ? 'is-victory' : 'is-defeat';
  const rows = model.rows.map((r, i) => {
    const tr = h('tr', { style: `--i:${i}` }, [h('th', { scope: 'row', text: r.label }), h('td', { text: r.value })]);
    return tr;
  });
  const cells = model.cells.map((c, i) => {
    const cell = h('span', { class: `strip-cell is-${c.status}`, 'data-tooltip': `Wave ${c.wave}: ${STATUS_WORD[c.status]}${c.livesLost ? ` (${c.livesLost})` : ''}`, style: `--i:${i};--frac:${c.heightFraction}` });
    return cell;
  });
  const strip = h('div', { class: 'wave-strip', role: 'img', 'aria-label': model.stripLabel }, cells);
  const retry = h('button', { type: 'button', class: 'btn btn--primary', text: 'Retry same seed', 'aria-label': 'Retry the same seed', onclick: onRetry });
  const fresh = h('button', { type: 'button', class: 'btn', text: 'New seed', 'aria-label': 'Start again with a new seed', onclick: onNewSeed });
  const menu = h('button', { type: 'button', class: 'btn', text: 'Main menu', 'aria-label': 'Return to the main menu', onclick: onMenu });
  const card = h('div', { class: `panel end-card ${verdict}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'end-title' }, [
    h('h2', { id: 'end-title', class: verdict, text: model.title }),
    h('p', { class: 'end-subtitle', text: model.subtitle }),
    h('table', {}, rows),
    h('div', { class: 'strip-wrap' }, [strip, h('div', { class: 'strip-caption', text: model.toughest })]),
    h('div', { class: 'actions' }, [retry, fresh, menu]),
    h('div', { class: 'hint', text: 'Press Esc to close' }),
  ]);
  card.style.setProperty('--end-width', `${config.ui.endScreenWidth}px`);
  const el = h('div', { class: 'end-backdrop' }, [card]);
  el.addEventListener('keydown', trapTab(card));
  return { el, focusFirst: () => retry.focus() };
}
