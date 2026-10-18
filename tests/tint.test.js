import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTintTable } from '../src/render/tint.js';
import { THEME } from '../src/render/theme.js';
import { contrastRatio, mixHex, deltaE76 } from '../src/render/color.js';

const base = { armoredGrunt: THEME.enemy.armoredGrunt, swarmling: THEME.enemy.swarmling };
const tint = { 1: THEME.colors.secondary, 2: THEME.colors.tertiary, 3: mixHex(THEME.colors.secondary, THEME.colors.tertiary, 0.5) };
const amounts = { 0: 0, 1: 0.25, 2: 0.25, 3: 0.25 };

test('the table covers every id and key and is frozen', () => {
  const t = buildTintTable(base, tint, amounts);
  assert.deepEqual(Object.keys(t), Object.keys(base));
  for (const id of Object.keys(base)) assert.deepEqual(Object.keys(t[id]), ['0', '1', '2', '3']);
  assert.ok(Object.isFrozen(t) && Object.isFrozen(t.armoredGrunt));
});

test('amount 0 equals the base color', () => {
  const t = buildTintTable(base, tint, amounts);
  for (const id of Object.keys(base)) assert.equal(t[id][0], base[id]);
});

test('amounts move monotonically toward the tint color', () => {
  let prev = Infinity;
  for (const a of [0, 0.1, 0.25, 0.5, 0.9, 1]) {
    const c = buildTintTable({ x: base.armoredGrunt }, { 1: tint[1] }, { 1: a }).x[1];
    const d = deltaE76(c, tint[1]);
    assert.ok(d <= prev + 1e-9, `${a}: ${d} > ${prev}`);
    prev = d;
  }
});

test('tinted enemy colors stay visible on the background', () => {
  const t = buildTintTable({ ...THEME.enemy }, tint, amounts);
  for (const id of Object.keys(THEME.enemy)) for (const k of ['1', '2', '3']) assert.ok(contrastRatio(t[id][k], THEME.colors.bg0) >= 3, `${id} ${k}`);
});
