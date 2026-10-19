// Find, launch and clean up a headless Chrome (Node built-ins only). Dev tool; never part of npm test.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromeCandidates } from './args.js';

const START_TIMEOUT_MS = 15000;

/** Error carrying the exit code the CLI should use when no browser can be started. */
export class BrowserUnavailable extends Error {
  constructor(message) { super(message); this.exitCode = 2; }
}

/** @returns {string} the first existing candidate @throws {BrowserUnavailable} listing every path tried */
export function findChrome(platform = process.platform, env = process.env, exists = existsSync) {
  const tried = chromeCandidates(platform, env);
  const found = tried.find((p) => exists(p));
  if (!found) throw new BrowserUnavailable(`no Chrome, Chromium or Edge found. Set CHROME_PATH. Tried:\n  ${tried.join('\n  ')}`);
  return found;
}

/**
 * Launch headless Chrome with a throwaway profile.
 * @param {{width: number, height: number}} size
 * @returns {Promise<{pageWsUrl: string, close: () => void}>} close kills the browser and deletes the profile (idempotent)
 */
export async function launchChrome({ width, height }) {
  const exe = findChrome();
  const profile = mkdtempSync(join(tmpdir(), 'siege-browser-check-'));
  const proc = spawn(exe, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try { proc.kill(); } catch { /* already gone */ }
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* Windows may still hold a file; the temp dir is disposable */ }
  };
  const onSignal = () => { close(); process.exit(130); };
  process.once('SIGINT', onSignal);

  try {
    const port = await new Promise((resolve, reject) => {
      let text = '';
      const timer = setTimeout(() => reject(new BrowserUnavailable('Chrome did not report a DevTools port in time')), START_TIMEOUT_MS);
      proc.once('exit', (code) => { clearTimeout(timer); reject(new BrowserUnavailable(`Chrome exited early (code ${code})`)); });
      proc.stderr.on('data', (chunk) => {
        text += chunk;
        const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(text);
        if (m) { clearTimeout(timer); resolve(Number(m[1])); }
      });
    });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new BrowserUnavailable('Chrome has no page target');
    return { pageWsUrl: page.webSocketDebuggerUrl, close: () => { process.off('SIGINT', onSignal); close(); } };
  } catch (e) {
    close();
    throw e;
  }
}
