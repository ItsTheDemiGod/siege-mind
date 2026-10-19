// CLI: npm run figures:final [-- --heldout=... --training=... --rows=... --out=...]
// Writes the six protocol-v4 SVGs and index.html into the output folder (nothing else is written). Inputs are only read.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOCOL } from './protocol.js';
import { loadFigureInputs, pairContrasts } from './figuresV4/data.js';
import { FIGURES_V4 } from './figuresV4/figures.js';
import { escapeXml } from './figures/svg.js';
import { STATUS_STYLE } from './figuresV4/palette.js';

export const DEFAULTS = Object.freeze({ heldout: 'docs/results/heldout-confirmatory.json', training: 'docs/results/confirm-dryrun-train.json', rows: 'docs/results/heldout.rows.json', out: 'docs/results/figures-final' });

/** @param {string[]} argv @returns {{heldout: string, training: string, rows: string, out: string}} @throws {Error} for unknown arguments */
export function parseFiguresV4Args(argv) {
  const a = { ...DEFAULTS };
  for (const arg of argv) {
    const m = /^--(heldout|training|rows|out)=(.+)$/s.exec(arg);
    if (!m) throw new Error(`unknown argument: ${arg}`);
    a[m[1]] = m[2];
  }
  return a;
}

/** The static index page: each figure inline with its caption, status tag and a provenance line (no scripts, system font). */
export function indexHtmlV4(svgs, provenance) {
  const items = FIGURES_V4.map((f) => `<figure>\n<p class="tag">${escapeXml(STATUS_STYLE[f.status].tag)}</p>\n${svgs[f.file]}<figcaption>${escapeXml(f.title)}: see the caption inside the figure.</figcaption>\n</figure>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Siege Mind final figures (protocol v4)</title>
<style>body { font-family: Arial, Helvetica, sans-serif; margin: 24px auto; max-width: 1000px; color: #1a1a1a; background: #ffffff; } figure { margin: 0 0 32px; } svg { max-width: 100%; height: auto; } figcaption, .prov { font-size: 14px; color: #555555; } .tag { font-size: 12px; font-weight: bold; margin: 0 0 4px; }</style>
</head>
<body>
<h1>Siege Mind final figures (protocol v4, six modes)</h1>
<p class="prov">${escapeXml(provenance)}</p>
${items}
</body>
</html>
`;
}

const readJson = (p, what) => {
  try { return JSON.parse(readFileSync(resolve(p), 'utf8')); } catch (e) { throw new Error(`cannot read ${what} ${p}: ${e.message}`); }
};

/** Build all outputs in memory. @returns {{files: Record<string, string>}} file name to content @throws {Error} for invalid inputs */
export function buildAll({ heldout, training, rowsFile }) {
  const inputs = loadFigureInputs({ heldout, training });
  if (!Array.isArray(rowsFile.rows) || rowsFile.set !== 'heldout') throw new Error('the rows file is not a held-out rows file');
  if (rowsFile.protocolHash !== heldout.protocolHash) throw new Error('the rows file and the held-out analysis have different protocol hashes');
  const pairs = pairContrasts(rowsFile.rows, PROTOCOL, { waves: [5, 9, 13], modes: ['adaptive', 'adaptive2', 'counter'], analysis: heldout });
  const files = {};
  for (const f of FIGURES_V4) files[f.file] = f.build(inputs, pairs);
  const provenance = `protocol version ${heldout.protocolVersion}, protocol hash ${heldout.protocolHash}, lock run index ${rowsFile.runIndex}, held-out git commit ${rowsFile.gitCommit}, codeHash ${rowsFile.codeHash}.`;
  files['index.html'] = indexHtmlV4(files, provenance);
  return { files };
}

/** The CLI body. @param {string[]} argv @returns {number} the exit code */
export function main(argv) {
  let a;
  try { a = parseFiguresV4Args(argv); } catch (e) { console.error(e.message); return 2; }
  try {
    const { files } = buildAll({ heldout: readJson(a.heldout, 'the held-out analysis'), training: readJson(a.training, 'the training analysis'), rowsFile: readJson(a.rows, 'the rows') });
    mkdirSync(resolve(a.out), { recursive: true });
    for (const [name, content] of Object.entries(files)) { writeFileSync(resolve(a.out, name), content); console.log(`${resolve(a.out, name)}  ${Buffer.byteLength(content)} bytes`); }
    return 0;
  } catch (e) { console.error(e.message); return 1; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
