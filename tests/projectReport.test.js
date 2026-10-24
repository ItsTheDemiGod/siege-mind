import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMBEDDED_TITLES, buildReport, extractSection, sectionFiles, slug, svgTitle } from '../tools/docs/buildReport.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const resultsMd = read('docs/RESULTS.md');
const sectionNames = sectionFiles(readdirSync(join(ROOT, 'docs/report')));
const sections = sectionNames.map((f) => ({ number: Number(f.slice(0, 2)), text: read(`docs/report/${f}`) }));
const figDir = join(ROOT, 'docs/results/figures-final');
const figures = readdirSync(figDir).filter((f) => f.endsWith('.svg')).sort().map((f) => ({ path: `results/figures-final/${f}`, alt: svgTitle(readFileSync(join(figDir, f), 'utf8')) || f }));
const report = buildReport({ sections, resultsMd, figures });

test('the hand-written sections are 1-5 and 7-9 (06 is generated)', () => {
  assert.deepEqual(sectionNames.map((f) => f.slice(0, 2)), ['01', '02', '03', '04', '05', '07', '08', '09']);
  assert.throws(() => sectionFiles(['01-a.md', '02-b.md']), /must hold sections/);
  assert.throws(() => sectionFiles(['01-a.md', '02-b.md', '03-c.md', '04-d.md', '05-e.md', '06-results.md', '07-f.md', '08-g.md', '09-h.md']), /must hold sections/);
  assert.throws(() => sectionFiles(['notes.md']), /does not match/);
});

test('the report has a contents list and the nine numbered sections in order', () => {
  const heads = [...report.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(heads.map((h) => h.replace(/^\d+\. /, '')), ['Contents', 'Overview', 'The game', 'Architecture', 'Engineering practice', 'Research question and method', 'Results', 'Limits and future work', 'How to run and reproduce', 'Appendix']);
  assert.deepEqual(heads.slice(1).map((h) => Number.parseInt(h, 10)), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(report.startsWith('# Siege Mind: project report\n'));
  assert.ok(report.includes('Do not edit by hand; run `npm run report-doc`'));
  for (const h of heads.slice(1)) assert.ok(report.includes(`](#${slug(h)})`), `contents entry for ${h}`);
});

test('the four embedded sections are byte-identical to the corresponding RESULTS.md text', () => {
  const results = report.slice(report.indexOf('## 6. Results'), report.indexOf('## 7. '));
  for (const title of EMBEDDED_TITLES) {
    const body = extractSection(resultsMd, title);
    assert.ok(body.length > 100, title);
    assert.ok(results.includes(`### ${title}\n\n${body}\n\n`), `${title} is not embedded verbatim`);
  }
  assert.ok(results.indexOf('### Headline') < results.indexOf('### Confirmatory results') && results.indexOf('### Limits') < results.indexOf('### What this does not show'));
  assert.ok(results.includes('[docs/RESULTS.md](RESULTS.md)'));
});

test('a missing RESULTS.md heading fails with a clear message', () => {
  for (const title of EMBEDDED_TITLES) {
    const broken = resultsMd.replace(`\n## ${title}\n`, '\n## Renamed\n');
    assert.notEqual(broken, resultsMd);
    assert.throws(() => buildReport({ sections, resultsMd: broken, figures }), new RegExp(`no section titled "${title}"`));
  }
});

test('every image link resolves from docs/ and has the figure title as alt text', () => {
  const images = [...report.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
  assert.equal(images.length, 6);
  for (const [, alt, path] of images) {
    assert.ok(existsSync(join(ROOT, 'docs', path)), path);
    assert.match(alt, /^Figure \d\. /);
    assert.equal(alt, svgTitle(read(`docs/${path}`)));
  }
});

test('the committed docs/PROJECT_REPORT.md is exactly what the generator produces now', () => {
  assert.equal(read('docs/PROJECT_REPORT.md'), report);
});

test('the generator is deterministic', () => {
  assert.equal(buildReport({ sections, resultsMd, figures }), report);
  assert.equal(buildReport({ sections: [...sections].reverse(), resultsMd, figures }), report, 'input order does not matter');
});

test('extractSection handles the last section and a missing blank line; slug follows the GitHub rule', () => {
  assert.equal(extractSection('# T\n\n## A\n\nx\n\n## B\n\ny\nz\n', 'B'), 'y\nz');
  assert.equal(extractSection('## A\nx\n## B\ny', 'A'), 'x');
  assert.equal(slug('6. Results'), '6-results');
  assert.equal(slug('Research question and method'), 'research-question-and-method');
});

// Hand-written sections state no study numbers: outside code spans and code blocks only these definitional ones may appear.
const ALLOWED_DIGITS = [/\b[KA][1-3]\b/g, /\bv\d\b/g, /\bwaves? \d+\b/gi, /\b(?:15|30) waves\b/g, /\bNode 22\b/g];

test('the hand-written sections contain no digits outside code, identifiers and the named game sizes', () => {
  for (const { number, text } of sections) {
    let prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    prose = prose.replace(/^\s*\d+\. /gm, ''); // list numbering
    for (const re of ALLOWED_DIGITS) prose = prose.replace(re, '');
    const bad = prose.split('\n').filter((l) => /\d/.test(l)).map((l) => l.slice(0, 90));
    assert.deepEqual(bad, [], `section ${number}`);
  }
});

test('every file the sections cite in code spans exists', () => {
  for (const { number, text } of sections) {
    for (const [, cited] of text.matchAll(/`((?:docs|src|tests|tools|scripts|experiments|assets|\.github)\/[A-Za-z0-9_./-]+|[A-Z][A-Za-z_]+\.md|README\.md|LICENSE)`/g)) {
      if (cited.endsWith('/') || cited === 'docs/PROJECT_REPORT.md' || cited === 'dist/') continue;
      assert.ok(existsSync(join(ROOT, cited)), `section ${number} cites ${cited}`);
    }
  }
});

test('no personal data in the report sources', () => {
  assert.ok(!/[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.[a-z]/.test(report));
  assert.ok(!new RegExp(`\\b[A-Za-z]:\\\\|/${'Us' + 'ers'}/|/${'ho' + 'me'}/`).test(report), 'no drive paths or home folders');
  assert.ok(dirname(join(ROOT, 'docs/PROJECT_REPORT.md')).endsWith('docs'));
});
