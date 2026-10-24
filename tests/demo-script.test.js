import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const doc = readFileSync(new URL('../docs/DEMO_SCRIPT.md', import.meta.url), 'utf8');

test('the demo script mentions every URL parameter it uses', () => {
  const urls = [...doc.matchAll(/`(\/[^`]*\?[^`]*)`/g)].map((m) => m[1]);
  assert.ok(urls.length >= 3);
  const used = new Set(urls.flatMap((u) => [...new URLSearchParams(u.split('?')[1]).keys()]));
  for (const p of ['mode', 'seed', 'waves', 'play']) assert.ok(used.has(p), `no URL uses ${p}`);
  for (const p of used) assert.ok(new RegExp(`\`${p}\``).test(doc) || new RegExp(`\`${p}=`).test(doc) || doc.includes(`${p}=`), `parameter ${p} is not mentioned`);
  for (const p of ['mode', 'seed', 'waves', 'play']) assert.ok(doc.includes(`\`${p}\``) || doc.includes(`\`${p}=`), `${p} is not explained`);
});

test('the demo script names the hotkeys I, M, Enter and A, links to RESULTS.md and has a timeline up to six minutes', () => {
  for (const k of ['`I`', '`M`', '`Enter`', '`A`']) assert.ok(doc.includes(k), k);
  assert.ok(doc.includes('(RESULTS.md)'));
  assert.ok(doc.includes('docs/results/figures-final/'));
  const stamps = [...doc.matchAll(/^### (\d+):(\d\d) to (\d+):(\d\d)/gm)].map((m) => [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])]);
  assert.ok(stamps.length >= 5);
  assert.equal(stamps[0][0], 0);
  for (let i = 1; i < stamps.length; i++) assert.equal(stamps[i][0], stamps[i - 1][1], 'timestamps are contiguous');
  assert.equal(stamps.at(-1)[1], 360);
});

test('the demo script types no study numbers: only timestamps and the game sizes appear as digits outside code spans', () => {
  const prose = doc.replace(/`[^`\n]*`/g, '').replace(/\]\([^)]*\)/g, ']').replace(/^### .*$/gm, '').replace(/\b(15|30) waves\b/g, '').replace(/\bv[12]\b/g, '');
  const bad = prose.split('\n').filter((l) => /\d/.test(l) && !/^\| /.test(l));
  assert.deepEqual(bad.map((l) => l.slice(0, 80)), []);
});
