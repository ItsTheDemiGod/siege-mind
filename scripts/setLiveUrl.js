// Records the deployed address in the README: node scripts/setLiveUrl.js --url=https://example.org (npm run set-live-url -- --url=...).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const OPEN = '<!-- LIVE_URL -->';
const CLOSE = '<!-- /LIVE_URL -->';

/** @param {string} url @returns {string} the url, validated @throws {Error} unless it is a plain https URL with a dotted host, no credentials, no spaces or angle brackets */
export function validateLiveUrl(url) {
  if (typeof url !== 'string' || /[\s<>"'`()[\]]/.test(url)) throw new Error('the URL must not contain spaces, quotes, brackets or angle brackets');
  let u;
  try { u = new URL(url); } catch { throw new Error(`not a valid URL: ${url}`); }
  if (u.protocol !== 'https:') throw new Error('the URL must use https');
  if (u.username || u.password) throw new Error('the URL must not contain credentials');
  if (!u.hostname.includes('.')) throw new Error('the URL needs a host with a dot');
  return url;
}

/**
 * Replace the text between the LIVE_URL markers with a link. Idempotent: the same URL gives the same README.
 * @param {string} readme @param {string} url @returns {string}
 */
export function applyLiveUrl(readme, url) {
  validateLiveUrl(url);
  const a = readme.indexOf(OPEN);
  const b = readme.indexOf(CLOSE);
  if (a === -1 || b === -1 || b < a) throw new Error(`README markers ${OPEN} ... ${CLOSE} are missing`);
  return `${readme.slice(0, a + OPEN.length)}[${url}](${url})${readme.slice(b)}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv.slice(2).find((a) => a.startsWith('--url='));
  if (!arg) { console.error('usage: npm run set-live-url -- --url=https://your-site.example'); process.exit(2); }
  const path = fileURLToPath(new URL('../README.md', import.meta.url));
  try { writeFileSync(path, applyLiveUrl(readFileSync(path, 'utf8'), arg.slice('--url='.length))); console.log('README updated'); } catch (e) { console.error(e.message); process.exit(1); }
}
