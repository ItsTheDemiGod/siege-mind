import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { PROTOCOL } from '../experiments/protocol.js';
import { forestFigure, livesLostFigure, winRateFigure, weightsHeatmapFigure, tiltAlignmentFigure, diagnosticsFigure } from '../experiments/figures/figures.js';
import { FIGURE_PALETTE } from '../experiments/figures/palette.js';
import { syntheticAnalysis, syntheticDiagnostics } from './figureFixtures.js';

const analysis = syntheticAnalysis();
const diag = syntheticDiagnostics();
const BUILDERS = {
  forest: () => forestFigure(analysis), livesLost: () => livesLostFigure(analysis), winRate: () => winRateFigure(analysis),
  heatmap: () => weightsHeatmapFigure(analysis), tiltAlignment: () => tiltAlignmentFigure(analysis), diagnostics: () => diagnosticsFigure(diag),
};
const count = (s, needle) => s.split(needle).length - 1;

/** Small well-formedness check: tags balance and every attribute is name="value" with no raw < inside the value. */
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

test('every figure is well-formed XML with a title, a description and clean numbers, and is deterministic', () => {
  for (const [name, build] of Object.entries(BUILDERS)) {
    const svg = build();
    checkXml(svg);
    assert.ok(/<title id="fig-title">[^<]+<\/title>/.test(svg) && /<desc id="fig-desc">[^<]+<\/desc>/.test(svg), name);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), `${name}: bad number or text`);
    assert.match(svg, /viewBox="0 0 960 \d+(\.\d+)?"/);
    assert.equal(svg, build(), `${name} is not deterministic`);
    for (const m of svg.matchAll(/font-size="(\d+)"/g)) assert.ok(Number(m[1]) >= 11, `${name}: font size ${m[1]}`);
    assert.ok(/<text[^>]*>Figure \d\./.test(svg), `${name}: no figure title inside the SVG`);
  }
});

test('data element counts: one row per hypothesis, 25 heatmap cells, 3 bars per group', () => {
  const hyps = syntheticAnalysis().hypotheses; // legacy protocol of the fixtures (see figureFixtures.js)
  assert.equal(count(BUILDERS.forest(), 'data-id="'), hyps.length);
  for (const h of hyps) assert.ok(BUILDERS.forest().includes(`data-id="${h.id}"`), h.id);
  assert.equal(count(BUILDERS.heatmap(), 'data-cell="'), 25);
  assert.equal(count(BUILDERS.livesLost(), 'data-bar="'), 6 * 3);
  assert.equal(count(BUILDERS.winRate(), 'data-point="'), 6 * 3);
  assert.equal(count(BUILDERS.tiltAlignment(), 'data-point="'), 4 * 2);
  assert.equal(count(BUILDERS.diagnostics(), 'data-panel="a"'), 5);
  assert.equal(count(BUILDERS.diagnostics(), 'data-panel="b"'), 10);
});

test('modes differ in BOTH color and pattern (bars) or marker shape (dots)', () => {
  const bars = BUILDERS.livesLost();
  const fills = ['static', 'adaptive', 'random'].map((m) => new RegExp(`<rect[^>]*fill="([^"]+)"[^>]*data-bar="all:${m}"`).exec(bars)[1]);
  assert.equal(new Set(fills).size, 3, 'three distinct fills');
  assert.equal(fills[0], FIGURE_PALETTE.modes.static, 'static is a solid fill');
  assert.ok(fills[1].startsWith('url(#') && fills[2].startsWith('url(#') && fills[1] !== fills[2], 'adaptive and random use different patterns');
  const strokes = ['static', 'adaptive', 'random'].map((m) => new RegExp(`stroke="([^"]+)"[^>]*data-bar="all:${m}"`).exec(bars)[1]);
  assert.deepEqual(strokes, ['static', 'adaptive', 'random'].map((m) => FIGURE_PALETTE.modes[m]));
  for (const build of [BUILDERS.winRate, BUILDERS.tiltAlignment]) {
    const svg = build();
    const shape = (mode) => {
      const group = new RegExp(`<g data-point="[^"]*:${mode}">.*?</g>`, 's').exec(svg)[0];
      return { d: /<path d="([^"]+)"/.exec(group)[1].split(' ').filter((t) => /[a-zA-Z]/.test(t)).join(''), color: /fill="(#[0-9A-Fa-f]{6})"/.exec(group)[1] };
    };
    const [a, b] = [shape('adaptive'), shape('random')];
    assert.notEqual(a.d, b.d, 'different marker shapes');
    assert.notEqual(a.color, b.color, 'different colors');
  }
  const win = BUILDERS.winRate();
  const sig = (mode) => /<path d="([^"]+)"/.exec(new RegExp(`<g data-point="all:${mode}">.*?</g>`, 's').exec(win)[0])[1].replace(/[-\d.\s]/g, '');
  assert.equal(new Set(['static', 'adaptive', 'random'].map(sig)).size, 3);
});

test('enemy types differ by pattern in the diagnostics and by marker in the heatmap, and every name appears', () => {
  const d = BUILDERS.diagnostics();
  const fills = ENEMY_ORDER.map((t) => new RegExp(`fill="([^"]+)"[^>]*data-type="${t}" data-panel="a"`).exec(d)[1]);
  assert.equal(new Set(fills).size, 5);
  const heat = BUILDERS.heatmap();
  for (const t of ENEMY_ORDER) {
    const words = ENEMIES[t].name.split(' ');
    assert.ok(heat.includes(ENEMIES[t].name), `heatmap names ${t}`);
    for (const w of words) assert.ok(d.includes(`>${w}<`), `diagnostics names ${w}`);
  }
  assert.ok(count(heat, '<path d="M ') >= 5 + 5, 'a marker per column plus glyphs');
});

test('the heatmap repeats the direction with a triangle outside 0.91 to 1.10', () => {
  const heat = BUILDERS.heatmap();
  // adaptive weights in the fixture: 0.6, 0.85, 0.5, 1.3, 1.2 -> every cell is outside the band, so every cell has a glyph path
  const cells = [...heat.matchAll(/<g data-cell="[^"]+">.*?<\/g>/gs)].map((m) => m[0]);
  assert.equal(cells.length, 25);
  assert.ok(cells.every((c) => count(c, '<path') === 1));
  const flat = syntheticAnalysis();
  for (const s of Object.keys(flat.tiltAlignment.tilts)) flat.tiltAlignment.tilts[s].armoredGrunt.mean = 1.0;
  const flatCells = [...weightsHeatmapFigure(flat).matchAll(/<g data-cell="[^"]+:armoredGrunt">.*?<\/g>/gs)].map((m) => m[0]);
  assert.equal(flatCells.length, 5);
  assert.ok(flatCells.every((c) => count(c, '<path') === 0), 'no glyph inside the band');
});

test('hostile text is escaped', () => {
  const hostile = syntheticAnalysis();
  const evil = '<script>alert("x")</script>&';
  hostile.descriptive.livesLost.byStyleMode[evil] = hostile.descriptive.livesLost.byStyleMode.lanceHeavy;
  const svg = livesLostFigure(hostile);
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;'));
  checkXml(svg);
});
