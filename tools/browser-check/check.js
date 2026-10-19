// CLI: node tools/browser-check/check.js --url=<url or /path> [--base=..] [--wait=ms] [--shot=name.png] [--eval='expr']
// Loads the page in a local headless Chrome and exits 1 on any console error, exception or failed request (0 otherwise, 2 without a browser).
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createStaticServer } from '../../scripts/serve.js';
import { parseArgs } from './args.js';
import { inspectPage, isClean } from './page.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Start the project's static server on a free port.
 * @returns {Promise<{base: string, close: () => void}>}
 */
export async function startLocalServer() {
  const server = createStaticServer(ROOT);
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

/** @param {object} r report from inspectPage @returns {string} */
export function formatReport(r) {
  const lines = [`url: ${r.url}`, `console errors: ${r.consoleErrors.length}`, `exceptions: ${r.exceptions.length}`, `failed requests: ${r.failedRequests.length}`];
  for (const [label, list] of [['console error', r.consoleErrors], ['exception', r.exceptions], ['failed request', r.failedRequests]]) list.forEach((x) => lines.push(`  ${label}: ${x}`));
  if (r.evalError !== undefined) lines.push(`eval error: ${r.evalError}`);
  if ('evalResult' in r) lines.push(`eval result: ${JSON.stringify(r.evalResult)}`);
  if (r.shotFile) lines.push(`screenshot: ${r.shotFile}`);
  lines.push(isClean(r) ? 'RESULT: clean' : 'RESULT: problems found');
  return lines.join('\n');
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); return 2; }
  if (!args.url) { console.error('--url is required (a full URL, or a path such as /?seed=1 with --base or the built-in server)'); return 2; }
  let server = null;
  try {
    let url = args.url;
    if (url.startsWith('/')) {
      let base = args.base;
      if (!base) { server = await startLocalServer(); base = server.base; }
      url = base.replace(/\/$/, '') + url;
    }
    const report = await inspectPage({ url, wait: args.wait, width: args.width, height: args.height, timeout: args.timeout, evalExpr: args.eval, shot: args.shot });
    console.log(formatReport(report));
    return isClean(report) ? 0 : 1;
  } catch (e) {
    console.error(e.message);
    return e.exitCode ?? 1;
  } finally {
    server?.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then((code) => process.exit(code));
