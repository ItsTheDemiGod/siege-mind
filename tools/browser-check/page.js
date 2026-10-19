// Load one URL in a fresh headless Chrome and report what went wrong (console errors, exceptions, failed requests).
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launchChrome } from './chrome.js';
import { connect } from './cdp.js';
import { shotPath } from './args.js';

export const OUT_DIR = fileURLToPath(new URL('./out/', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => { setTimeout(() => reject(new Error(`timeout after ${ms} ms`)), ms).unref(); })]);

/**
 * @param {{url: string, wait: number, width: number, height: number, timeout: number, evalExpr?: string, shot?: string}} o
 * @returns {Promise<{url: string, consoleErrors: string[], exceptions: string[], failedRequests: string[], evalResult?: any, evalError?: string, shotFile?: string}>}
 */
export async function inspectPage({ url, wait, width, height, timeout, evalExpr, shot }) {
  const chrome = await launchChrome({ width, height });
  const cdp = await connect(chrome.pageWsUrl);
  const report = { url, consoleErrors: [], exceptions: [], failedRequests: [] };
  const urls = new Map(); // request id -> url
  try {
    cdp.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') report.consoleErrors.push(p.args.map((a) => a.value ?? a.description ?? '').join(' ')); });
    cdp.on('Runtime.exceptionThrown', (p) => report.exceptions.push(p.exceptionDetails.exception?.description ?? p.exceptionDetails.text));
    cdp.on('Network.requestWillBeSent', (p) => urls.set(p.requestId, p.request.url));
    cdp.on('Network.responseReceived', (p) => { if (p.response.status >= 400) report.failedRequests.push(`${p.response.status} ${p.response.url}`); });
    cdp.on('Network.loadingFailed', (p) => { if (!p.canceled) report.failedRequests.push(`failed ${urls.get(p.requestId) ?? p.requestId}: ${p.errorText}`); });
    await Promise.all(['Runtime', 'Page', 'Network'].map((d) => cdp.send(`${d}.enable`)));
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await withTimeout((async () => { await cdp.send('Page.navigate', { url }); await sleep(wait); })(), timeout);
    if (evalExpr) {
      const r = await cdp.send('Runtime.evaluate', { expression: evalExpr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) report.evalError = r.exceptionDetails.exception?.description ?? r.exceptionDetails.text;
      else report.evalResult = r.result.value;
    }
    if (shot) {
      mkdirSync(OUT_DIR, { recursive: true });
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      report.shotFile = shotPath(shot, OUT_DIR);
      writeFileSync(report.shotFile, Buffer.from(data, 'base64'));
    }
  } finally {
    cdp.close();
    chrome.close();
  }
  return report;
}

/** @param {object} report from inspectPage @returns {boolean} true when nothing went wrong */
export const isClean = (report) => report.consoleErrors.length + report.exceptions.length + report.failedRequests.length === 0 && report.evalError === undefined;
