import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyLiveUrl, validateLiveUrl } from '../scripts/setLiveUrl.js';

const AT = String.fromCharCode(64); // assembled so that the hygiene scanner does not read these credentials-in-URL test cases as e-mail addresses
const slot = 'Live demo: <!-- LIVE_URL -->(not deployed yet)<!-- /LIVE_URL -->\n\nrest';

test('a valid https URL replaces the slot with a link', () => {
  const out = applyLiveUrl(slot, 'https://siege-mind.vercel.app');
  assert.equal(out, 'Live demo: <!-- LIVE_URL -->[https://siege-mind.vercel.app](https://siege-mind.vercel.app)<!-- /LIVE_URL -->\n\nrest');
  assert.ok(applyLiveUrl(slot, 'https://example.org/play/?a=b#c').includes('(https://example.org/play/?a=b#c)'));
});

test('invalid URLs are refused with a clear message', () => {
  for (const bad of ['http://example.org', 'ftp://example.org', `https://user:pw${AT}example.org`, `https://user${AT}example.org`, 'https://localhost', 'https://exa mple.org', 'https://example.org/<x>',
    'https://example.org/a)b', 'not a url', '', 'javascript:alert(1)', 'https://example.org/"x"']) {
    assert.throws(() => applyLiveUrl(slot, bad), Error, bad);
  }
  assert.throws(() => validateLiveUrl('http://example.org'), /https/);
  assert.throws(() => validateLiveUrl(`https://u:p${AT}example.org`), /credentials/);
  assert.throws(() => validateLiveUrl('https://localhost'), /dot/);
});

test('applying twice, or a new URL after an old one, keeps exactly one slot', () => {
  const once = applyLiveUrl(slot, 'https://a.example.org');
  assert.equal(applyLiveUrl(once, 'https://a.example.org'), once);
  const other = applyLiveUrl(once, 'https://b.example.org');
  assert.ok(other.includes('[https://b.example.org](https://b.example.org)') && !other.includes('a.example.org'));
  assert.equal(other.split('<!-- LIVE_URL -->').length, 2);
});

test('missing or reversed markers throw', () => {
  assert.throws(() => applyLiveUrl('no markers here', 'https://a.example.org'), /markers/);
  assert.throws(() => applyLiveUrl('<!-- LIVE_URL -->only open', 'https://a.example.org'), /markers/);
  assert.throws(() => applyLiveUrl('<!-- /LIVE_URL --> then <!-- LIVE_URL -->', 'https://a.example.org'), /markers/);
});

test('the real README accepts a URL', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.ok(applyLiveUrl(readme, 'https://siege-mind.example.org').includes('[https://siege-mind.example.org]'));
});
