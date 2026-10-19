// Figures 4-6 of protocol v4: contrasts by wave, training versus held-out replication, and post hoc per-pair contrasts. Pure builders.
import { loadFigureInputs, replicationTable, distinctRows, K_ALIASES } from './data.js';
import { figure, forestPanel, BODY_Y } from './kit.js';
import { MODE_STYLE, MODE_LABEL, INK } from './palette.js';
import { fmtEst, fmtRate, fmtPct, fmtCI } from '../resultsFormat.js';
import { FEW_UNITS } from '../resultsDocParts.js';

const GAP = 12;
const ZERO = 1e-9;
const CONTRAST_MODES = ['adaptive', 'adaptive2', 'counter', 'prior', 'random'];
const nLine = (a) => `N = ${a.n.seeds} held-out seeds x ${a.n.styles} styles x ${a.n.modes} modes = ${a.n.rows} games; primary population ${a.population.units} units (static game reached wave 5)`;
const stack = (panels) => ({ body: panels.map((p) => p.markup).join('\n'), bodyHeight: panels.reduce((s, p) => s + p.height + GAP, 0) });

/** Figure 4: fixed-wave style contrast at waves 5, 9, 13 for five modes, with coverage. @returns {string} SVG */
export function fig4ContrastByWave(inputs) {
  const { heldout: a } = loadFigureInputs(inputs);
  const primary = a.coverageAtPrimary.wave;
  const waves = [...new Set(a.contrasts.map((c) => c.wave))];
  const rows = [];
  for (const wave of waves) {
    rows.push({ header: wave === primary ? `Wave ${wave}: confirmatory for Director v1 and v2 (K2, K3), estimate for the others` : `Wave ${wave}: estimates` });
    for (const mode of CONTRAST_MODES) {
      const c = a.contrasts.find((x) => x.wave === wave && x.mode === mode);
      const zero = Math.abs(c.estimate) < ZERO;
      rows.push({
        id: `${mode}@${wave}`, label: MODE_LABEL[mode], items: [{ est: c.estimate, ci: c.ci95, style: MODE_STYLE[mode] }],
        status: wave === primary && (mode === 'adaptive' || mode === 'adaptive2') ? 'confirmatory' : 'estimate',
        right: [`coverage ${fmtPct(c.coverage)} (${c.unitsObserved}/${c.populationUnits})`, `${fmtEst(c.estimate)} ${fmtCI(c.ci95)}`, ...(zero ? ['zero by construction'] : [])],
      });
    }
  }
  const { body, bodyHeight } = stack([forestPanel({ y: BODY_Y, title: 'Style contrast of the weights (unlocked enemy types only)', xTitle: 'style contrast (0 = weights do not depend on the defense)', rows, status: 'estimate', labelW: 220, plotW: 480, rowH: 24 })]);
  return figure({
    num: 4, title: 'Style contrast by wave', n: nLine(a), status: 'estimate', body, bodyHeight, legendModes: [...CONTRAST_MODES],
    desc: 'Fixed-wave style contrast at waves 5, 9 and 13 for Director v1, Director v2, the counter arm, the prior control and the random control, with coverage.',
    caption: 'Weight of a style on its predicted enemy type minus the mean of the other predicted-style games of the same seed, averaged over seeds; coverage is the share of population units still observed at that wave. Prior and random are zero by construction.',
  });
}

const PANELS = [
  { key: 'K1', title: 'K1: Random control minus Static, lives lost', pick: (r) => r.id === 'K1', f: fmtEst, unit: 'difference in lives lost' },
  { key: 'K2K3', title: 'K2, K3: style contrast at wave 9', pick: (r) => r.group === 'confirmatory' && r.id !== 'K1', f: fmtEst, unit: 'style contrast' },
  { key: 'livesLost', title: 'Paired differences in lives lost', pick: (r) => r.group === 'livesLost', f: fmtEst, unit: 'difference in lives lost' },
  { key: 'won', title: 'Paired differences in win rate', pick: (r) => r.group === 'won', f: fmtRate, unit: 'difference in win rate' },
  { key: 'contrast', title: 'Style contrast at waves 5, 9, 13', pick: (r) => r.group === 'contrast', f: fmtEst, unit: 'style contrast' },
];

