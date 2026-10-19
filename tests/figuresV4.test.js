import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fig1Confirmatory, fig2Attribution, fig3Estimands, fig4ContrastByWave, fig5Replication, fig6PairContrasts, FIGURES_V4 } from '../experiments/figuresV4/figures.js';
import { MODE_STYLE, MODE_LABEL, STATUS_STYLE } from '../experiments/figuresV4/palette.js';
import { shapePath } from '../experiments/figuresV4/markers.js';
import { makeAnalysis } from './figuresV4Fixtures.js';

const inputs = () => ({ heldout: makeAnalysis('CONFIRMATORY'), training: makeAnalysis('EXPLORATORY DRY RUN', -0.125) });
const pairs = () => [9, 5].flatMap((wave) => ['adaptive', 'adaptive2', 'counter'].flatMap((mode) => [
  { wave, mode, style: 'noLance', type: 'armoredGrunt', mean: 0.125, ci95: [0.0625, 0.1875], seeds: 7, units: 8 },
  { wave, mode, style: 'noMortar', type: 'swarmling', mean: 0.25, ci95: [0.125, 0.375], seeds: 6, units: 8 },
  ...(wave === 9 ? [{ wave, mode, style: 'noPoison', type: 'regenerator', mean: 0.0625, ci95: [-0.0625, 0.1875], seeds: 5, units: 6 }, { wave, mode, style: 'noSniper', type: 'shieldedBruiser', mean: 0.3125, ci95: [0.25, 0.375], seeds: 5, units: 6 }] : []),
]));
const BUILD = {
  'fig1-confirmatory.svg': () => fig1Confirmatory(inputs()), 'fig2-attribution.svg': () => fig2Attribution(inputs()), 'fig3-estimands.svg': () => fig3Estimands(inputs()),
  'fig4-contrast-by-wave.svg': () => fig4ContrastByWave(inputs()), 'fig5-replication.svg': () => fig5Replication(inputs()), 'fig6-pair-contrasts.svg': () => fig6PairContrasts(inputs(), pairs()),
};
const count = (s, needle) => s.split(needle).length - 1;

/** Tags balance and every attribute is name="value" with no raw < inside the value. */
function checkXml(svg) {
  const stack = [];
  const re = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)>/g;
  let pos = 0;
  let m;
  while ((m = re.exec(svg)) !== null) {
    const between = svg.slice(pos, m.index);
    assert.ok(!/[<>]/.test(between.replace(/&[a-z]+;/g, '')), `stray angle bracket near ${between.slice(0, 40)}`);
    pos = re.lastIndex;
    const [, close, name, , selfClose] = m;
    if (close) assert.equal(stack.pop(), name, `unbalanced </${name}>`);
    else if (!selfClose) stack.push(name);
  }
  assert.equal(svg.slice(pos).trim(), '', 'trailing content');
  assert.deepEqual(stack, [], 'unclosed tags');
}

test('mode styles differ in color, marker and pattern for every pair; labels are the registered names', () => {
  const modes = Object.keys(MODE_STYLE);
  assert.equal(modes.length, 6);
  for (const k of ['color', 'marker', 'pattern']) assert.equal(new Set(modes.map((m) => MODE_STYLE[m][k])).size, 6, k);
  assert.ok(Object.isFrozen(MODE_STYLE) && Object.isFrozen(MODE_STYLE.static));
  assert.deepEqual(Object.values(MODE_LABEL), ['Static', 'Random control', 'Prior control', 'Director v1', 'Director v2', 'Counter arm (reference)']);
  assert.deepEqual(Object.keys(STATUS_STYLE), ['confirmatory', 'estimate', 'post hoc']);
  assert.equal(STATUS_STYLE.confirmatory.dash, null);
  assert.notEqual(STATUS_STYLE.estimate.dash, STATUS_STYLE['post hoc'].dash);
  assert.notEqual(shapePath('plus', 5, 5, 10), shapePath('cross', 5, 5, 10));
  assert.throws(() => shapePath('star', 0, 0, 5), RangeError);
});

test('every figure is well-formed, clean, deterministic, titled and uses text of at least 11 px', () => {
  for (const [name, build] of Object.entries(BUILD)) {
    const svg = build();
    checkXml(svg);
    assert.ok(/<title id="fig-title">[^<]+<\/title>/.test(svg) && /<desc id="fig-desc">[^<]+<\/desc>/.test(svg), name);
    assert.ok(svg.includes('role="img"'), name);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), `${name}: bad number or text`);
    assert.match(svg, /viewBox="0 0 960 \d+(\.\d+)?"/);
    assert.equal(svg, build(), `${name} is not deterministic`);
    for (const m of svg.matchAll(/font-size="(\d+)"/g)) assert.ok(Number(m[1]) >= 11, `${name}: font size ${m[1]}`);
    assert.ok(/<text[^>]*>Figure \d\./.test(svg), `${name}: no figure title inside the SVG`);
    assert.ok(svg.includes('N = ') || svg.includes('held-out: '), `${name}: no N line`);
  }
});

