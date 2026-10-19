// SVG charts of the Director (hand-built, no chart library). They render once per refresh event, never per frame.
// Series differ by dash pattern and marker shape, bars by fill pattern, so nothing relies on color alone.
import { config } from '../data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../data/enemies.js';
import { svg } from './svg.js';
import { h } from './dom.js';
import { tiltChartModel, MARKERS, DASHES, PATTERNS } from './directorChart.js';
import { chartTilt } from './directorView.js';

const MARKER_R = 3.2;
let nextUid = 0;

/** @returns {string} a document-unique id prefix for SVG pattern definitions */
const uid = () => `dchart${++nextUid}`;

function marker(shape, x, y, filled, type) {
  const cls = `chart-marker enemy-${type}${filled ? '' : ' is-hollow'}`;
  const r = MARKER_R;
  switch (shape) {
    case 'circle': return svg('circle', { class: cls, cx: x, cy: y, r });
    case 'square': return svg('rect', { class: cls, x: x - r, y: y - r, width: 2 * r, height: 2 * r });
    case 'triangle': return svg('polygon', { class: cls, points: `${x},${y - r - 0.6} ${x + r + 0.6},${y + r} ${x - r - 0.6},${y + r}` });
    case 'diamond': return svg('polygon', { class: cls, points: `${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}` });
    default: return svg('path', { class: `${cls} is-line`, d: `M ${x - r} ${y - r} L ${x + r} ${y + r} M ${x - r} ${y + r} L ${x + r} ${y - r}` });
  }
}

/** Pattern definitions, one per enemy type or only for `only` (ids are `${prefix}-${type}`; a legend swatch defines just its own so ids stay unique). */
function patternDefs(prefix, only = ENEMY_ORDER) {
  const defs = svg('defs');
  for (const type of [].concat(only)) {
    const p = svg('pattern', { id: `${prefix}-${type}`, width: 6, height: 6, patternUnits: 'userSpaceOnUse' });
    const cls = `pat pat-${type}`;
    const kind = PATTERNS[type];
    if (kind === 'solid') p.append(svg('rect', { class: cls, width: 6, height: 6 }));
    else {
      p.append(svg('rect', { class: 'pat-bg', width: 6, height: 6 }));
      if (kind === 'diagonal') p.append(svg('path', { class: `${cls} is-stroke`, d: 'M -1 7 L 7 -1 M -1 1 L 1 -1 M 5 7 L 7 5' }));
      else if (kind === 'dots') p.append(svg('circle', { class: cls, cx: 3, cy: 3, r: 1.3 }));
      else if (kind === 'horizontal') p.append(svg('path', { class: `${cls} is-stroke`, d: 'M 0 2 H 6 M 0 5 H 6' }));
      else p.append(svg('path', { class: `${cls} is-stroke`, d: 'M 3 0 V 6 M 0 3 H 6' }));
    }
    defs.append(p);
  }
  return defs;
}

// a table ignores overflow clipping, so the visually hidden wrapper is a div around it
const hiddenTable = (caption, head, rows) => h('div', { class: 'sr-only' }, [h('table', {}, [
  h('caption', { text: caption }),
  h('thead', {}, [h('tr', {}, head.map((t) => h('th', { scope: 'col', text: t })))]),
  h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c, i) => h(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row', text: c } : { text: c }))))),
])]);

/**
 * Draw the tilt chart (weights over waves).
 * @param {HTMLElement} root cleared and filled @param {object[]} entries Director decisions in wave order
 * @param {{width: number, height: number, mini?: boolean, totalWaves: number}} o
 * @returns {void}
 */
