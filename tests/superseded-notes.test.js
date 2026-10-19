import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Hand-written documents only: generated outputs (docs/RESULTS.md and anything under docs/results that a script writes) are never edited.
const DOCS = ['CLAUDE.md', 'README.md', 'docs/DIRECTOR.md', 'docs/EXPERIMENT.md', 'docs/TELEMETRY.md', 'docs/DEMO_SCRIPT.md', 'docs/REPORT_NOTES.md', 'docs/results/README.md'];
const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8').split('\n');

test("every 'explains most' in a hand-written document is followed within five lines by a superseded note", () => {
  for (const p of DOCS) {
    const lines = read(p);
    lines.forEach((l, i) => {
      if (!/explains most/i.test(l)) return;
      assert.ok(lines.slice(i + 1, i + 6).some((x) => x.includes('Superseded by the held-out run')), `${p}:${i + 1}`);
    });
  }
});

test('the exploratory attribution statements carry the superseded note', () => {
  const need = { 'docs/EXPERIMENT.md': 5, 'docs/DIRECTOR.md': 1, 'CLAUDE.md': 2 };
  for (const [p, n] of Object.entries(need)) {
    const count = read(p).filter((l) => l.includes('Superseded by the held-out run (see docs/RESULTS.md)')).length;
    assert.ok(count >= n, `${p}: ${count} notes, expected at least ${n}`);
  }
});
