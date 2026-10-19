import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFiguresV4Args, DEFAULTS, main, buildAll } from '../experiments/figuresV4Cli.js';
import { FIGURES_V4 } from '../experiments/figuresV4/figures.js';
import { analyzeConfirmatory } from '../experiments/confirmatory.js';
import { syntheticRows, FAST_PROTOCOL } from './figuresV4Fixtures.js';

test('parseFiguresV4Args has the documented defaults, overrides them and rejects unknown arguments', () => {
  assert.deepEqual(parseFiguresV4Args([]), DEFAULTS);
  assert.deepEqual(DEFAULTS, { heldout: 'docs/results/heldout-confirmatory.json', training: 'docs/results/confirm-dryrun-train.json', rows: 'docs/results/heldout.rows.json', out: 'docs/results/figures-final' });
  assert.equal(parseFiguresV4Args(['--out=x/y', '--rows=r.json']).out, 'x/y');
  assert.equal(parseFiguresV4Args(['--rows=r.json']).rows, 'r.json');
  assert.throws(() => parseFiguresV4Args(['--bogus=1']), /unknown argument/);
  assert.throws(() => parseFiguresV4Args(['--out']), /unknown argument/);
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'figv4-'));
  const rows = syntheticRows({ seeds: 8 });
  const heldout = analyzeConfirmatory(rows, { protocol: FAST_PROTOCOL, label: 'CONFIRMATORY' });
  const training = analyzeConfirmatory(rows, { protocol: FAST_PROTOCOL, label: 'EXPLORATORY DRY RUN' });
  const write = (name, o) => { const p = join(dir, name); writeFileSync(p, JSON.stringify(o)); return p; };
  const rowsFile = { protocolVersion: 4, protocolHash: heldout.protocolHash, codeHash: 'code', gitCommit: 'abc', set: 'heldout', runIndex: 1, rows };
  return { dir, heldout, training, rowsFile, paths: { heldout: write('h.json', heldout), training: write('t.json', training), rows: write('r.json', rowsFile) } };
}

function quiet(fn) {
  const [log, err] = [console.log, console.error];
  const msgs = [];
  console.log = (m) => msgs.push(String(m));
  console.error = (m) => msgs.push(String(m));
  try { return { code: fn(), msgs }; } finally { console.log = log; console.error = err; }
}

test('the CLI writes the six figures and an index that references every figure, byte-identical on a second run', () => {
  const s = setup();
  try {
    const out = join(s.dir, 'out');
    const args = [`--heldout=${s.paths.heldout}`, `--training=${s.paths.training}`, `--rows=${s.paths.rows}`, `--out=${out}`];
    assert.equal(quiet(() => main(args)).code, 0);
    const names = readdirSync(out).sort();
    assert.deepEqual(names, [...FIGURES_V4.map((f) => f.file), 'index.html'].sort());
    const first = Object.fromEntries(names.map((n) => [n, readFileSync(join(out, n), 'utf8')]));
    const index = first['index.html'];
    for (const f of FIGURES_V4) assert.ok(index.includes(`<title id="fig-title">`) && first[f.file].startsWith('<svg'), f.file);
    assert.equal(index.split('<svg ').length - 1, 6);
    assert.ok(index.includes('protocol hash') && index.includes('lock run index 1') && index.includes('held-out git commit abc'));
    assert.ok(!/<script/i.test(index));
    assert.equal(quiet(() => main(args)).code, 0);
    for (const n of names) assert.equal(readFileSync(join(out, n), 'utf8'), first[n], `${n} changed on a second run`);
  } finally { rmSync(s.dir, { recursive: true, force: true }); }
});

test('the CLI refuses missing inputs, a training file passed as --heldout and mismatched rows, and writes nothing', () => {
  const s = setup();
  try {
    const out = join(s.dir, 'out2');
    const base = { heldout: s.paths.heldout, training: s.paths.training, rows: s.paths.rows };
    const run = (o) => quiet(() => main([`--heldout=${o.heldout}`, `--training=${o.training}`, `--rows=${o.rows}`, `--out=${out}`]));
    let r = run({ ...base, heldout: join(s.dir, 'missing.json') });
    assert.equal(r.code, 1);
    assert.match(r.msgs.join(' '), /cannot read the held-out analysis/);
    r = run({ ...base, heldout: s.paths.training });
    assert.equal(r.code, 1);
    assert.match(r.msgs.join(' '), /label must be 'CONFIRMATORY'/);
    r = run({ ...base, rows: join(s.dir, 'nope.json') });
    assert.equal(r.code, 1);
    writeFileSync(join(s.dir, 'bad.json'), JSON.stringify({ ...s.rowsFile, protocolHash: 'other' }));
    r = run({ ...base, rows: join(s.dir, 'bad.json') });
    assert.match(r.msgs.join(' '), /different protocol hashes/);
    assert.equal(quiet(() => main(['--nope'])).code, 2);
    assert.ok(!existsSync(out), 'nothing is written on failure');
    assert.throws(() => buildAll({ heldout: s.heldout, training: s.training, rowsFile: { ...s.rowsFile, set: 'tuning' } }), /not a held-out rows file/);
  } finally { rmSync(s.dir, { recursive: true, force: true }); }
});
