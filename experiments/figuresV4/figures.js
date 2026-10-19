// The six protocol-v4 figures: file names, builders and index-page captions.
import { fig1Confirmatory, fig2Attribution, fig3Estimands } from './figuresA.js';
import { fig4ContrastByWave, fig5Replication, fig6PairContrasts } from './figuresB.js';

export { fig1Confirmatory, fig2Attribution, fig3Estimands, fig4ContrastByWave, fig5Replication, fig6PairContrasts };

/** file: output name; status: evidence status shown on the figure; build(inputs, pairRows): the SVG string. */
export const FIGURES_V4 = Object.freeze([
  { file: 'fig1-confirmatory.svg', status: 'confirmatory', title: 'The three confirmatory hypotheses', build: (i) => fig1Confirmatory(i) },
  { file: 'fig2-attribution.svg', status: 'estimate', title: 'Attribution chain of lives lost', build: (i) => fig2Attribution(i) },
  { file: 'fig3-estimands.svg', status: 'estimate', title: 'Paired differences for five metrics', build: (i) => fig3Estimands(i) },
  { file: 'fig4-contrast-by-wave.svg', status: 'estimate', title: 'Style contrast by wave', build: (i) => fig4ContrastByWave(i) },
  { file: 'fig5-replication.svg', status: 'estimate', title: 'Training seeds versus held-out seeds', build: (i) => fig5Replication(i) },
  { file: 'fig6-pair-contrasts.svg', status: 'post hoc', title: 'Per-pair contrasts, held-out and training', build: (i, pairRows) => fig6PairContrasts(i, pairRows) },
]);
