import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStaticServer } from '../scripts/serve.js';

const MARKER = 'TOP-SECRET-MARKER';
let tmp, server, port;

// path is sent exactly as written (no client-side normalization).
const get = (path) => new Promise((ok, fail) => {
  http.request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
    let body = '';
    res.on('data', (c) => (body += c));
    res.on('end', () => ok({ status: res.statusCode, type: res.headers['content-type'], body }));
  }).on('error', fail).end();
});

before(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'siege-serve-'));
  await mkdir(join(tmp, 'site'));
  await writeFile(join(tmp, 'secret.txt'), MARKER);
  await writeFile(join(tmp, 'site', 'index.html'), '<h1>hi</h1>');
  await writeFile(join(tmp, 'site', 'app.js'), 'export {};');
  server = createStaticServer(join(tmp, 'site'));
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  port = server.address().port;
});

after(async () => {
  await new Promise((ok) => server.close(ok));
  await rm(tmp, { recursive: true, force: true });
});

test('serves index.html at /', async () => {
  const r = await get('/');
  assert.equal(r.status, 200);
  assert.match(r.type, /^text\/html/);
});

test('serves JS with a JavaScript content-type', async () => {
  const r = await get('/app.js');
  assert.equal(r.status, 200);
  assert.match(r.type, /^text\/javascript/);
});

test('missing file is 404', async () => {
  assert.equal((await get('/nope.js')).status, 404);
});

for (const p of [
  '/../secret.txt', '/%2e%2e/secret.txt', '/%2E%2E/secret.txt', '/..%2fsecret.txt',
  '/%2e%2e%2fsecret.txt', '/..\\secret.txt', '/..%5csecret.txt', '/%252e%252e/secret.txt',
  '/./../secret.txt', '//..//secret.txt', '/app.js%00.txt',
]) {
  test(`traversal blocked: ${JSON.stringify(p)}`, async () => {
    const r = await get(p);
    assert.notEqual(r.status, 200);
    assert.ok(!r.body.includes(MARKER));
  });
}
