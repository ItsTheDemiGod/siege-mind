import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runUnit, unitsFor, runExperiment, writeResults, identityOf } from '../experiments/runExperiment.js';
import { parseExperimentArgs } from '../experiments/runExperimentCli.js';
import { METRIC_COLUMNS } from '../experiments/metrics.js';
import { PROTOCOL, seedsOf, protocolHash } from '../experiments/protocol.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'siege-exp-'));

test('runUnit returns a well-formed row for each mode', () => {
  for (const mode of PROTOCOL.modes) {
    const row = runUnit({ style: 'noLance', mode, seed: 1001 });
    assert.deepEqual(Object.keys(row), [...METRIC_COLUMNS, 'livesLostByWave', 'tiltByWave']); // extended in 9A-2a: tiltByWave is a JSON-only field
    assert.deepEqual([row.style, row.mode, row.seed], ['noLance', mode, 1001]);
    assert.ok(['won', 'lost'].includes(row.result));
    assert.equal(row.livesLostByWave.length, PROTOCOL.waves);
    assert.ok(Number.isInteger(row.livesLost) && row.livesLost >= 0 && row.livesLost <= PROTOCOL.startLives);
    if (mode === 'static') assert.equal(row.tiltAligned, null);
    else assert.ok([0, 1].includes(row.tiltAligned));
  }
  assert.equal(runUnit({ style: 'balancedR', mode: 'adaptive', seed: 1001 }).tiltAligned, null);
});

test('identical calls give deep-equal rows', () => {
  for (const mode of PROTOCOL.modes) assert.deepEqual(runUnit({ style: 'noSniper', mode, seed: 1002 }), runUnit({ style: 'noSniper', mode, seed: 1002 }));
});

test('unitsFor: counts, stable order and subsets', () => {
  const tuning = unitsFor({ set: 'tuning' });
  assert.equal(tuning.length, 30 * PROTOCOL.styles.length * 3);
  assert.equal(unitsFor({ set: 'heldout' }).length, 60 * PROTOCOL.styles.length * 3);
  assert.equal(unitsFor({ set: 'calibration', modes: ['static'] }).length, 10 * PROTOCOL.styles.length);
  assert.equal(unitsFor({ set: 'tuning', styles: ['noLance'], modes: ['static', 'adaptive'] }).length, 60);
  assert.deepEqual(tuning.slice(0, 4).map((u) => `${u.seed}/${u.style}/${u.mode}`), ['1001/balancedR/static', '1001/balancedR/adaptive', '1001/balancedR/random', '1001/noLance/static']);
  assert.deepEqual(tuning.at(-1), { style: 'noSniper', mode: 'random', seed: 1030, waves: 15 });
  assert.deepEqual(unitsFor({ set: 'tuning' }), tuning);
  assert.equal(new Set(tuning.map((u) => `${u.seed}/${u.style}/${u.mode}`)).size, tuning.length);
  assert.deepEqual([...new Set(tuning.map((u) => u.seed))], seedsOf('tuning'));
  assert.throws(() => unitsFor({ set: 'nope' }), RangeError);
});

test('runExperiment returns one row per unit, in order, and reports progress', () => {
  const units = unitsFor({ set: 'calibration', styles: ['noLance'], modes: ['static'] }).slice(0, 3);
  const seen = [];
  const rows = runExperiment({ units, onProgress: (d, t) => seen.push([d, t]) });
  assert.deepEqual(rows.map((r) => r.seed), units.map((u) => u.seed));
  assert.deepEqual(seen, [[1, 3], [2, 3], [3, 3]]);
});

test('a timed-out or invalid unit is an Error that names the unit', () => {
  assert.throws(() => runUnit({ style: 'noLance', mode: 'static', seed: 7, playGameFn: () => ({ result: 'timeout' }) }), /unit noLance\/static\/seed 7 timed out/);
  assert.throws(() => runUnit({ style: 'noLance', mode: 'random', seed: 8, playGameFn: () => ({ result: 'won', run: {} }) }), /unit noLance\/random\/seed 8 produced an invalid run/);
});

