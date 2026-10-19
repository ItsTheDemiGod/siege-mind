import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentText } from '../src/ui/volumeText.js';

test('percentText speaks a volume as a rounded percent and clamps bad input', () => {
  assert.equal(percentText(0.6), '60 percent');
  assert.equal(percentText(0), '0 percent');
  assert.equal(percentText(1), '100 percent');
  assert.equal(percentText(0.333), '33 percent');
  assert.equal(percentText(7), '100 percent');
  assert.equal(percentText(-1), '0 percent');
  assert.equal(percentText(NaN), '0 percent');
  assert.equal(percentText('x'), '0 percent');
});