/** Figure 5: training (open marker) versus held-out (filled marker) for the replication rows. @returns {string} SVG */
export function fig5Replication(inputs) {
  const { heldout, training } = loadFigureInputs(inputs);
  const table = replicationTable(heldout, training);
  const nDistinct = distinctRows(table, K_ALIASES).distinct.length;
  const hs = { color: INK.ink, marker: 'circle' };
  const ts = { color: INK.muted, marker: 'circle' };
  const panels = [];
  let y = BODY_Y;
  for (const P of PANELS) {
    const rows = table.filter(P.pick).map((r) => ({
      id: r.id, label: r.group === 'confirmatory' ? r.id : r.label, items: [{ est: r.training.estimate, ci: r.training.ci95, style: ts, hollow: true }, { est: r.heldout.estimate, ci: r.heldout.ci95, style: hs }],
      right: [...(r.overlap ? [] : ['no overlap']), ...(r.sameSign ? [] : ['sign differs'])],
    }));
    const p = forestPanel({ y, title: P.title, xTitle: P.unit, rows, status: 'estimate', fmtTick: P.f, rowH: 30 });
    panels.push(p);
    y += p.height + GAP;
  }
  const { body, bodyHeight } = stack(panels);
  const apart = table.filter((r) => !r.overlap).length;
  return figure({
    num: 5, title: 'Training seeds versus held-out seeds', n: `held-out: ${heldout.n.seeds} seeds, ${heldout.population.units} population units; training: ${training.n.seeds} seeds, ${training.population.units} units (exploratory); ${nDistinct} distinct rows of ${table.length} (K1-K3 repeat other rows)`, status: 'estimate', body, bodyHeight,
    note: 'Open circle: training seeds (exploratory, used to design the plan). Filled circle: held-out seeds (K1-K3 confirmatory, other rows estimates).',
    desc: `Training and held-out estimates with 95% intervals for ${table.length} rows; ${apart} rows have non-overlapping intervals.`,
    caption: `Each row shows the training estimate and the held-out estimate with 95% cluster-bootstrap intervals; ${apart} of ${table.length} rows are tagged 'no overlap' because their intervals do not overlap.`,
  });
}

/** Figure 6: post hoc per-pair contrasts, held-out (filled markers) and training (open markers) for Director v1, v2 and the counter arm. @param {object} inputs @param {object[]} pairRows from replicationPairTable @returns {string} SVG */
export function fig6PairContrasts(inputs, pairRows) {
  const { heldout: a, training: t } = loadFigureInputs(inputs);
  if (!Array.isArray(pairRows) || pairRows.length === 0) throw new Error('fig6PairContrasts needs the per-pair replication rows');
  const modes = ['adaptive', 'adaptive2', 'counter'];
  const panels = [];
  let y = BODY_Y;
  for (const wave of [a.coverageAtPrimary.wave, Math.min(...a.contrasts.map((c) => c.wave))]) {
    const keys = [...new Set(pairRows.filter((p) => p.wave === wave).map((p) => p.pair))].sort();
    const rows = keys.map((pair) => {
      const mine = modes.map((m) => pairRows.find((p) => p.wave === wave && p.mode === m && p.pair === pair)).filter(Boolean);
      const few = mine.some((p) => p.training.units < FEW_UNITS);
      return {
        id: `${wave}|${pair}`, label: pair,
        items: mine.flatMap((p) => [
          { est: p.heldout.estimate, ci: p.heldout.ci95, style: MODE_STYLE[p.mode], series: `${p.mode}|heldout` },
          { est: p.training.estimate, ci: p.training.ci95, style: MODE_STYLE[p.mode], hollow: true, series: `${p.mode}|training` },
        ]),
        right: [...(few ? ['few training units'] : []), ...mine.map((p) => `${MODE_LABEL[p.mode].replace(' (reference)', '')}: held-out ${fmtEst(p.heldout.estimate)}, training ${fmtEst(p.training.estimate)}`)],
      };
    });
    const p = forestPanel({ y, title: `Wave ${wave}: contrast of one defense on its predicted enemy type`, xTitle: 'style contrast of one (style, enemy type) pair', rows, status: 'post hoc', rowH: 70, labelW: 220, plotW: 360 });
    panels.push(p);
    y += p.height + GAP;
  }
  const { body, bodyHeight } = stack(panels);
  return figure({
    num: 6, title: 'Per-pair contrasts, held-out and training', n: `held-out: ${a.n.seeds} seeds, ${a.population.units} population units; training: ${t.n.seeds} seeds, ${t.population.units} units (exploratory)`, status: 'post hoc', body, bodyHeight, legendModes: modes,
    note: 'Filled marker: held-out seeds. Open marker (a lighter stroke for the x and + shapes): training seeds.',
    desc: 'Per (defense style, predicted enemy type) fixed-wave contrasts at wave 9 and wave 5 for Director v1, Director v2 and the counter arm, on the held-out seeds and on the training seeds.',
    caption: `Each row is one defense style with the enemy type its missing tower is strong against; every mode shows its held-out estimate (filled) and its training estimate (open) with 95% cluster-bootstrap intervals. Rows tagged 'few training units' have fewer than ${FEW_UNITS} training units for at least one mode. Computed after the run, not pre-registered.`,
  });
}