test('writeResults writes both files with the expected columns, no timestamps and identical bytes on a second write', () => {
  const rows = runExperiment({ units: unitsFor({ set: 'calibration', styles: ['noMortar', 'noSniper'], modes: ['static', 'adaptive'] }).slice(0, 4) });
  const identity = { codeHash: 'abc', gitCommit: 'deadbeef', gitDirty: false, nodeVersion: 'v0' };
  const d1 = tmp();
  const d2 = tmp();
  try {
    const args = { rows, identity, set: 'calibration', waves: 15, knobs: PROTOCOL.botKnobs };
    const p1 = writeResults({ dir: d1, base: 'x', ...args });
    const p2 = writeResults({ dir: join(d2, 'nested'), base: 'x', ...args });
    const [j1, c1] = [readFileSync(p1.json, 'utf8'), readFileSync(p1.csv, 'utf8')];
    assert.equal(j1, readFileSync(p2.json, 'utf8'));
    assert.equal(c1, readFileSync(p2.csv, 'utf8'));
    const parsed = JSON.parse(j1);
    assert.deepEqual(Object.keys(parsed).slice(0, 9), ['protocolVersion', 'protocolHash', 'codeHash', 'gitCommit', 'gitDirty', 'nodeVersion', 'set', 'waves', 'knobs']);
    assert.equal(parsed.protocolHash, protocolHash());
    assert.equal(parsed.rows.length, rows.length);
    assert.deepEqual(parsed.rows, JSON.parse(JSON.stringify(rows)));
    const lines = c1.split('\n');
    assert.equal(lines[0], METRIC_COLUMNS.join(','));
    assert.equal(lines.length, rows.length + 2);
    assert.equal(lines.at(-1), '');
    assert.ok(!c1.includes('\r') && !j1.includes('\r'));
    for (const text of [j1, c1]) assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(text) && !/createdAt|timestamp/i.test(text));
  } finally { rmSync(d1, { recursive: true, force: true }); rmSync(d2, { recursive: true, force: true }); }
});

