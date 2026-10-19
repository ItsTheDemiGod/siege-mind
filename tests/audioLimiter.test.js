import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceLimiter } from '../src/audio/limiter.js';

const spec = (id, o = {}) => ({ id, priority: 1, minIntervalMs: 0, maxVoices: 9, ...o });
/** request + register like the engine does; returns the request result */
function play(lim, s, now, voiceId, dur = 1000) {
  const r = lim.request(s, now);
  if (r.play) lim.register(voiceId, s, now, now + dur);
  return r;
}

test('the per-id minimum interval refuses a repeat inside the gap and allows it at the gap', () => {
  const lim = createVoiceLimiter({ maxVoices: 10 });
  const s = spec('a', { minIntervalMs: 50 });
  assert.equal(play(lim, s, 0, 1).play, true);
  assert.equal(play(lim, s, 49, 2).play, false);
  assert.equal(play(lim, s, 50, 3).play, true);
  assert.deepEqual(lim.stats(), { played: 2, droppedRate: 1, droppedVoices: 0, stolen: 0 });
});

test('the per-id voice cap counts only voices that are still sounding', () => {
  const lim = createVoiceLimiter({ maxVoices: 10 });
  const s = spec('a', { maxVoices: 2 });
  assert.equal(play(lim, s, 0, 1, 100).play, true);
  assert.equal(play(lim, s, 1, 2, 100).play, true);
  assert.equal(play(lim, s, 2, 3, 100).play, false);
  assert.equal(play(lim, s, 101, 4, 100).play, true); // voice 1 has ended
  assert.equal(lim.stats().droppedVoices, 1);
});

test('at the global cap a higher priority request steals the oldest lowest-priority voice; an equal or lower one is refused', () => {
  const lim = createVoiceLimiter({ maxVoices: 3 });
  play(lim, spec('low', { priority: 1 }), 0, 1);
  play(lim, spec('low2', { priority: 1 }), 1, 2);
  play(lim, spec('mid', { priority: 2 }), 2, 3);
  assert.equal(lim.activeCount(3), 3);
  assert.deepEqual(lim.request(spec('low3', { priority: 1 }), 4), { play: false, stealId: null });
  const hi = spec('hi', { priority: 2 });
  const r = lim.request(hi, 5);
  assert.deepEqual(r, { play: true, stealId: 1 }); // the oldest priority-1 voice
  assert.equal(lim.activeCount(5), 2);
  lim.register(4, hi, 5, 1005);
  assert.equal(lim.stats().stolen, 1);
  assert.deepEqual(lim.request(spec('mid2', { priority: 2 }), 6), { play: true, stealId: 2 }); // the remaining priority-1 voice
});

test('priority 3 is never refused for the global limit while a lower-priority voice exists', () => {
  const lim = createVoiceLimiter({ maxVoices: 4 });
  for (let i = 0; i < 4; i++) play(lim, spec(`p1-${i}`), i, i + 1);
  for (let k = 0; k < 4; k++) {
    const r = play(lim, spec(`crit-${k}`, { priority: 3 }), 10 + k, 100 + k);
    assert.equal(r.play, true, `critical ${k}`);
    assert.ok(r.stealId !== null);
  }
  assert.equal(lim.activeCount(20), 4);
  assert.equal(play(lim, spec('crit-x', { priority: 3 }), 21, 200).play, false); // only priority 3 voices left: nothing to steal
});

test('release frees capacity; stats and instances are independent and deterministic', () => {
  const run = () => {
    const lim = createVoiceLimiter({ maxVoices: 1 });
    play(lim, spec('a'), 0, 1);
    const blocked = play(lim, spec('b'), 1, 2);
    lim.release(1);
    const freed = play(lim, spec('b'), 2, 2);
    return { blocked: blocked.play, freed: freed.play, stats: lim.stats(), active: lim.activeCount(3) };
  };
  assert.deepEqual(run(), { blocked: false, freed: true, stats: { played: 2, droppedRate: 0, droppedVoices: 1, stolen: 0 }, active: 1 });
  assert.deepEqual(run(), run());
  const a = createVoiceLimiter({ maxVoices: 2 });
  const b = createVoiceLimiter({ maxVoices: 2 });
  play(a, spec('x', { minIntervalMs: 1000 }), 0, 1);
  assert.equal(play(b, spec('x', { minIntervalMs: 1000 }), 1, 1).play, true);
  assert.equal(b.activeCount(2), 1);
});
