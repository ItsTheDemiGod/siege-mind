import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PROTOCOL, protocolHash } from '../experiments/protocol.js';
import { parseConfirmArgs, checkConfirmInputs, main } from '../experiments/confirmCli.js';
import { heldoutPlan, formatPlan, HELDOUT_COMMANDS } from '../experiments/heldoutPlan.js';

const current = { version: PROTOCOL.version, hash: protocolHash() };
const goodFile = { set: 'heldout', protocolVersion: PROTOCOL.version, protocolHash: protocolHash(), runIndex: 1 };

test('parseConfirmArgs', () => {
  assert.deepEqual(parseConfirmArgs(['--in=a.json', '--out=b']), { in: 'a.json', out: 'b', dryRun: false });
  assert.deepEqual(parseConfirmArgs(['--in=a.json', '--out=b-dryrun', '--dry-run']), { in: 'a.json', out: 'b-dryrun', dryRun: true });
  assert.throws(() => parseConfirmArgs(['--out=b']), /--in/);
  assert.throws(() => parseConfirmArgs(['--in=a']), /--out/);
  assert.throws(() => parseConfirmArgs(['--in=a', '--out=b', '--bogus']), /unknown argument/);
});

test('checkConfirmInputs: the confirmatory run needs held-out rows of the current protocol with a run index', () => {
  const args = { out: 'docs/results/heldout-confirmatory', dryRun: false };
  assert.deepEqual(checkConfirmInputs(goodFile, args, current), { ok: true, label: 'CONFIRMATORY', message: 'held-out data evaluated 1 time(s) (run index 1)' });
  assert.equal(checkConfirmInputs({ ...goodFile, runIndex: 2 }, args, current).message, 'held-out data evaluated 2 time(s) (run index 2)');
  for (const [file, re] of [[{ ...goodFile, set: 'tuning' }, /not from the held-out set/], [{ ...goodFile, protocolVersion: 3 }, /protocol version 3/], [{ ...goodFile, protocolHash: 'x' }, /hash mismatch/],
    [{ ...goodFile, runIndex: undefined }, /no lock run index/], [{ ...goodFile, runIndex: 0 }, /no lock run index/], [{ ...goodFile, runIndex: '1' }, /no lock run index/]]) {
    const c = checkConfirmInputs(file, args, current);
    assert.equal(c.ok, false);
    assert.match(c.message, re);
  }
  assert.equal(checkConfirmInputs(goodFile, { out: 'docs/results/heldout-dryrun', dryRun: false }, current).ok, false, 'a confirmatory output must not be named dryrun');
});

test('checkConfirmInputs: a dry run skips the set and hash checks but must be named dryrun', () => {
  const ok = checkConfirmInputs({ set: 'tuning', protocolHash: 'old' }, { out: 'docs/results/confirm-dryrun-train', dryRun: true }, current);
  assert.deepEqual([ok.ok, ok.label], [true, 'EXPLORATORY DRY RUN']);
  assert.match(ok.message, /set tuning/);
  const bad = checkConfirmInputs(goodFile, { out: 'docs/results/confirm-train', dryRun: true }, current);
  assert.equal(bad.ok, false);
  assert.match(bad.message, /dryrun/);
  assert.equal(checkConfirmInputs(goodFile, { out: 'X-DryRun', dryRun: true }, current).ok, true, 'case-insensitive');
});

function fakeRows() { // a complete set of the six modes x five styles x two seeds is enough for the CLI plumbing
  const rows = [];
  for (const seed of [1, 2]) for (const style of PROTOCOL.styles) for (const mode of PROTOCOL.confirmatory.modes) {
    rows.push({ style, mode, seed, livesLost: seed + style.length, won: 1, finalWave: 15, leakFraction: 0.1, penetration: 0.5, tiltByWave: Array(15).fill(null) });
  }
  return rows;
}