test('identityOf: clean, dirty and missing git', () => {
  const root = tmp();
  try {
    for (const f of ['src/sim/a.js', 'src/data/b.js', 'experiments/styleBots.js']) { mkdirSync(join(root, f, '..'), { recursive: true }); writeFileSync(join(root, f), `// ${f}\n`); }
    const clean = identityOf({ root, exec: (args) => (args[0] === 'rev-parse' ? 'abc123\n' : '') });
    assert.deepEqual([clean.gitCommit, clean.gitDirty], ['abc123', false]);
    assert.equal(clean.nodeVersion, process.version);
    const dirty = identityOf({ root, exec: (args) => (args[0] === 'rev-parse' ? 'abc123\n' : ' M file.js\n') });
    assert.equal(dirty.gitDirty, true);
    const missing = identityOf({ root, exec: () => { throw new Error('git not found'); } });
    assert.deepEqual([missing.gitCommit, missing.gitDirty], ['unknown', false]);
    assert.equal(clean.codeHash, dirty.codeHash);
    assert.match(clean.codeHash, /^[0-9a-f]{64}$/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('codeHash is stable, ignores CRLF, and changes when a hashed file changes', () => {
  const root = tmp();
  const exec = () => 'x\n';
  try {
    for (const f of ['src/sim/a.js', 'src/data/b.js', 'experiments/metrics.js']) { mkdirSync(join(root, f, '..'), { recursive: true }); writeFileSync(join(root, f), 'line1\nline2\n'); }
    const h1 = identityOf({ root, exec }).codeHash;
    assert.equal(identityOf({ root, exec }).codeHash, h1);
    writeFileSync(join(root, 'src/sim/a.js'), 'line1\r\nline2\r\n');
    assert.equal(identityOf({ root, exec }).codeHash, h1, 'CRLF is normalized');
    writeFileSync(join(root, 'src/sim/a.js'), 'line1\nline2 changed\n');
    assert.notEqual(identityOf({ root, exec }).codeHash, h1);
    writeFileSync(join(root, 'src/sim/a.js'), 'line1\nline2\n');
    writeFileSync(join(root, 'src/data/new.js'), 'x\n');
    assert.notEqual(identityOf({ root, exec }).codeHash, h1, 'a new file counts');
    writeFileSync(join(root, 'docs.txt'), 'not hashed');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('parseExperimentArgs: defaults, every flag and every rejection', () => {
  const d = parseExperimentArgs(['--set=tuning']);
  assert.deepEqual(d, { set: 'tuning', waves: 15, styles: [...PROTOCOL.styles], modes: [...PROTOCOL.modes], out: 'docs/results', base: 'tuning', final: false, yes: false, newLock: false, allowDirty: false });
  assert.equal(parseExperimentArgs(['--set=tuning', '--waves=30']).base, 'tuning-w30');
  const all = parseExperimentArgs(['--set=calibration', '--styles=noLance,balancedR', '--modes=static', '--out=tmp', '--base=b', '--final', '--yes', '--new-lock', '--allow-dirty']);
  assert.deepEqual([all.styles, all.modes, all.out, all.base, all.final, all.yes, all.newLock, all.allowDirty], [['noLance', 'balancedR'], ['static'], 'tmp', 'b', true, true, true, true]);
  const held = parseExperimentArgs(['--set=heldout', '--final', '--yes']);
  assert.deepEqual([held.base, held.final, held.yes, held.styles.length, held.modes.length], ['heldout', true, true, PROTOCOL.styles.length, 3]);
  assert.equal(parseExperimentArgs(['--set=heldout', '--waves=30']).base, 'heldout-w30');
  assert.throws(() => parseExperimentArgs([]), /--set is required/);
  assert.throws(() => parseExperimentArgs(['--set=nope']), RangeError);
  assert.throws(() => parseExperimentArgs(['--set=tuning', '--waves=20']), /--waves must be one of/);
  assert.throws(() => parseExperimentArgs(['--set=tuning', '--styles=noLance,x']), /unknown style: x/);
  assert.throws(() => parseExperimentArgs(['--set=tuning', '--modes=hard']), /unknown mode: hard/);
  assert.throws(() => parseExperimentArgs(['--set=tuning', '--bogus']), /unknown argument/);
  assert.throws(() => parseExperimentArgs(['--set=tuning', '--nope=1']), /unknown argument/);
  assert.throws(() => parseExperimentArgs(['--set=tuning', '--out=']), /needs a value/);
  assert.throws(() => parseExperimentArgs(['--set=heldout', '--styles=noLance']), /not allowed/);
  assert.throws(() => parseExperimentArgs(['--set=heldout', '--modes=static']), /not allowed/);
});

test('parseExperimentArgs: --split only for the tuning set, validated, and a split never takes the default full-set file name', () => {
  assert.equal(parseExperimentArgs(['--set=tuning']).split, undefined);
  assert.deepEqual([parseExperimentArgs(['--set=tuning', '--split=train']).split, parseExperimentArgs(['--set=tuning', '--split=train']).base], ['train', 'tuning-train']);
  assert.equal(parseExperimentArgs(['--set=tuning', '--split=validation', '--base=x']).base, 'x');
  assert.equal(parseExperimentArgs(['--set=tuning', '--split=all']).base, 'tuning');
  assert.throws(() => parseExperimentArgs(['--set=heldout', '--split=train']), /only allowed with --set=tuning/);
  assert.throws(() => parseExperimentArgs(['--set=calibration', '--split=train']), /only allowed with --set=tuning/);
  assert.throws(() => parseExperimentArgs(['--set=tuning', '--split=nope']), RangeError);
});

test('unitsFor takes an explicit seed list (a split) and keeps the stable order', () => {
  const u = unitsFor({ set: 'tuning', seeds: [1001, 1002], styles: ['balancedR'], modes: ['static', 'random'] });
  assert.deepEqual(u.map((x) => `${x.seed}/${x.mode}`), ['1001/static', '1001/random', '1002/static', '1002/random']);
});

test('9A-2a: the research arms are allowed for the tuning set only; defaults stay the protocol modes', async () => {
  const { ALL_MODES, EXTRA_MODES, PROTOCOL_MODES, modesAllowedFor } = await import('../experiments/modes.js');
  assert.deepEqual([...PROTOCOL_MODES], [...PROTOCOL.modes]);
  assert.deepEqual([...EXTRA_MODES], ['adaptive2', 'counter']);
  assert.deepEqual([...ALL_MODES], ['static', 'adaptive', 'random', 'adaptive2', 'counter']);
  assert.deepEqual([...modesAllowedFor('heldout')], [...PROTOCOL.modes]);
  assert.deepEqual(parseExperimentArgs(['--set=tuning', '--modes=static,adaptive2,counter']).modes, ['static', 'adaptive2', 'counter']);
  assert.deepEqual(parseExperimentArgs(['--set=tuning']).modes, [...PROTOCOL.modes]);
  assert.throws(() => parseExperimentArgs(['--modes=adaptive2', '--set=calibration']), /unknown mode: adaptive2/);
  assert.throws(() => parseExperimentArgs(['--set=heldout', '--modes=counter']), /not allowed|unknown mode/);
  assert.equal(unitsFor({ set: 'tuning', seeds: [1001], styles: ['balancedR'], modes: ALL_MODES }).length, 5);
  assert.throws(() => unitsFor({ set: 'heldout', modes: ['adaptive2'] }), RangeError);
  assert.throws(() => unitsFor({ set: 'calibration', modes: ['counter'] }), RangeError);
});
