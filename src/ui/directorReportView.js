// The Director report as a modal (DOM from a plain model, see directorReport.js). Sections fade in with a --i stagger (CSS, off in reduced motion).
import { config } from '../data/config.js';
import { h } from './dom.js';
import { trapTab } from './focusTrap.js';
import { endCardLayout } from './endCardLayout.js';
import { directionMark } from './directionMark.js';
import { directionOf } from './directorView.js';
import { renderTiltChart, renderCompositionStrip, renderPatternLegend } from './directorChartView.js';

const pctText = (x) => `${Math.round(100 * x)}%`;

/** Sections shared by the modal and the gallery's inline version. @returns {HTMLElement[]} */
export function reportSections(model) {
  const insights = h('ul', { class: 'report-insights' }, model.insights.map((t) => h('li', { text: t })));
  const tiltHost = h('div', { class: 'report-chart' });
  const stripHost = h('div', { class: 'report-strip' });
  const legendHost = h('div', { class: 'report-legend' });
  const waves = model.totalWaves;
  renderTiltChart(tiltHost, model.entries, { width: config.report.chartWidth, height: config.report.chartHeight, totalWaves: waves });
  renderCompositionStrip(stripHost, model.entries, { width: config.report.chartWidth, height: 96, totalWaves: waves });
  renderPatternLegend(legendHost);
  const table = h('table', { class: 'report-table' }, [
    h('thead', {}, [h('tr', {}, ['Enemy', 'Spawned', 'Killed', 'Leaked', 'Leak rate', 'Mean progress', 'Final weight'].map((t) => h('th', { scope: 'col', text: t })))]),
    h('tbody', {}, model.rows.map((r) => {
      const dir = directionOf(r.finalTilt);
      return h('tr', {}, [
        h('th', { scope: 'row', text: r.label }), h('td', { text: String(r.spawned) }), h('td', { text: String(r.killed) }), h('td', { text: String(r.leaked) }),
        h('td', { text: pctText(r.leakRate) }), h('td', { text: pctText(r.meanProgress) }),
        h('td', { class: 'report-weight' }, [dir === 'flat' ? '' : directionMark(dir), h('span', { text: `×${r.finalTilt.toFixed(2)}` })]),
      ]);
    })),
  ]);
  const section = (heading, ...kids) => h('section', { class: 'report-section' }, [h('h3', { text: heading }), ...kids]);
  return [
    section('What stood out', insights),
    section('Enemy weights over the waves', tiltHost),
    section('Enemy mix: static template versus the Director', stripHost, legendHost),
    section('How each enemy type did', table),
  ];
}

/**
 * @param {ReturnType<import('./directorReport.js').buildDirectorReport>} model an available report
 * @param {{onClose: () => void, onDownload?: () => void}} handlers
 * @returns {{el: HTMLElement, focusFirst: () => void}} el is the full-stage backdrop (not yet attached)
 */
export function renderDirectorReport(model, { onClose, onDownload }) {
  const closeBtn = h('button', { type: 'button', class: 'btn btn--primary', text: 'Close', 'aria-label': 'Close the Director report', onclick: onClose });
  const download = onDownload ? h('button', { type: 'button', class: 'btn', text: 'Download data (JSON)', 'aria-label': 'Download run data as JSON', onclick: onDownload }) : '';
  const sections = reportSections(model);
  sections.forEach((s, i) => s.style.setProperty('--i', String(i + 1)));
  const card = h('div', { class: 'panel panel--director report-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'report-title', 'data-director-report': '' }, [
    h('header', { class: 'report-head' }, [h('h2', { id: 'report-title', text: model.title }), h('p', { class: 'report-headline', text: model.headline })]),
    ...sections,
    h('p', { class: 'report-foot', text: 'This report describes this run only; the experiment compares many runs.' }),
    h('div', { class: 'actions' }, [closeBtn, download]),
  ]);
  const { top, maxHeight } = endCardLayout({ stageH: config.view.height, hudH: config.view.hudHeight, margin: config.ui.reportMargin });
  Object.assign(card.style, { width: `${config.ui.reportWidth}px`, marginTop: `${top}px`, maxHeight: `${maxHeight}px` });
  const el = h('div', { class: 'report-backdrop' }, [card]);
  el.addEventListener('keydown', trapTab(card));
  return { el, focusFirst: () => closeBtn.focus({ preventScroll: true }) };
}
