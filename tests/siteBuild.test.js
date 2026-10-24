// The static site build: what ships, that every reference inside dist resolves with the EXACT case (Linux file systems are case-sensitive, Windows is not),
// that builds are reproducible and that only <root>/dist can ever be cleaned.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDistTarget, buildSite, planSite } from '../scripts/build-site.js';
import { createStaticServer } from '../scripts/serve.js';
import { parseSmokeArgs } from '../tools/browser-check/smoke.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIST = join(ROOT, 'dist');
let manifest;
before(() => { manifest = buildSite(ROOT); });

test('the plan ships the pages, assets, src, vendor, fixtures and the figures (renamed), and nothing else', () => {
  const plan = planSite([
    'index.html', 'gallery.html', 'README.md', 'package.json', 'assets/favicon.svg', 'assets/fonts/inter-400.woff2', 'src/main.js', 'src/ui/style.css', 'vendor/x.js',
    'docs/fixtures/demo-adaptive-w15.json', 'docs/RESULTS.md', 'docs/results/heldout.csv', 'docs/results/figures-final/index.html', 'docs/results/figures-final/fig1.svg',
    'tests/a.test.js', 'experiments/protocol.js', 'tools/hygiene/scan.js', 'scripts/serve.js', 'node_modules/x/index.js', '.github/workflows/ci.yml', 'dist/index.html',
  ]);
  assert.deepEqual(plan.map((p) => p.to), [
    'assets/favicon.svg', 'assets/fonts/inter-400.woff2', 'docs/fixtures/demo-adaptive-w15.json', 'gallery.html', 'index.html', 'results/figures/fig1.svg', 'results/figures/index.html',
    'src/main.js', 'src/ui/style.css', 'vendor/x.js',
  ]);
  assert.equal(plan.find((p) => p.to === 'results/figures/index.html').from, 'docs/results/figures-final/index.html');
});