test('each figure carries the status tag and data-status of its evidence status', () => {
  for (const f of FIGURES_V4) {
    const svg = BUILD[f.file]();
    assert.ok(svg.includes(STATUS_STYLE[f.status].tag), `${f.file}: tag text`);
    assert.ok(svg.includes(`data-status="${f.status}"`), `${f.file}: data-status`);
    for (const other of Object.keys(STATUS_STYLE).filter((s) => s !== f.status)) assert.ok(!svg.includes(`data-status="${other}"`), `${f.file}: only one status`);
  }
  assert.deepEqual(FIGURES_V4.map((f) => f.status), ['confirmatory', 'estimate', 'estimate', 'estimate', 'estimate', 'post hoc']);
});

test('each figure draws one data-id group per data row', () => {
  const ids = (name) => [...BUILD[name]().matchAll(/<g data-id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids('fig1-confirmatory.svg'), ['K1', 'K2', 'K3']);
  assert.equal(ids('fig2-attribution.svg').length, 8);
  assert.equal(ids('fig3-estimands.svg').length, 40);
  assert.equal(ids('fig4-contrast-by-wave.svg').length, 15);
  assert.equal(ids('fig5-replication.svg').length, 28);
  assert.deepEqual(ids('fig6-pair-contrasts.svg').length, 6);
  for (const name of Object.keys(BUILD)) assert.equal(new Set(ids(name)).size, ids(name).length, `${name}: ids are unique`);
});

test('fig1 prints the verdicts and Holm p-values and escapes hostile text', () => {
  const svg = fig1Confirmatory({ heldout: makeAnalysis('CONFIRMATORY', 0, { k1Label: '<script>alert("x")</script> & \'q\'' }), training: makeAnalysis('EXPLORATORY DRY RUN') });
  checkXml(svg);
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.equal(count(svg, '>not supported<'), 1);
  assert.equal(count(svg, '>supported<'), 2);
  assert.ok(svg.includes('Holm p 0.0300'));
  assert.ok(svg.includes('0.50 [0.25, 0.75]'));
});

test('fig2: the drawn parts add up to the total and the geometry is in order', () => {
  const svg = fig2Attribution(inputs());
  const bar = (id) => Number(new RegExp(`data-bar="${id}" data-from="[^"]+" data-value="([^"]+)"`).exec(svg)[1]);
  const parts = ['random-static', 'prior-random', 'adaptive-prior'].map(bar);
  assert.ok(Math.abs(parts[0] + parts[1] + parts[2] - bar('adaptive-static')) < 1e-9);
  assert.deepEqual(parts, [0.5, 1.5, 0.25]);
  const from = (id) => Number(new RegExp(`data-bar="${id}" data-from="([^"]+)"`).exec(svg)[1]);
  assert.equal(from('prior-random'), 0.5);
  assert.equal(from('adaptive-prior'), 2);
  for (const id of ['adaptive2-static', 'counter-static', 'adaptive2-prior', 'counter-prior']) assert.ok(svg.includes(`data-id="${id}"`));
  const broken = inputs();
  broken.heldout.estimands.find((e) => e.pair === 'adaptive-static' && e.metric === 'livesLost').estimate += 0.5;
  assert.throws(() => fig2Attribution(broken), /do not sum to the total/);
});

test('fig3 shows every metric panel and all six mode labels', () => {
  const svg = fig3Estimands(inputs());
  for (const t of ['Lives lost', 'Win rate', 'Final wave reached', 'Leaked threat', 'Mean path progress']) assert.ok(svg.includes(t), t);
  for (const label of Object.values(MODE_LABEL)) assert.ok(svg.includes(label), label);
});

test('fig4 labels coverage, zero by construction and the confirmatory wave', () => {
  const svg = fig4ContrastByWave(inputs());
  for (const m of ['adaptive', 'adaptive2', 'counter', 'prior', 'random']) assert.ok(svg.includes(MODE_LABEL[m]), m);
  assert.equal(count(svg, 'coverage 75.0% (30/40)'), 15);
  assert.equal(count(svg, '>zero by construction<'), 6); // prior and random at three waves
  assert.ok(svg.includes('Wave 9: confirmatory for Director v1 and v2 (K2, K3)'));
  assert.ok(svg.includes('Wave 5: estimates') && svg.includes('Wave 13: estimates'));
});

test('fig5 tags the rows whose intervals do not overlap or whose sign differs', () => {
  const svg = fig5Replication(inputs()); // training shift -0.125: every interval overlaps and no sign changes except where the estimate crosses 0
  assert.equal(count(svg, '>no overlap<'), 0);
  const far = { heldout: makeAnalysis('CONFIRMATORY'), training: makeAnalysis('EXPLORATORY DRY RUN', -0.75) };
  const s2 = fig5Replication(far);
  checkXml(s2);
  assert.ok(count(s2, '>no overlap<') > 0 && count(s2, '>sign differs<') > 0);
  assert.ok(s2.includes('rows are tagged'));
});

test('fig6 has the post hoc tag, both waves and rejects empty input', () => {
  const svg = fig6PairContrasts(inputs(), pairs());
  assert.ok(svg.includes('Wave 9:') && svg.includes('Wave 5:'));
  assert.ok(svg.includes('noSniper -&gt; shieldedBruiser'));
  assert.ok(svg.includes('Director v1: 0.13 (n 7)'));
  assert.throws(() => fig6PairContrasts(inputs(), []), /needs the per-pair contrasts/);
});
