import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scanText, scanFiles, redact, isEnvFile, isStudyFile, validateAllowlist, MAX_FILE_BYTES } from '../tools/hygiene/rules.js';
import { loadTracked } from '../tools/hygiene/scan.js';

const rules = (text) => scanText(text).map((f) => f.rule);

const BS = String.fromCharCode(92);
const USERS = 'Us' + 'ers'; // assembled so that this file does not trip the scanner it tests
const AT = String.fromCharCode(64);

test('home paths: Windows, forward-slash Windows, macOS and Linux hit; relative paths do not', () => {
  for (const s of [`C:${BS}${USERS}${BS}someone${BS}x`, `C:/${USERS}/someone/x`, `/${USERS}/someone/x`, '/ho' + 'me/someone/x']) assert.deepEqual(rules(s), ['home-path'], s);
  assert.deepEqual(rules(`src/ui/main.js and docs/${USERS}.md`), []);
});

test('e-mail addresses hit; role mailboxes and plain text do not', () => {
  assert.deepEqual(rules(`write to jane.doe${AT}example.com`), ['email']);
  assert.deepEqual(rules(`info${AT}example.com noreply${AT}example.com`), []);
  assert.deepEqual(rules(`an ${AT}mention and a${AT}b`), []);
});

test('tokens and keys hit; look-alike words do not', () => {
  assert.deepEqual(rules('ghp_' + 'a'.repeat(30)), ['github-token']);
  assert.deepEqual(rules('github_pat_' + 'A1_'.repeat(10)), ['github-token']);
  assert.deepEqual(rules('AKIA' + 'ABCDEFGHIJKLMNOP'), ['api-key']);
  assert.deepEqual(rules('AIza' + 'x'.repeat(35)), ['api-key']);
  assert.deepEqual(rules('sk-' + 'q'.repeat(24)), ['api-key']);
  assert.deepEqual(rules('-----BEGIN RSA PRIV' + 'ATE KEY-----'), ['private-key']);
  assert.deepEqual(rules('task-list ghp_ short sk-x AKIA'), []);
});

test('line numbers count from 1 and samples are redacted', () => {
  const [f] = scanText(`ok\nmail me: someone${AT}example.org`);
  assert.equal(f.line, 2);
  assert.ok(!f.sample.includes('example.org') && f.sample.startsWith('some'));
  assert.equal(redact('abcdefgh'), 'abcd…[8 chars]');
});

test('env files: .env and .env.local hit, templates do not', () => {
  assert.ok(isEnvFile('.env') && isEnvFile('app/.env.local'));
  assert.ok(!isEnvFile('.env.example') && !isEnvFile('src/env.js'));
});

test('scanFiles reports env files, large files and text findings; the allowlist removes exactly the named (path, rule) pairs', () => {
  const files = [
    { path: '.env', text: 'X=1', size: 3 },
    { path: 'docs/results/big.json', text: null, size: MAX_FILE_BYTES + 1 },
    { path: 'docs/results/a.json', text: `me${AT}example.com`, size: 14 },
    { path: 'src/a.js', text: 'ok', size: 2 },
  ];
  const all = scanFiles(files, []);
  assert.deepEqual(all.findings.map((f) => f.rule).sort(), ['email', 'env-file', 'large-file']);
  const some = scanFiles(files, [{ path: 'docs/results/big.json', rule: 'large-file' }, { path: 'docs/results/a.json', rule: 'home-path' }]);
  assert.deepEqual(some.findings.map((f) => f.rule).sort(), ['email', 'env-file']); // the home-path entry does not cover the email
  assert.equal(some.allowed.length, 1);
});

test('the allowlist may only name frozen or generated study files', () => {
  const entry = (path) => ({ path, rule: 'email', reason: 'r' });
  assert.deepEqual(validateAllowlist([entry('docs/results/heldout.rows.json'), entry('docs/RESULTS.md')]), []);
  assert.equal(validateAllowlist([entry('README.md')]).length, 1);
  assert.equal(validateAllowlist([entry('src/ui/hud.js')]).length, 1);
  assert.equal(validateAllowlist([entry('docs/results/README.md')]).length, 1);
  assert.equal(validateAllowlist([{ path: 'docs/results/x.json', rule: 'email' }]).length, 1, 'a reason is required');
});

test('the committed allowlist is acceptable', () => {
  assert.deepEqual(validateAllowlist(JSON.parse(readFileSync(new URL('../tools/hygiene/allowlist.json', import.meta.url), 'utf8'))), []);
});

test('the tracked files have no findings outside the allowlist', () => {
  const allowlist = JSON.parse(readFileSync(new URL('../tools/hygiene/allowlist.json', import.meta.url), 'utf8'));
  const { findings } = scanFiles(loadTracked(), allowlist);
  assert.deepEqual(findings, []);
});