test('main: refusals write nothing, a dry run writes json and md into a temp directory and is byte-identical on a second run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'siege-confirm-'));
  try {
    const log = [];
    const err = [];
    const io = { log: (m) => log.push(m), error: (m) => err.push(m) };
    const inFile = join(dir, 'rows.json');
    writeFileSync(inFile, JSON.stringify({ ...goodFile, set: 'tuning', rows: fakeRows() }));
    // not held-out data without --dry-run
    assert.equal(main([`--in=${inFile}`, `--out=${join(dir, 'out')}`], io), 1);
    assert.match(err.at(-1), /not from the held-out set/);
    assert.equal(existsSync(join(dir, 'out.json')), false);
    // dry run naming rule
    assert.equal(main([`--in=${inFile}`, `--out=${join(dir, 'out')}`, '--dry-run'], io), 1);
    assert.match(err.at(-1), /dryrun/);
    assert.equal(existsSync(join(dir, 'out.json')), false);
    // missing file, invalid JSON, no rows, bad arguments
    assert.equal(main([`--in=${join(dir, 'nope.json')}`, `--out=${join(dir, 'x-dryrun')}`, '--dry-run'], io), 1);
    writeFileSync(join(dir, 'bad.json'), '{not json');
    assert.equal(main([`--in=${join(dir, 'bad.json')}`, `--out=${join(dir, 'x-dryrun')}`, '--dry-run'], io), 1);
    writeFileSync(join(dir, 'norows.json'), '{"a":1}');
    assert.equal(main([`--in=${join(dir, 'norows.json')}`, `--out=${join(dir, 'x-dryrun')}`, '--dry-run'], io), 1);
    assert.equal(main(['--bogus'], io), 2);
    // incomplete data: refuses and writes nothing
    writeFileSync(join(dir, 'inc.json'), JSON.stringify({ ...goodFile, rows: fakeRows().slice(1) }));
    assert.equal(main([`--in=${join(dir, 'inc.json')}`, `--out=${join(dir, 'inc-dryrun')}`, '--dry-run'], io), 1);
    assert.equal(existsSync(join(dir, 'inc-dryrun.json')), false);
    // a dry run on complete data
    assert.equal(main([`--in=${inFile}`, `--out=${join(dir, 'ok-dryrun')}`, '--dry-run'], io), 0);
    const first = [readFileSync(join(dir, 'ok-dryrun.json'), 'utf8'), readFileSync(join(dir, 'ok-dryrun.md'), 'utf8')];
    assert.match(first[1], /^# EXPLORATORY DRY RUN ON TRAINING DATA: NOT CONFIRMATORY/);
    assert.equal(JSON.parse(first[0]).label, 'EXPLORATORY DRY RUN');
    assert.equal(main([`--in=${inFile}`, `--out=${join(dir, 'ok-dryrun')}`, '--dry-run'], io), 0);
    assert.deepEqual([readFileSync(join(dir, 'ok-dryrun.json'), 'utf8'), readFileSync(join(dir, 'ok-dryrun.md'), 'utf8')], first);
    // a confirmatory run on held-out rows prints the run index
    writeFileSync(join(dir, 'held.json'), JSON.stringify({ ...goodFile, runIndex: 1, rows: fakeRows() }));
    assert.equal(main([`--in=${join(dir, 'held.json')}`, `--out=${join(dir, 'held-confirmatory')}`], io), 0);
    assert.ok(log.some((l) => l === 'held-out data evaluated 1 time(s) (run index 1)'));
    assert.match(readFileSync(join(dir, 'held-confirmatory.md'), 'utf8'), /^# CONFIRMATORY ANALYSIS OF THE HELD-OUT RUN/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('heldoutPlan: counts for the real protocol, the exact commands and determinism', () => {
  const p = heldoutPlan();
  assert.deepEqual([p.seeds, p.firstSeed, p.lastSeed, p.styles.length, p.modes.length, p.units, p.unitsPerMode], [150, 2001, 2150, 5, 6, 4500, 750]);
  assert.deepEqual(p.modes, ['static', 'random', 'prior', 'adaptive', 'adaptive2', 'counter']);
  assert.deepEqual([p.protocolVersion, p.protocolHash], [4, protocolHash()]);
  assert.deepEqual(p.commands, ['git status', 'npm run experiment -- --set=heldout --final --yes', 'npm run confirm -- --in=docs/results/heldout.rows.json --out=docs/results/heldout-confirmatory']);
  assert.deepEqual(heldoutPlan(), p);
  assert.ok(Object.isFrozen(HELDOUT_COMMANDS));
  const text = formatPlan(p);
  assert.ok(text.includes('4500 games, 750 per mode') && text.includes('(must be clean)') && text.includes('seeds 2001-2150'));
});
