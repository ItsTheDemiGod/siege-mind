import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFiguresArgs, writeFigures, FIGURES, DEFAULTS } from '../experiments/figuresCli.js';
import { syntheticAnalysis, syntheticDiagnostics } from './figureFixtures.js';

test('parseFiguresArgs: defaults, every flag, unknown arguments', () => {
  assert.deepEqual(parseFiguresArgs([]), { analysis: 'docs/results/tuning-summary.json', diagnostics: 'docs/results/diagnostics.json', out: 'docs/results/figures' });
  assert.deepEqual(DEFAULTS, parseFiguresArgs([]));
  assert.deepEqual(parseFiguresArgs(['--analysis=a.json', '--diagnostics=d.json', '--out=o']), { analysis: 'a.json', diagnostics: 'd.json', out: 'o' });
  assert.throws(() => parseFiguresArgs(['--nope=1']), /unknown argument/);
  assert.throws(() => parseFiguresArgs(['--out']), /unknown argument/);
  assert.throws(() => parseFiguresArgs(['--out=']), /unknown argument/);
});

test('the figure list names the six files', () => {
  assert.deepEqual(FIGURES.map((f) => f.file), ['fig1-forest.svg', 'fig2-lives-lost.svg', 'fig3-win-rate.svg', 'fig4-weights.svg', 'fig5-tilt-alignment.svg', 'fig6-diagnostics.svg']);
  for (const f of FIGURES) assert.ok(f.caption.length > 20 && !/because|caused|due to/.test(f.caption), `${f.file}: captions describe, they do not explain causes`);
});

test('writeFigures writes every figure and an index that references them, with identical bytes on a second run', () => {
  const d1 = mkdtempSync(join(tmpdir(), 'siege-fig-'));
  const d2 = mkdtempSync(join(tmpdir(), 'siege-fig-'));
  try {
    const input = { analysis: syntheticAnalysis(), diagnostics: syntheticDiagnostics() };
    const w1 = writeFigures({ ...input, out: join(d1, 'nested') });
    const w2 = writeFigures({ ...input, out: d2 });
    assert.deepEqual(w1.map((w) => w.file), [...FIGURES.map((f) => f.file), 'index.html']);
    for (const f of FIGURES) {
      assert.ok(existsSync(join(d1, 'nested', f.file)), f.file);
      assert.equal(readFileSync(join(d1, 'nested', f.file), 'utf8'), readFileSync(join(d2, f.file), 'utf8'), f.file);
    }
    const html = readFileSync(join(d1, 'nested', 'index.html'), 'utf8');
    assert.equal(html, readFileSync(join(d2, 'index.html'), 'utf8'));
    for (const f of FIGURES) assert.ok(html.includes(f.caption.replace(/&/g, '&amp;')), `caption of ${f.file}`);
    assert.equal((html.match(/<svg /g) ?? []).length, 6);
    assert.ok(!/<script/i.test(html));
    assert.ok(w1.every((w) => w.bytes > 500));
  } finally { rmSync(d1, { recursive: true, force: true }); rmSync(d2, { recursive: true, force: true }); }
});
