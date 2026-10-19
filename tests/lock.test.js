import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideHeldoutRun } from '../experiments/lock.js';
import { protocolHash } from '../experiments/protocol.js';

const NOW = '2026-10-19T12:00:00.000Z';
const identity = { codeHash: 'c0de', gitCommit: 'abc123', gitDirty: false };
const ok = { final: true, yes: true, newLock: false, allowDirty: false };
const decide = (over = {}) => decideHeldoutRun({ existingLock: null, args: ok, identity, now: NOW, ...over });
const refused = (over, re) => { const d = decide(over); assert.equal(d.allowed, false); assert.equal(d.nextLock, null); assert.match(d.reason, re); };

test('every refusal reason', () => {
  refused({ args: { ...ok, final: false } }, /--final/);
  refused({ args: { ...ok, yes: false } }, /--yes/);
  refused({ args: { ...ok, final: false, yes: false } }, /--final/);
  refused({ identity: { ...identity, gitDirty: true } }, /uncommitted changes/);
  refused({ identity: { ...identity, gitCommit: 'unknown' } }, /commit is unknown/);
  refused({ existingLock: { runIndex: 1, previous: [] } }, /already run.*--new-lock/);
  refused({ existingLock: { runIndex: 2, previous: [{}] } }, /run 3/);
});

test('the first lock', () => {
  const d = decide();
  assert.equal(d.allowed, true);
  assert.deepEqual(d.nextLock, { runIndex: 1, createdAt: NOW, gitCommit: 'abc123', gitDirty: false, codeHash: 'c0de', protocolHash: protocolHash(), previous: [] });
});

test('a new lock after an existing one keeps an audit trail without nesting', () => {
  const first = decide().nextLock;
  const second = decide({ existingLock: first, args: { ...ok, newLock: true }, identity: { ...identity, gitCommit: 'def456' }, now: '2026-11-01T00:00:00.000Z' });
  assert.equal(second.allowed, true);
  assert.equal(second.nextLock.runIndex, 2);
  assert.equal(second.nextLock.gitCommit, 'def456');
  assert.equal(second.nextLock.previous.length, 1);
  const { previous: _p, ...firstWithoutPrevious } = first;
  assert.deepEqual(second.nextLock.previous[0], firstWithoutPrevious);
  assert.ok(!('previous' in second.nextLock.previous[0]));
  const third = decide({ existingLock: second.nextLock, args: { ...ok, newLock: true }, now: '2026-12-01T00:00:00.000Z' });
  assert.equal(third.nextLock.runIndex, 3);
  assert.equal(third.nextLock.previous.length, 2);
  assert.deepEqual(third.nextLock.previous.map((p) => p.runIndex), [1, 2]);
  assert.match(third.reason, /run 3/);
});

test('inputs are not mutated, allowDirty records the dirty state, hashes are copied', () => {
  const existing = decide().nextLock;
  const snapshot = JSON.stringify({ existing, ok, identity });
  decide({ existingLock: existing, args: { ...ok, newLock: true } });
  decide({ existingLock: existing });
  assert.equal(JSON.stringify({ existing, ok, identity }), snapshot);
  const dirty = decide({ identity: { ...identity, gitDirty: true }, args: { ...ok, allowDirty: true } });
  assert.equal(dirty.allowed, true);
  assert.equal(dirty.nextLock.gitDirty, true);
  assert.equal(dirty.nextLock.codeHash, 'c0de');
  assert.equal(dirty.nextLock.protocolHash, protocolHash());
  assert.equal(dirty.nextLock.createdAt, NOW);
});

test('validation lock: same refusals with their own wording, kind recorded, held-out lock unchanged', () => {
  const v = (over = {}) => decideHeldoutRun({ existingLock: null, args: ok, identity, now: NOW, kind: 'validation', ...over });
  for (const [over, re] of [[{ args: { ...ok, final: false } }, /validation seeds.*--final/], [{ args: { ...ok, yes: false } }, /validation seeds.*--yes/], [{ identity: { ...identity, gitDirty: true } }, /uncommitted changes/],
    [{ identity: { ...identity, gitCommit: 'unknown' } }, /commit is unknown/], [{ existingLock: { runIndex: 1, previous: [] } }, /validation seeds was already run.*--new-lock/]]) {
    const d = v(over);
    assert.equal(d.allowed, false);
    assert.match(d.reason, re);
  }
  const first = v();
  assert.equal(first.allowed, true);
  assert.equal(first.nextLock.kind, 'validation');
  assert.match(first.reason, /validation run/);
  assert.equal(v({ existingLock: first.nextLock, args: { ...ok, newLock: true } }).nextLock.previous[0].kind, 'validation');
  assert.ok(!('kind' in decide().nextLock), 'the held-out lock has no kind field (unchanged)');
  assert.throws(() => v({ kind: 'nope' }), RangeError);
});
