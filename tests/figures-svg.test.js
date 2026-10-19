import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, fmt, niceTicks, scaleLinear, markerPath, svgDocument } from '../experiments/figures/svg.js';
import { FIGURE_PALETTE, FONT } from '../experiments/figures/palette.js';

test('the palette is the frozen Okabe-Ito set on white', () => {
  assert.ok(Object.isFrozen(FIGURE_PALETTE) && Object.isFrozen(FIGURE_PALETTE.modes));
  assert.deepEqual({ ...FIGURE_PALETTE.modes }, { static: '#0072B2', adaptive: '#D55E00', random: '#009E73' });
  assert.equal(FIGURE_PALETTE.background, '#ffffff');
  assert.match(FONT, /Arial/);
  assert.equal(new Set(Object.values(FIGURE_PALETTE.modes)).size, 3);
});

test('escapeXml escapes the five XML characters', () => {
  assert.equal(escapeXml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;');
  assert.equal(escapeXml(5), '5');
  assert.equal(escapeXml('plain'), 'plain');
});

test('fmt rounds to two decimals, drops -0 and throws on non-finite input', () => {
  assert.equal(fmt(1), '1');
  assert.equal(fmt(1.005), '1');
  assert.equal(fmt(1.236), '1.24');
  assert.equal(fmt(-0), '0');
  assert.equal(fmt(-0.001), '0');
  assert.equal(fmt(-2.5), '-2.5');
  for (const bad of [NaN, Infinity, -Infinity, '1', undefined, null]) assert.throws(() => fmt(bad), TypeError);
});

test('niceTicks covers the range with 1, 2 or 5 steps', () => {
  assert.deepEqual(niceTicks(0, 10, 5), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(niceTicks(0, 1, 5), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual(niceTicks(-0.1, 0.02, 3), [-0.1, -0.05, 0]);
  assert.deepEqual(niceTicks(0, 19, 5), [0, 5, 10, 15]);
  assert.deepEqual(niceTicks(3, 3, 5), [3]);
  const t = niceTicks(-0.7, 2.3, 4);
  assert.ok(t[0] >= -0.7 - 1e-9 && t.at(-1) <= 2.3 + 1e-9);
  assert.ok(t.every((v, i) => i === 0 || v > t[i - 1]));
});

test('scaleLinear maps the domain onto the range, including inverted ranges', () => {
  const x = scaleLinear([0, 10], [100, 200]);
  assert.deepEqual([x(0), x(5), x(10), x(20)], [100, 150, 200, 300]);
  const y = scaleLinear([0, 1], [300, 100]);
  assert.deepEqual([y(0), y(1), y(0.5)], [300, 100, 200]);
  assert.equal(scaleLinear([2, 2], [0, 10])(2), 0);
});

test('markerPath returns finite coordinates for every shape and rejects unknown shapes', () => {
  for (const shape of ['circle', 'square', 'triangle', 'diamond', 'cross']) {
    const d = markerPath(shape, 100.5, 50.25, 11);
    assert.match(d, /^M /);
    const numbers = d.match(/-?\d+(\.\d+)?/g).map(Number);
    assert.ok(numbers.length >= 4 && numbers.every(Number.isFinite), shape);
  }
  assert.notEqual(markerPath('circle', 1, 1, 10), markerPath('square', 1, 1, 10));
  assert.throws(() => markerPath('star', 1, 1, 10), RangeError);
  assert.throws(() => markerPath('circle', NaN, 1, 10), TypeError);
});

test('svgDocument has a viewBox, a title, a description, a white background and one font setting', () => {
  const s = svgDocument({ width: 960, height: 400, title: 'T <1>', desc: 'D & more', body: '<g/>' });
  assert.match(s, /viewBox="0 0 960 400"/);
  assert.match(s, /role="img"/);
  assert.ok(s.includes('<title id="fig-title">T &lt;1&gt;</title>'));
  assert.ok(s.includes('<desc id="fig-desc">D &amp; more</desc>'));
  assert.ok(s.includes('fill="#ffffff"'));
  assert.equal(s.split(`font-family="${FONT}"`).length - 1, 1);
  assert.ok(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
});
