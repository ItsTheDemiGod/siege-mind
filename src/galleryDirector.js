// Gallery section "7 Director": the overlay, charts, direction marks and the full report, rendered from a recorded run (docs/fixtures/demo-adaptive-w15.json).
import { config } from './data/config.js';
import { h } from './ui/dom.js';
import { createDecisionLog } from './ui/decisionLog.js';
import { createDirectorOverlay } from './ui/directorOverlay.js';
import { renderTiltChart, renderCompositionStrip, renderPatternLegend } from './ui/directorChartView.js';
import { buildDirectorReport } from './ui/directorReport.js';
import { reportSections } from './ui/directorReportView.js';
import { compositionChips } from './ui/compositionChips.js';
import { compositionItems } from './ui/compositionItems.js';
import { markChips } from './ui/directionMark.js';

const FIXTURE = 'docs/fixtures/demo-adaptive-w15.json';
const NOOP_TOASTER = { show() {} };

/** A stand-in game for the overlay: only the fields it reads. */
const fakeGame = (totalWaves) => ({ mode: 'adaptive', over: false, totalWaves, waves: { phase: 'running', nextWave: totalWaves + 1 }, events: { on() {} } });

function overlayFor(entries, upToWave, totalWaves) {
  const log = createDecisionLog();
  for (const e of entries.filter((d) => d.wave <= upToWave)) log.push(e);
  const stage = h('div', { class: 'g-overlay-stage' });
  const ctrl = createDirectorOverlay({ root: stage, game: fakeGame(totalWaves), log, toaster: NOOP_TOASTER });
  Object.assign(ctrl.el.style, { position: 'relative', left: '0', top: '0' }); // inline in the gallery instead of anchored to the stage corner
  ctrl.open();
  return stage;
}

/** @param {HTMLElement} host section element @returns {Promise<void>} */
export async function directorSection(host) {
  let run;
  try {
    const res = await fetch(FIXTURE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    run = await res.json();
  } catch (e) {
    host.append(h('p', { class: 'note', role: 'alert', text: `Could not load ${FIXTURE}: ${e.message}. Serve the project with npm start.` }));
    return;
  }
  const report = buildDirectorReport(run);
  const { entries, totalWaves } = report;
  const find = (fn, fallback) => entries.find(fn) ?? fallback;
  const picks = [
    [find((d) => d.reason === 'cold-start', entries[0]), 'a wave without evidence'],
    [find((d) => d.reason === 'adapted' && d.wave > 10, entries.at(-1)), 'an adapted wave'],
    [find((d) => d.reason === 'static-fixed', entries[0]), 'a set-piece wave'],
  ];
  host.append(h('h3', { text: 'Overlay (from the recorded run)' }), h('div', { class: 'g-row g-row--top' }, picks.map(([d, what]) => h('figure', { class: 'g-cell' }, [
    overlayFor(entries, d.wave, totalWaves), h('figcaption', { class: 'note', text: `Wave ${d.wave}: ${what} (${d.reason})` }),
  ]))));

  const full = h('div');
  const mini = h('div');
  renderTiltChart(full, entries, { width: config.report.chartWidth, height: config.report.chartHeight, totalWaves });
  renderTiltChart(mini, entries, { width: config.report.miniChartWidth, height: config.report.miniChartHeight, mini: true, totalWaves });
  const strip = h('div');
  renderCompositionStrip(strip, entries, { width: config.report.chartWidth, height: 96, totalWaves });
  const legend = h('div');
  renderPatternLegend(legend);
  host.append(h('h3', { text: 'Tilt chart, full and mini' }), full, mini, h('h3', { text: 'Composition strip' }), strip, legend);

  const chips = compositionChips(compositionItems({ armoredGrunt: 5, swarmling: 16, fastRunner: 4, regenerator: 3, shieldedBruiser: 2 }));
  markChips(chips, { armoredGrunt: 'down', swarmling: 'up', fastRunner: 'flat', regenerator: 'up', shieldedBruiser: 'down' });
  host.append(h('h3', { text: 'Direction marks on chips (up = raised, down = lowered)' }), h('div', { class: 'g-row' }, chips));

  const inline = h('div', { class: 'panel panel--director report-inline' }, [h('h2', { text: report.title }), h('p', { class: 'report-headline', text: report.headline }), ...reportSections(report)]);
  inline.style.maxWidth = `${config.ui.reportWidth}px`;
  host.append(h('h3', { text: "The full Director's Report" }), inline);
}