test('the built dist holds exactly the planned files plus BUILD.json, and no excluded folder', () => {
  const walk = (rel) => readdirSync(join(DIST, rel), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${rel}${e.name}/`) : [`${rel}${e.name}`]));
  const onDisk = walk('').filter((f) => f !== 'BUILD.json').sort();
  assert.deepEqual(onDisk, manifest.map((m) => m.path));
  for (const bad of ['tests/', 'experiments/', 'tools/', 'scripts/', 'node_modules/', '.git', 'docs/RESULTS', 'docs/results/']) assert.ok(!onDisk.some((f) => f.startsWith(bad)), bad);
  assert.deepEqual(onDisk.filter((f) => f.startsWith('docs/')).filter((f) => !f.startsWith('docs/fixtures/')), []);
});

// ---- case-exact reference check -------------------------------------------------------------------------------------------------------------------------------------

/** True when every segment of the relative path matches a directory entry exactly (case included). */
function existsExact(rel) {
  let dir = DIST;
  for (const seg of rel.split('/').filter(Boolean)) {
    if (!readdirSync(dir).includes(seg)) return false;
    dir = join(dir, seg);
  }
  return existsSync(dir);
}

const LOCAL = (u) => (u.startsWith('./') || u.startsWith('../') || u.startsWith('/')) && !u.startsWith('//');
const clean = (u) => u.split(/[?#]/)[0];

function refsOf(rel, text) {
  const refs = [];
  const add = (u) => { if (u && (LOCAL(u) || (rel.endsWith('.html') && !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(u)))) refs.push(clean(u)); }; // html allows bare relative paths
  if (rel.endsWith('.html')) {
    for (const m of text.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) add(m[1]);
    for (const m of text.matchAll(/<link[^>]*\shref="([^"]+)"/g)) add(m[1]);
  } else if (rel.endsWith('.js')) {
    for (const m of text.matchAll(/(?:import|export)\s[^'"();]*?from\s*['"]([^'"]+)['"]/g)) add(m[1]);
    for (const m of text.matchAll(/import\s*['"]([^'"]+)['"]/g)) add(m[1]);
    for (const m of text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) add(m[1]);
  } else if (rel.endsWith('.css')) {
    for (const m of text.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)) add(m[1]);
    for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) add(m[1]);
  }
  return refs;
}

function walkGraph(starts) {
  const seen = new Set();
  const broken = [];
  const queue = [...starts];
  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const text = readFileSync(join(DIST, rel), 'utf8');
    for (const ref of refsOf(rel, text)) {
      const target = ref.startsWith('/') ? ref.slice(1) : posix.normalize(posix.join(posix.dirname(rel), ref));
      if (!existsExact(target)) { broken.push(`${rel} -> ${ref}`); continue; }
      if (/\.(js|css|html)$/.test(target)) queue.push(target);
    }
  }
  return { seen, broken };
}

test('every script, stylesheet, module import and font reachable from the two pages exists with the exact case', () => {
  const { seen, broken } = walkGraph(['index.html', 'gallery.html']);
  assert.deepEqual(broken, []);
  assert.ok(seen.size > 100, `only ${seen.size} files reached`);
  assert.ok(seen.has('src/main.js') && seen.has('src/gallery.js') && seen.has('src/ui/style.css') && seen.has('src/sim/game.js'));
});

test('the reference checker is case-exact and sees broken links (synthetic cases)', () => {
  assert.ok(existsExact('index.html') && existsExact('src/ui/style.css'));
  assert.ok(!existsExact('Index.html') && !existsExact('src/UI/style.css') && !existsExact('src/ui/missing.css'));
  assert.deepEqual(refsOf('a.js', "import { x } from './b.js'; export * from '../c.js'; import './d.js'; const m = await import('./e.js'); import y from 'fs';"), ['./b.js', '../c.js', './d.js', './e.js']);
  assert.deepEqual(refsOf('a.html', '<script type="module" src="src/main.js"></script><link rel="stylesheet" href="/x.css?v=1">'), ['src/main.js', '/x.css']);
  assert.deepEqual(refsOf('a.html', '<link href="https://fonts.example/x.css"><script src="src/a.js"></script>'), ['src/a.js']);
});

test('the stylesheet references all six fonts and each exists', () => {
  const css = readFileSync(join(DIST, 'src/ui/style.css'), 'utf8');
  const fonts = refsOf('src/ui/style.css', css).filter((r) => r.endsWith('.woff2'));
  assert.equal(new Set(fonts).size, 6);
  for (const f of fonts) assert.ok(existsExact(posix.normalize(posix.join('src/ui', f))), f);
});

test('every literal fetch() path in src exists in dist (relative to the page)', () => {
  const found = [];
  const scan = (rel) => {
    for (const e of readdirSync(join(DIST, rel), { withFileTypes: true })) {
      const p = `${rel}/${e.name}`;
      if (e.isDirectory()) { scan(p); continue; }
      if (!p.endsWith('.js')) continue;
      const text = readFileSync(join(DIST, p), 'utf8');
      for (const m of text.matchAll(/fetch\(\s*(['"])([^'"]+)\1/g)) found.push([p, m[2]]);
      for (const m of text.matchAll(/fetch\(\s*([A-Za-z_]\w*)\s*[,)]/g)) {
        const c = new RegExp(`const\\s+${m[1]}\\s*=\\s*(['"])([^'"]+)\\1`).exec(text); // a constant holding the path
        if (c) found.push([p, c[2]]); else assert.fail(`${p}: fetch(${m[1]}) with an unresolved argument`);
      }
    }
  };
  scan('src');
  assert.ok(found.some(([, u]) => u.endsWith('demo-adaptive-w15.json')), 'the gallery fixture fetch must be found');
  for (const [file, url] of found) assert.ok(existsExact(clean(url).replace(/^\//, '')), `${file}: ${url}`);
});

test('two consecutive builds give a byte-identical BUILD.json', () => {
  const first = readFileSync(join(DIST, 'BUILD.json'));
  buildSite(ROOT);
  assert.ok(first.equals(readFileSync(join(DIST, 'BUILD.json'))));
  assert.ok(!/\d{4}-\d\d-\d\dT/.test(first.toString()), 'no timestamps');
});

test('only <root>/dist may be cleaned', () => {
  for (const bad of [ROOT, join(ROOT, 'src'), join(ROOT, 'dist', '..'), dirname(ROOT), join(ROOT, 'dist2'), join(ROOT, 'dist', 'src')]) assert.throws(() => assertDistTarget(ROOT, bad), /refusing to clean/, bad);
  assert.doesNotThrow(() => assertDistTarget(ROOT, join(ROOT, 'dist')));
  assert.throws(() => buildSite(ROOT, join(ROOT, 'src')), /refusing/);
  assert.ok(existsSync(join(ROOT, 'src/main.js')), 'src was not touched');
});

test('dist is served with the right types', async () => {
  const server = createStaticServer(DIST);
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const font = manifest.find((m) => m.path.endsWith('.woff2')).path;
    for (const [path, type] of [['/', 'text/html'], ['/gallery.html', 'text/html'], ['/src/main.js', 'text/javascript'], ['/results/figures/index.html', 'text/html'],
      [`/${font}`, 'font/woff2'], ['/docs/fixtures/demo-adaptive-w15.json', 'application/json']]) {
      const res = await fetch(base + path);
      assert.equal(res.status, 200, path);
      assert.ok(res.headers.get('content-type').startsWith(type), `${path}: ${res.headers.get('content-type')}`);
      await res.arrayBuffer();
    }
    assert.equal((await fetch(`${base}/docs/RESULTS.md`)).status, 404);
  } finally {
    server.close();
  }
});

test('vercel.json builds with the site script into dist and sets the two headers', () => {
  const v = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  assert.equal(v.buildCommand, 'npm run build:site');
  assert.equal(v.outputDirectory, 'dist');
  assert.deepEqual(v.headers[0].headers.map((h) => h.key), ['X-Content-Type-Options', 'Referrer-Policy']);
  assert.ok(readFileSync(join(ROOT, '.gitignore'), 'utf8').split('\n').includes('dist/'));
});

test('smoke arguments: --root and --base are exclusive, anything else is refused', () => {
  assert.deepEqual(parseSmokeArgs(['--root=dist']), { root: 'dist' });
  assert.deepEqual(parseSmokeArgs(['--base=https://example.org']), { base: 'https://example.org' });
  assert.throws(() => parseSmokeArgs(['--root=dist', '--base=https://example.org']));
  assert.throws(() => parseSmokeArgs(['--nope']));
  assert.deepEqual(parseSmokeArgs([]), {});
});

