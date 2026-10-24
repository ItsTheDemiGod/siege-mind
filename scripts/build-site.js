// Static site build for Vercel: copies exactly what the browser needs into dist/ and writes dist/BUILD.json (sorted paths, sizes, sha256; no timestamps).
// Planning is pure (planSite); only buildSite and the CLI touch the file system, and the only folder ever removed is <root>/dist.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Shipped trees: [repo-relative source folder, published folder]. The browser imports the sim and data modules too, so src/ ships whole. */
export const SITE_TREES = Object.freeze([['assets', 'assets'], ['src', 'src'], ['vendor', 'vendor'], ['docs/fixtures', 'docs/fixtures'], ['docs/results/figures-final', 'results/figures']]);
export const SITE_PAGES = Object.freeze(['index.html', 'gallery.html']);

/**
 * @param {string[]} files repo-relative paths with forward slashes (anything; only the shipped ones are kept)
 * @returns {{from: string, to: string}[]} the copy plan, sorted by published path
 */
export function planSite(files) {
  const plan = [];
  for (const f of files) {
    if (SITE_PAGES.includes(f)) { plan.push({ from: f, to: f }); continue; }
    const tree = SITE_TREES.find(([src]) => f.startsWith(`${src}/`));
    if (tree) plan.push({ from: f, to: `${tree[1]}/${f.slice(tree[0].length + 1)}` });
  }
  return plan.sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : 0));
}

/** @param {string} root @param {string} target @throws {Error} unless target is exactly <root>/dist */
export function assertDistTarget(root, target) {
  if (resolve(target) !== resolve(root, 'dist')) throw new Error(`refusing to clean ${target}: only ${resolve(root, 'dist')} may be removed`);
}

function listFiles(root, rel) {
  const dir = join(root, rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listFiles(root, `${rel}/${e.name}`) : [`${rel}/${e.name}`]));
}

/** @param {string} root @param {string} [outDir] defaults to <root>/dist @returns {{path: string, size: number, sha256: string}[]} the manifest that was written */
export function buildSite(root = ROOT, outDir = join(root, 'dist')) {
  assertDistTarget(root, outDir);
  const candidates = [...SITE_PAGES, ...SITE_TREES.flatMap(([src]) => listFiles(root, src))];
  const plan = planSite(candidates);
  for (const page of SITE_PAGES) if (!plan.some((p) => p.to === page)) throw new Error(`missing page ${page}`);
  rmSync(outDir, { recursive: true, force: true });
  const manifest = [];
  for (const { from, to } of plan) {
    const dest = join(outDir, to);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(root, from), dest);
    manifest.push({ path: to, size: statSync(dest).size, sha256: createHash('sha256').update(readFileSync(dest)).digest('hex') });
  }
  writeFileSync(join(outDir, 'BUILD.json'), `${JSON.stringify({ files: manifest }, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const m = buildSite();
  console.log(`dist: ${m.length} files, ${m.reduce((n, f) => n + f.size, 0)} bytes`);
}
