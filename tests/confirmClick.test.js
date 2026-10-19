import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConfirmClick } from '../src/ui/confirmClick.js';

test('first click arms, a second click inside the window confirms', () => {
  const c = createConfirmClick(3);
  assert.equal(c.armed(0), false);
  assert.equal(c.click(10), 'arm');
  assert.equal(c.armed(11), true);
  assert.equal(c.click(12.5), 'confirm');
  assert.equal(c.armed(12.6), false);
});

test('a click after the window re-arms instead of confirming', () => {
  const c = createConfirmClick(3);
  c.click(0);
  assert.equal(c.armed(3.01), false);
  assert.equal(c.click(3.5), 'arm');
  assert.equal(c.click(4), 'confirm');
});

test('the window edge is inclusive and reset disarms', () => {
  const c = createConfirmClick(3);
  c.click(0);
  assert.equal(c.armed(3), true);
  c.reset();
  assert.equal(c.armed(1), false);
  assert.equal(c.click(1), 'arm');
});

test('after a confirm the next click arms again', () => {
  const c = createConfirmClick(2);
  c.click(0); c.click(1);
  assert.equal(c.click(1.5), 'arm');
});
