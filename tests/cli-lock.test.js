// Regression tests for the seed locks of the experiment CLI. Every dependency is a stub: no game is ever played and no lock file is ever touched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../experiments/runExperimentCli.js';

const IDENTITY = { codeHash: 'c0de', gitCommit: 'abc123', gitDirty: false };

function stubs({ identity = IDENTITY, lock = null } = {}) {
  const calls = [];
  const logs = [];
  const errors = [];
  const written = [];
  const deps = {
    identityOf: () => identity,
    readLock: (kind) => { calls.push(`readLock:${kind}`); return lock; },
    writeLock: (kind, l) => { calls.push(`writeLock:${kind}`); written.push({ kind, lock: l }); },
    unitsFor: () => { calls.push('unitsFor'); return [{ style: 'balancedR', mode: 'static', seed: 1, waves: 15 }]; },
    runExperiment: () => { calls.push('runExperiment'); return [{ style: 'balancedR', mode: 'static', seed: 1 }]; },
    writeResults: () => { calls.push('writeResults'); return { json: 'x.json', csv: 'x.csv' }; },
    now: () => '2026-10-19T12:00:00.000Z', clock: () => 0, log: (m) => logs.push(m), error: (m) => errors.push(m),
  };
  return { deps, calls, logs, errors, written };
}
const count = (calls, name) => calls.filter((c) => c === name).length;

test('(i) --set=heldout without --final refuses and plays zero games', async () => {
  const s = stubs();
  assert.equal(await main(['--set=heldout'], s.deps), 1);
  assert.equal(count(s.calls, 'runExperiment'), 0);
  assert.equal(count(s.calls, 'writeLock:heldout'), 0);
  assert.match(s.errors[0], /refused: .*--final/);
  const half = stubs();
  assert.equal(await main(['--set=heldout', '--final'], half.deps), 1);
  assert.equal(count(half.calls, 'runExperiment'), 0);
  assert.match(half.errors[0], /--yes/);
});

test('(ii) --set=tuning --split=validation without --final/--yes refuses with zero calls to the runner', async () => {
  for (const extra of [[], ['--final'], ['--yes']]) {
    const s = stubs();
    assert.equal(await main(['--set=tuning', '--split=validation', ...extra], s.deps), 1, extra.join(' '));
    assert.equal(count(s.calls, 'runExperiment'), 0);
    assert.equal(count(s.calls, 'writeResults'), 0);
    assert.equal(s.written.length, 0);
    assert.match(s.errors[0], /validation seeds/);
  }
});

test('(iii) with --final --yes, a clean tree and no lock, the lock is written BEFORE the runner and the runner is called once; the kind is recorded', async () => {
  for (const [args, kind] of [[['--set=tuning', '--split=validation', '--final', '--yes'], 'validation'], [['--set=heldout', '--final', '--yes'], 'heldout']]) {
    const s = stubs();
    assert.equal(await main(args, s.deps), 0);
    assert.equal(count(s.calls, 'runExperiment'), 1);
    assert.ok(s.calls.indexOf(`writeLock:${kind}`) !== -1 && s.calls.indexOf(`writeLock:${kind}`) < s.calls.indexOf('runExperiment'), s.calls.join(','));
    assert.ok(s.calls.indexOf(`writeLock:${kind}`) < s.calls.indexOf('unitsFor'));
    assert.equal(s.written.length, 1);
    assert.equal(s.written[0].kind, kind);
    assert.equal(s.written[0].lock.runIndex, 1);
    if (kind === 'validation') assert.equal(s.written[0].lock.kind, 'validation');
  }
});

test('(iv) an existing lock without --new-lock refuses; with --new-lock the run index grows', async () => {
  const s = stubs({ lock: { runIndex: 1, previous: [] } });
  assert.equal(await main(['--set=heldout', '--final', '--yes'], s.deps), 1);
  assert.equal(count(s.calls, 'runExperiment'), 0);
  assert.equal(s.written.length, 0);
  assert.match(s.errors[0], /already run/);
  const again = stubs({ lock: { runIndex: 1, previous: [] } });
  assert.equal(await main(['--set=heldout', '--final', '--yes', '--new-lock'], again.deps), 0);
  assert.equal(again.written[0].lock.runIndex, 2);
});

test('(v) a dirty tree refuses without --allow-dirty and is recorded with it', async () => {
  const dirty = { ...IDENTITY, gitDirty: true };
  const s = stubs({ identity: dirty });
  assert.equal(await main(['--set=tuning', '--split=validation', '--final', '--yes'], s.deps), 1);
  assert.equal(count(s.calls, 'runExperiment'), 0);
  assert.match(s.errors[0], /uncommitted changes/);
  const ok = stubs({ identity: dirty });
  assert.equal(await main(['--set=tuning', '--split=validation', '--final', '--yes', '--allow-dirty'], ok.deps), 0);
  assert.equal(ok.written[0].lock.gitDirty, true);
});

test('(vi) --set=tuning with --split=train or no split needs no lock and never touches the lock functions', async () => {
  for (const args of [['--set=tuning'], ['--set=tuning', '--split=train'], ['--set=tuning', '--split=all'], ['--set=calibration']]) {
    const s = stubs();
    assert.equal(await main(args, s.deps), 0, args.join(' '));
    assert.equal(count(s.calls, 'runExperiment'), 1);
    assert.ok(!s.calls.some((c) => c.startsWith('readLock') || c.startsWith('writeLock')), `${args.join(' ')}: ${s.calls.join(',')}`);
  }
});

test('(vii) the research arms are refused for the held-out set (and unknown arguments never reach the runner)', async () => {
  for (const mode of ['adaptive2', 'counter', 'prior']) {
    const s = stubs();
    assert.equal(await main(['--set=heldout', `--modes=${mode}`, '--final', '--yes'], s.deps), 2, mode);
    assert.equal(count(s.calls, 'runExperiment'), 0);
    assert.equal(s.written.length, 0);
    assert.ok(!s.calls.some((c) => c.startsWith('readLock')), 'refused before the lock is even read');
  }
  const bad = stubs();
  assert.equal(await main(['--set=tuning', '--split=nope'], bad.deps), 2);
  assert.equal(count(bad.calls, 'runExperiment'), 0);
});
