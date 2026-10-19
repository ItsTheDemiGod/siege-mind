// Figures 1-3 of protocol v4: the confirmatory forest, the attribution waterfall and the estimand small multiples. Pure builders; every number comes
// from the analysis objects through the shared formatter.
import { loadFigureInputs } from './data.js';
import { figure, forestPanel, BODY_Y } from './kit.js';
import { MODE_STYLE, MODE_LABEL } from './palette.js';
import { fmtEst, fmtRate, fmtP, fmtCI } from '../resultsFormat.js';

const GAP = 12;
const pairLabel = (a, b) => `${MODE_LABEL[a]} - ${MODE_LABEL[b]}`;
const item = (e, mode) => ({ est: e.estimate, ci: e.ci95, style: MODE_STYLE[mode] });
const nLine = (a) => `N = ${a.n.seeds} held-out seeds x ${a.n.styles} styles x ${a.n.modes} modes = ${a.n.rows} games; primary population ${a.population.units} units (static game reached wave 5)`;
const stack = (panels) => ({ body: panels.map((p) => p.markup).join('\n'), bodyHeight: panels.reduce((s, p) => s + p.height + GAP, 0) });

/** Figure 1: K1-K3 as a forest with Holm p and the verdict. @param {{heldout: object, training: object}} inputs @returns {string} SVG */
export function fig1Confirmatory(inputs) {
  const { heldout: a } = loadFigureInputs(inputs);
  const modeOf = { K1: 'random', K2: 'adaptive', K3: 'adaptive2' };
  const row = (k) => ({
    id: k.id, label: `${k.id}: ${k.label}`, items: [item(k, modeOf[k.id])], status: 'confirmatory',
    right: [`${fmtEst(k.estimate)} ${fmtCI(k.ci95)}`, `Holm p ${fmtP(k.pHolm)}`, k.supported ? 'supported' : 'not supported'],
  });
  const [k1, k2, k3] = a.confirmatory;
  const p1 = forestPanel({ y: BODY_Y, title: 'K1: lives lost, Random control minus Static (population units)', xTitle: 'difference in lives lost (a lost game counts as 20)', rows: [row(k1)], status: 'confirmatory' });
  const p2 = forestPanel({ y: BODY_Y + p1.height + GAP, title: 'K2, K3: fixed-wave style contrast at wave 9 (0 = weights do not depend on the defense)', xTitle: 'style contrast of the final weights', rows: [row(k2), row(k3)], status: 'confirmatory' });
  const { body, bodyHeight } = stack([p1, p2]);
  return figure({
    num: 1, title: 'The three confirmatory hypotheses', n: `${nLine(a)}; K1 n = ${k1.n} seeds, K2 n = ${k2.n}, K3 n = ${k3.n}`, status: 'confirmatory', body, bodyHeight,
    legendModes: ['random', 'adaptive', 'adaptive2'],
    desc: `Forest plot of the estimates, 95% cluster-bootstrap intervals and Holm-adjusted p-values for K1 (${k1.supported ? 'supported' : 'not supported'}), K2 (${k2.supported ? 'supported' : 'not supported'}) and K3 (${k3.supported ? 'supported' : 'not supported'}).`,
    caption: 'Point estimate with 95% cluster-bootstrap interval over seeds and the Holm-adjusted p for each pre-registered hypothesis. K1 is random minus static in lives lost; K2 and K3 are the wave-9 style contrasts of Director v1 and v2.',
  });
}

