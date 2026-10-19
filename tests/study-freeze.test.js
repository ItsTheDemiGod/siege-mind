// The held-out study describes exactly this simulation. Do not edit src/sim or src/data to change the game; if a change is ever intended, it defines a new
// version outside the study: create a new tag and update this constant on purpose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { protocolHash } from '../experiments/protocol.js';
import { simHash } from './studyFreezeHash.js';

const STUDY_SIM_HASH = '230c638e6be0f317ff8b1ec223766be88883d9852dcb4ccb4dd264e995dbf037';

test('the simulation (src/sim and src/data) is the one the held-out study describes', () => {
  assert.equal(simHash(), STUDY_SIM_HASH, 'src/sim or src/data changed: the held-out study no longer describes this game (see the header of this test)');
});

test('the held-out lock exists and belongs to the current protocol', () => {
  const lockPath = fileURLToPath(new URL('../experiments/heldout.lock.json', import.meta.url));
  assert.ok(existsSync(lockPath), 'experiments/heldout.lock.json is missing');
  assert.equal(JSON.parse(readFileSync(lockPath, 'utf8')).protocolHash, protocolHash());
});

test('simHash reacts to a change, ignores CRLF and ignores files outside src/sim and src/data', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = mkdtempSync(join(tmpdir(), 'freeze-'));
  try {
    for (const d of ['src/sim', 'src/data', 'src/render']) mkdirSync(join(root, d), { recursive: true });
    writeFileSync(join(root, 'src/sim/a.js'), 'export const a = 1;\n');
    writeFileSync(join(root, 'src/data/b.js'), 'export const b = 2;\n');
    const base = simHash(root);
    writeFileSync(join(root, 'src/render/c.js'), 'export const c = 3;\n');
    assert.equal(simHash(root), base);
    writeFileSync(join(root, 'src/sim/a.js'), 'export const a = 1;\r\n');
    assert.equal(simHash(root), base);
    writeFileSync(join(root, 'src/sim/a.js'), 'export const a = 9;\n');
    assert.notEqual(simHash(root), base);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
