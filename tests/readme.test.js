import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const readme = readFileSync(`${ROOT}README.md`, 'utf8');

test('the README has the required headings in order', () => {
  const wanted = ['Screenshots', 'Features', 'How to play', 'Game modes', 'Run locally', 'The research in one paragraph', 'Architecture', 'Tests and the freeze', 'Site build', 'Reproducibility', 'Credits and license'];
  const found = [...readme.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  let last = -1;
  for (const w of wanted) {
    const i = found.indexOf(w);
    assert.ok(i > last, `missing or out of order: ${w}`);
    last = i;
  }
  assert.ok(readme.startsWith('# Siege Mind\n'));
});

test('badges use the repository URL from package.json', () => {
  const repo = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')).repository.url.replace(/\.git$/, '');
  assert.ok(repo.startsWith('https://github.com/') && !repo.includes('@'));
  assert.ok(readme.includes(`[![CI](${repo}/actions/workflows/ci.yml/badge.svg)](${repo}/actions/workflows/ci.yml)`));
});

test('the live demo slot exists exactly once and everything else is free of placeholders', () => {
  assert.equal(readme.split('<!-- LIVE_URL -->').length, 2);
  assert.equal(readme.split('<!-- /LIVE_URL -->').length, 2);
  assert.match(readme, /^Live demo: <!-- LIVE_URL -->.*<!-- \/LIVE_URL -->$/m);
  const outside = readme.replace(/<!-- LIVE_URL -->.*<!-- \/LIVE_URL -->/, '');
  for (const bad of [/TODO/i, /TBD/, /FIXME/, /lorem ipsum/i, /XXX/, /<!--/, /your-username/i]) assert.ok(!bad.test(outside.replace(/https:\/\/your-site\.example/g, '')), String(bad));
});

test('every image link points at an existing file', () => {
  const images = [...readme.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].filter((m) => m[2].startsWith('docs/screens/')); // the badges are images too
  assert.equal(images.length, 10);
  for (const [, alt, path] of images) {
    assert.ok(alt.length > 10, `alt text of ${path}`);
    assert.ok(existsSync(ROOT + path), path);
  }
});

test('every relative link to a file or folder in the README exists (except the generated report, written by npm run report-doc)', () => {
  for (const [, path] of readme.matchAll(/\]\(((?!https?:)[^)#]+)\)/g)) {
    if (path === 'docs/PROJECT_REPORT.md') continue;
    assert.ok(existsSync(ROOT + path), path);
  }
});

test('every top-level folder and every src folder is mentioned', () => {
  const dirs = (p) => readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const skip = new Set(['node_modules', 'dist', 'vendor']);
  for (const d of dirs(ROOT).filter((n) => !n.startsWith('.') && !skip.has(n))) assert.ok(readme.includes(`\`${d}\``) || readme.includes(`\`${d}/`), `top-level folder ${d}`);
  for (const d of dirs(`${ROOT}src`)) assert.ok(readme.includes(`\`src/${d}\``), `src/${d}`);
});

test('the Mermaid diagram declares every node before it is used in an edge', () => {
  const blocks = [...readme.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.equal(blocks.length, 1);
  const lines = blocks[0].split('\n').map((l) => l.trim()).filter(Boolean);
  assert.match(lines[0], /^flowchart (LR|TD)$/);
  const declared = new Set();
  let edges = 0;
  for (const line of lines.slice(1)) {
    const edge = /^([A-Za-z_]\w*)\s*(?:-->|-\.->|==>)\s*(?:\|[^|]*\|\s*)?([A-Za-z_]\w*)$/.exec(line);
    if (edge) {
      edges++;
      for (const id of [edge[1], edge[2]]) assert.ok(declared.has(id), `${id} used before it is declared: ${line}`);
      continue;
    }
    const decl = /^([A-Za-z_]\w*)\s*(?:\[|\(|\{)/.exec(line) ?? /^subgraph\s+([A-Za-z_]\w*)/.exec(line);
    if (decl) { declared.add(decl[1]); continue; }
    assert.equal(line, 'end', `unrecognized Mermaid line: ${line}`);
  }
  assert.ok(declared.size >= 10 && edges >= 10, `${declared.size} nodes, ${edges} edges`);
  for (const must of ['data', 'sim', 'bus', 'render', 'ui', 'audio', 'telemetry', 'harness', 'results']) assert.ok(declared.has(must), must);
});

// Numbers are not typed by hand: outside code spans, code blocks, links and comments only these definitional ones may appear.
const ALLOWED_DIGITS = [/\b(?:15|30) waves\b/g, /\bNode 22\b/g, /\bA1 to A3\b/g, /\bv[12]\b/g, /\bK[1-3]\b/g, /\bDirector v[12]\b/g];

test('no digits in the prose except the definitional ones (game sizes, versions, identifiers)', () => {
  let text = readme.replace(/```[\s\S]*?```/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/`[^`\n]*`/g, '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
  for (const re of ALLOWED_DIGITS) text = text.replace(re, '');
  const bad = text.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /\d/.test(l));
  assert.deepEqual(bad.map(([n, l]) => `${n}: ${l.slice(0, 80)}`), []);
});
