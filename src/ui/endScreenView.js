// End screen DOM from a plain model (see endModel.js). No game access, so the gallery can render it from fake data.
// Animation is CSS only (staggered via --i) and is switched off by the .reduced-motion class.
import { config } from '../data/config.js';
import { h } from './dom.js';
import { trapTab } from './focusTrap.js';
import { endCardLayout } from './endCardLayout.js';

const STATUS_WORD = { clean: 'no lives lost', hurt: 'lives lost', failed: 'core fell', unreached: 'not reached' };

/**
 * @param {ReturnType<import('./endModel.js').buildEndModel>} model
 * @param {{onRetry: () => void, onNewSeed: () => void, onMenu: () => void, onDownloadJson?: () => void, onDownloadWaves?: () => void, onReport?: () => void}} handlers
 * @returns {{el: HTMLElement, focusFirst: () => void, reportButton: HTMLElement|null}} el is the full-stage backdrop (not yet attached)
 */
export function renderEndScreen(model, { onRetry, onNewSeed, onMenu, onDownloadJson, onDownloadWaves, onReport }) {
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
  const reportButton = onReport ? h('button', { type: 'button', class: 'btn btn--ghost btn--text btn--director', text: "Director's Report", 'aria-label': "Open the Director's Report", onclick: onReport }) : null;
  const downloadButtons = onDownloadJson && onDownloadWaves ? [
    h('button', { type: 'button', class: 'btn btn--ghost btn--text', text: 'Download data (JSON)', 'aria-label': 'Download run data as JSON', onclick: onDownloadJson }),
    h('button', { type: 'button', class: 'btn btn--ghost btn--text', text: 'Wave table (CSV)', 'aria-label': 'Download wave table as CSV', onclick: onDownloadWaves }),
  ] : [];
  const extras = [...(reportButton ? [reportButton] : []), ...downloadButtons];
  const downloads = extras.length ? h('div', { class: 'end-downloads' }, extras) : '';
  const card = h('div', { class: `panel end-card ${verdict}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'end-title' }, [
    h('h2', { id: 'end-title', class: verdict, text: model.title }),
    h('p', { class: 'end-subtitle', text: model.subtitle }),
    h('table', {}, rows),
    h('div', { class: 'strip-wrap' }, [strip, h('div', { class: 'strip-caption', text: model.toughest })]),
    h('div', { class: 'actions' }, [retry, fresh, menu]),
    downloads,
    h('div', { class: 'hint', text: 'Press Esc to close' }),
  ]);
  card.style.setProperty('--end-width', `${config.ui.endScreenWidth}px`);
  card.style.setProperty('--download-height', `${config.ui.downloadButtonHeight}px`);
  const { top, maxHeight } = endCardLayout({ stageH: config.view.height, hudH: config.view.hudHeight, margin: config.ui.reportMargin });
  Object.assign(card.style, { marginTop: `${top}px`, maxHeight: `${maxHeight}px` }); // clears the HUD strip; scrolls inside when it is taller
  const el = h('div', { class: 'end-backdrop' }, [card]);
  el.addEventListener('keydown', trapTab(card));
  return { el, focusFirst: () => retry.focus(), reportButton };
}
