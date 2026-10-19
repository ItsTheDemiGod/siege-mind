import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecisionLog } from '../src/ui/decisionLog.js';

const dec = (wave, extra = {}) => ({ wave, mode: 'adaptive', tilt: { armoredGrunt: 1.2 }, lines: ['a'], ...extra });

test('push stores independent deep copies', () => {
  const log = createDecisionLog();
  const d = dec(5);
  assert.equal(log.push(d), true);
  d.tilt.armoredGrunt = 9;
  d.lines.push('b');
  assert.deepEqual(log.latest(), dec(5));
  const out = log.latest();
  out.tilt.armoredGrunt = 7;
  assert.equal(log.latest().tilt.armoredGrunt, 1.2);
  const all = log.entries();
  all[0].wave = 99;
  assert.equal(log.entries()[0].wave, 5);
});

test('null and non-plain input are ignored', () => {
  const log = createDecisionLog();
  for (const bad of [null, undefined, 5, 'x', [], new Map(), { f: () => 1 }, { n: NaN }]) assert.equal(log.push(bad), false, String(bad));
  assert.equal(log.size, 0);
  assert.equal(log.latest(), null);
});

test('order, limit, clear and JSON round trip', () => {
  const log = createDecisionLog(3);
  for (let w = 1; w <= 5; w++) log.push(dec(w));
  assert.equal(log.size, 3);
  assert.deepEqual(log.entries().map((e) => e.wave), [3, 4, 5]);
  assert.equal(log.latest().wave, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(log.entries())), log.entries());
  log.clear();
  assert.equal(log.size, 0);
  assert.deepEqual(log.entries(), []);
});