export function renderTiltChart(root, entries, { width, height, mini = false, totalWaves }) {
  const pad = mini ? { padLeft: 34, padRight: 8, padTop: 8, padBottom: 16 } : { padLeft: 46, padRight: 12, padTop: 10, padBottom: 24 };
  const m = tiltChartModel(entries, { width, height, ...pad, tiltMax: config.director.tiltMax, totalWaves });
  const last = entries.at(-1);
  const lastTilt = last ? chartTilt(last) : null;
  const summary = last
    ? `Enemy weights across waves. At wave ${last.wave}: ${ENEMY_ORDER.map((t) => `${ENEMIES[t].name} ×${lastTilt[t].toFixed(2)}`).join(', ')}.`
    : 'Enemy weights across waves: no data yet.';
  const el = svg('svg', { class: `tilt-chart${mini ? ' is-mini' : ''}`, width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': summary });
  el.append(svg('rect', { class: 'chart-frame', x: m.plotLeft, y: m.plotTop, width: m.plotRight - m.plotLeft, height: m.plotBottom - m.plotTop }));
  for (const t of m.yTicks) {
    el.append(svg('line', { class: t.value === 1 ? 'chart-baseline' : 'chart-grid', x1: m.plotLeft, x2: m.plotRight, y1: t.y, y2: t.y }));
    el.append(svg('text', { class: 'chart-label', x: m.plotLeft - 4, y: t.y + 3, 'text-anchor': 'end', text: t.label }));
  }
  for (const t of m.xTicks) el.append(svg('text', { class: 'chart-label', x: t.x, y: height - (mini ? 4 : 8), 'text-anchor': 'middle', text: t.label }));
  for (const s of m.series) {
    if (s.path) el.append(svg('path', { class: `chart-line enemy-${s.type}`, d: s.path, 'stroke-width': config.ui.chartLineWidth, 'stroke-dasharray': DASHES[s.type] || 'none', fill: 'none' }));
    for (const p of s.points) el.append(marker(MARKERS[s.type], p.x, p.y, p.eligible, s.type));
  }
  const table = hiddenTable('Enemy weights per wave', ['Wave', ...ENEMY_ORDER.map((t) => ENEMIES[t].name)], entries.map((e) => {
    const tilt = chartTilt(e);
    return [String(e.wave), ...ENEMY_ORDER.map((t) => tilt[t].toFixed(2))];
  }));
  const parts = [el, table];
  if (!mini) {
    parts.push(h('ul', { class: 'chart-legend' }, ENEMY_ORDER.map((type) => {
      const sample = svg('svg', { width: 34, height: 12, viewBox: '0 0 34 12', 'aria-hidden': 'true' }, [
        svg('line', { class: `chart-line enemy-${type}`, x1: 1, x2: 33, y1: 6, y2: 6, 'stroke-width': config.ui.chartLineWidth, 'stroke-dasharray': DASHES[type] || 'none' }),
        marker(MARKERS[type], 17, 6, true, type),
      ]);
      return h('li', {}, [sample, h('span', { text: ENEMIES[type].name })]);
    })));
    parts.push(h('p', { class: 'chart-note', text: 'Filled markers: the Director could adapt that wave. Hollow markers: it held its weights.' }));
  }
  root.replaceChildren(...parts);
}

/**
 * Template shares (top) and final shares (bottom) of every started wave as stacked pattern-filled columns.
 * @param {HTMLElement} root cleared and filled @param {object[]} entries @param {{width: number, height: number, totalWaves: number}} o
 * @returns {void}
 */
export function renderCompositionStrip(root, entries, { width, height, totalWaves }) {
  const prefix = uid();
  const padLeft = 58;
  const padTop = 6;
  const padBottom = 16;
  const band = (height - padTop - padBottom - 6) / 2;
  const colW = (width - padLeft - 6) / Math.max(1, totalWaves);
  const el = svg('svg', { class: 'comp-strip', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `Enemy mix per wave, static template above and the Director's mix below, for ${entries.length} waves.` });
  el.append(patternDefs(prefix));
  const bands = [['Template', 'templateShares', padTop], ['Director', 'finalShares', padTop + band + 6]];
  for (const [label, key, top] of bands) {
    el.append(svg('text', { class: 'chart-label', x: padLeft - 6, y: top + band / 2 + 3, 'text-anchor': 'end', text: label }));
    for (const e of entries) {
      const x = padLeft + (e.wave - 1) * colW + 1;
      let y = top + band;
      for (const type of ENEMY_ORDER) {
        const hgt = e[key][type] * band;
        if (hgt <= 0) continue;
        y -= hgt;
        el.append(svg('rect', { class: 'strip-seg', x, y, width: Math.max(1, colW - 2), height: hgt, fill: `url(#${prefix}-${type})` }));
      }
    }
  }
  for (let w = 1; w <= totalWaves; w += w === 1 ? 4 : 5) el.append(svg('text', { class: 'chart-label', x: padLeft + (w - 0.5) * colW, y: height - 3, 'text-anchor': 'middle', text: String(w) }));
  const table = hiddenTable('Enemy mix per wave (percent of threat)', ['Wave', ...ENEMY_ORDER.map((t) => `${ENEMIES[t].name} template`), ...ENEMY_ORDER.map((t) => `${ENEMIES[t].name} final`)],
    entries.map((e) => [String(e.wave), ...ENEMY_ORDER.map((t) => `${Math.round(100 * e.templateShares[t])}%`), ...ENEMY_ORDER.map((t) => `${Math.round(100 * e.finalShares[t])}%`)]));
  root.replaceChildren(el, table);
}

/** @param {HTMLElement} root @returns {void} a legend that shows each pattern swatch together with the enemy name */
export function renderPatternLegend(root) {
  const prefix = uid();
  root.replaceChildren(h('ul', { class: 'chart-legend' }, ENEMY_ORDER.map((type) => {
    const swatch = svg('svg', { width: 22, height: 14, viewBox: '0 0 22 14', 'aria-hidden': 'true' }, [patternDefs(prefix, type), svg('rect', { class: 'strip-seg', x: 0, y: 0, width: 22, height: 14, fill: `url(#${prefix}-${type})` })]);
    return h('li', {}, [swatch, h('span', { text: ENEMIES[type].name })]);
  })));
}