/** Figure 2: waterfall of the lives-lost attribution chain plus the other arms. @returns {string} SVG @throws {Error} when the parts do not sum to the total */
export function fig2Attribution(inputs) {
  const { heldout: a } = loadFigureInputs(inputs);
  const E = (p) => a.estimands.find((e) => e.pair === p && e.metric === 'livesLost');
  const [p1, p2, p3, total] = [E('random-static'), E('prior-random'), E('adaptive-prior'), E('adaptive-static')];
  const sum = p1.estimate + p2.estimate + p3.estimate;
  if (Math.abs(sum - total.estimate) > 1e-4) throw new Error(`the attribution parts (${sum}) do not sum to the total (${total.estimate})`);
  let start = 0;
  const part = (e, id, label, mode) => {
    const from = start;
    start += e.estimate;
    return { id, label, bar: { from, to: start, mode, value: e.estimate }, items: [{ est: start, ci: [from + e.ci95[0], from + e.ci95[1]], style: MODE_STYLE[mode] }], right: [`${fmtEst(e.estimate)} ${fmtCI(e.ci95)}`] };
  };
  const rows = [
    { header: 'Lives lost against Static: parts add up to the total' },
    part(p1, 'random-static', `${pairLabel('random', 'static')} (composition variability)`, 'random'),
    part(p2, 'prior-random', `${pairLabel('prior', 'random')} (fixed durability weights)`, 'prior'),
    part(p3, 'adaptive-prior', `${pairLabel('adaptive', 'prior')} (learning on top)`, 'adaptive'),
    { id: 'adaptive-static', label: `Total: ${pairLabel('adaptive', 'static')}`, bar: { from: 0, to: total.estimate, mode: 'adaptive', value: total.estimate }, items: [item(total, 'adaptive')], right: [`${fmtEst(total.estimate)} ${fmtCI(total.ci95)}`] },
    { header: 'Other arms (same metric, shown for comparison)' },
    ...[['adaptive2', 'static'], ['counter', 'static'], ['adaptive2', 'prior'], ['counter', 'prior']].map(([x, y]) => ({
      id: `${x}-${y}`, label: pairLabel(x, y), items: [item(E(`${x}-${y}`), x)], right: [`${fmtEst(E(`${x}-${y}`).estimate)} ${fmtCI(E(`${x}-${y}`).ci95)}`],
    })),
  ];
  const { body, bodyHeight } = stack([forestPanel({ y: BODY_Y, title: 'Attribution of the extra lives lost by Director v1', xTitle: 'difference in lives lost (a lost game counts as 20)', rows, status: 'estimate', labelW: 330, plotW: 390 })]);
  return figure({
    num: 2, title: 'Attribution chain of lives lost', n: nLine(a), status: 'estimate', body, bodyHeight,
    legendModes: ['random', 'prior', 'adaptive', 'adaptive2', 'counter'],
    desc: `Waterfall of the three paired differences that add up to Director v1 minus Static in lives lost (sum ${fmtEst(sum)}, total ${fmtEst(total.estimate)}), with the other arms below.`,
    caption: `Each bar starts where the previous one ends; the three parts sum to ${fmtEst(sum)} and the total difference is ${fmtEst(total.estimate)}. Whiskers are 95% cluster-bootstrap intervals of each part. The lower rows show the other arms.`,
  });
}

const METRICS = [
  ['livesLost', 'Lives lost (a lost game counts as 20)', fmtEst], ['won', 'Win rate (share of games won)', fmtRate], ['finalWave', 'Final wave reached', fmtEst],
  ['leakFraction', 'Leaked threat as a fraction of spawned threat', fmtRate], ['penetration', 'Mean path progress of enemies (penetration)', fmtRate],
];

/** Figure 3: the eight estimand pairs for five metrics as stacked small multiples. @returns {string} SVG */
export function fig3Estimands(inputs) {
  const { heldout: a } = loadFigureInputs(inputs);
  const panels = [];
  let y = BODY_Y;
  for (const [metric, title, f] of METRICS) {
    const rows = a.estimands.filter((e) => e.metric === metric).map((e) => ({ id: `${metric}|${e.pair}`, label: pairLabel(e.a, e.b), items: [item(e, e.a)], right: [`${f(e.estimate)} ${fmtCI(e.ci95, f)}`] }));
    const p = forestPanel({ y, title, xTitle: `difference in ${title.toLowerCase()}`, rows, status: 'estimate', fmtTick: f, rowH: 22 });
    panels.push(p);
    y += p.height + GAP;
  }
  const { body, bodyHeight } = stack(panels);
  return figure({
    num: 3, title: 'Paired differences for five metrics', n: nLine(a), status: 'estimate', body, bodyHeight,
    legendModes: ['static', 'random', 'prior', 'adaptive', 'adaptive2', 'counter'],
    desc: 'Eight paired differences between modes for lives lost, win rate, final wave, leaked threat fraction and penetration, each with a 95% cluster-bootstrap interval.',
    caption: 'Paired differences between modes (first minus second) over seeds, with 95% cluster-bootstrap intervals; the marker shows the first mode of each pair. No p-values are computed for these estimates.',
  });
}
