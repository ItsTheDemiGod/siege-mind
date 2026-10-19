// CLI: npm run figures -- --analysis=docs/results/tuning-summary.json --diagnostics=docs/results/diagnostics.json --out=docs/results/figures
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { forestFigure, livesLostFigure, winRateFigure, weightsHeatmapFigure, tiltAlignmentFigure, diagnosticsFigure } from './figures/figures.js';
import { escapeXml } from './figures/svg.js';

export const DEFAULTS = Object.freeze({ analysis: 'docs/results/tuning-summary.json', diagnostics: 'docs/results/diagnostics.json', out: 'docs/results/figures' });

export const FIGURES = Object.freeze([
  { file: 'fig1-forest.svg', build: (a) => forestFigure(a), source: 'analysis', title: 'Differences between modes', caption: 'Mean difference with a 95% cluster-bootstrap interval for every hypothesis; Holm-adjusted p within the primary and the secondary family.' },
  { file: 'fig2-lives-lost.svg', build: (a) => livesLostFigure(a), source: 'analysis', title: 'Mean lives lost by style and mode', caption: 'Mean lives lost per bot style and mode, with error bars of 1.96 standard errors over seeds.' },
  { file: 'fig3-win-rate.svg', build: (a) => winRateFigure(a), source: 'analysis', title: 'Win rate by style and mode', caption: 'Share of games won per bot style and mode, with Wilson 95% intervals.' },
  { file: 'fig4-weights.svg', build: (a) => weightsHeatmapFigure(a), source: 'analysis', title: 'Mean final enemy weights', caption: 'Mean final weight per enemy type for each bot style in adaptive mode; cell color and a triangle glyph show the direction.' },
  { file: 'fig5-tilt-alignment.svg', build: (a) => tiltAlignmentFigure(a), source: 'analysis', title: 'Tilt alignment', caption: 'Share of games whose final weights lean toward the predicted enemy types, adaptive versus random, with Wilson 95% intervals.' },
  { file: 'fig6-diagnostics.svg', build: (d) => diagnosticsFigure(d), source: 'diagnostics', title: 'Reward signal diagnostics', caption: 'Static-game reward per unit of threat by enemy type relative to the average, and the share of reward variance explained by style and by wave.' },
]);

/** @param {string[]} argv @returns {{analysis: string, diagnostics: string, out: string}} @throws {Error} for unknown arguments */
export function parseFiguresArgs(argv) {
  const a = { ...DEFAULTS };
  for (const arg of argv) {
    const m = /^--(analysis|diagnostics|out)=(.+)$/s.exec(arg);
    if (!m) throw new Error(`unknown argument: ${arg}`);
    a[m[1]] = m[2];
  }
  return a;
}

/** The static index page: every figure inline with its factual caption (system font, no scripts). */
export function indexHtml(figureSvgs) {
  const items = FIGURES.map((f) => `<figure>\n${figureSvgs[f.file]}<figcaption>${escapeXml(f.caption)}</figcaption>\n</figure>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Siege Mind experiment figures</title>
<style>body { font-family: Arial, Helvetica, sans-serif; margin: 24px auto; max-width: 1000px; color: #1a1a1a; background: #ffffff; } figure { margin: 0 0 32px; } svg { max-width: 100%; height: auto; } figcaption { font-size: 14px; color: #555555; }</style>
</head>
<body>
<h1>Siege Mind experiment figures</h1>
<p>Generated from docs/results by <code>npm run figures</code>. Tuning-set results are exploratory.</p>
${items}
</body>
</html>
`;
}

/**
 * Build every figure and write the files.
 * @param {{analysis: object, diagnostics: object, out: string}} o @returns {{file: string, bytes: number}[]}
 */
export function writeFigures({ analysis, diagnostics, out }) {
  mkdirSync(out, { recursive: true });
  const svgs = {};
  const written = [];
  for (const f of FIGURES) {
    svgs[f.file] = f.build(f.source === 'analysis' ? analysis : diagnostics);
    writeFileSync(resolve(out, f.file), svgs[f.file]);
    written.push({ file: f.file, bytes: Buffer.byteLength(svgs[f.file]) });
  }
  const html = indexHtml(svgs);
  writeFileSync(resolve(out, 'index.html'), html);
  written.push({ file: 'index.html', bytes: Buffer.byteLength(html) });
  return written;
}

function main() {
  let a;
  try { a = parseFiguresArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); return 2; }
  const read = (p, what) => {
    let json;
    try { json = JSON.parse(readFileSync(resolve(p), 'utf8')); } catch (e) { throw new Error(`cannot read ${what} ${p}: ${e.message}`); }
    return json;
  };
  try {
    const analysis = read(a.analysis, 'the analysis');
    const diagnostics = read(a.diagnostics, 'the diagnostics');
    if (!analysis.completeness?.complete || !analysis.descriptive || !analysis.tiltAlignment) throw new Error(`${a.analysis} is not a complete analysis result`);
    if (!diagnostics.baseline5 || !diagnostics.variance) throw new Error(`${a.diagnostics} is not a diagnostics result`);
    for (const w of writeFigures({ analysis, diagnostics, out: resolve(a.out) })) console.log(`${resolve(a.out, w.file)}  ${w.bytes} bytes`);
    return 0;
  } catch (e) { console.error(e.message); return 1; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
