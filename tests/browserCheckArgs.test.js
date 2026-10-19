import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { parseArgs, chromeCandidates, shotPath } from '../tools/browser-check/args.js';

test('defaults', () => {
  assert.deepEqual(parseArgs([]), { wait: 3000, width: 1280, height: 720, timeout: 30000 });
});

test('every flag is read', () => {
  const a = parseArgs(['--url=/?seed=1', '--base=http://localhost:8137', '--wait=500', '--shot=a.png', '--width=800', '--height=600', '--eval=1 + 1', '--timeout=9000']);
  assert.deepEqual(a, { url: '/?seed=1', base: 'http://localhost:8137', wait: 500, shot: 'a.png', width: 800, height: 600, eval: '1 + 1', timeout: 9000 });
  assert.equal(parseArgs(['--eval=document.title.includes("=")']).eval, 'document.title.includes("=")');
});

test('bad --shot names are rejected', () => {
  for (const bad of ['../x.png', 'a/b.png', 'a\\b.png', '..', 'x..png', 'C:evil.png', '/abs.png']) assert.throws(() => parseArgs([`--shot=${bad}`]), /plain file name/, bad);
  assert.equal(parseArgs(['--shot=ok_1-2.png']).shot, 'ok_1-2.png');
  assert.throws(() => shotPath('../x', 'out'), /plain file name/);
  assert.equal(shotPath('x.png', 'out'), join('out', 'x.png'));
});

test('bad numbers, empty values, unknown flags and bare arguments are rejected', () => {
  for (const bad of ['--wait=abc', '--wait=-5', '--wait=1.5', '--wait=999999999', '--width=10', '--height=0', '--timeout=5', '--wait=']) assert.throws(() => parseArgs([bad]), RangeError, bad);
  assert.throws(() => parseArgs(['--url=']), /needs a value/);
  assert.throws(() => parseArgs(['--nope=1']), /unknown flag: --nope/);
  assert.throws(() => parseArgs(['--url']), /unrecognized argument/);
  assert.throws(() => parseArgs(['http://x']), /unrecognized argument/);
});

test('chrome candidates per platform, CHROME_PATH first', () => {
  const env = { CHROME_PATH: '/custom/chrome', PROGRAMFILES: 'D:\\PF', 'PROGRAMFILES(X86)': 'D:\\PF86', LOCALAPPDATA: 'D:\\Local' };
  const win = chromeCandidates('win32', env);
  assert.equal(win[0], '/custom/chrome');
  assert.ok(win.includes('D:\\PF\\Google\\Chrome\\Application\\chrome.exe'));
  assert.ok(win.includes('D:\\Local\\Google\\Chrome\\Application\\chrome.exe'));
  assert.ok(win.some((p) => p.endsWith('msedge.exe')));
  assert.equal(chromeCandidates('win32', {})[0], 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
  const mac = chromeCandidates('darwin', {});
  assert.equal(mac[0], '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  assert.ok(mac.length >= 3);
  const linux = chromeCandidates('linux', { CHROME_PATH: '/x' });
  assert.deepEqual(linux.slice(0, 2), ['/x', '/usr/bin/google-chrome']);
  assert.ok(linux.includes('/usr/bin/chromium'));
  assert.deepEqual(chromeCandidates('freebsd', {}), chromeCandidates('linux', {}));
});
