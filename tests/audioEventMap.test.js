import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soundForEvent, pitchJitter, SMALL_RADIUS, LARGE_RADIUS, MAPPED_EVENTS } from '../src/audio/eventMap.js';
import { EVENT_TYPES as E } from '../src/sim/events.js';
import { KILL_PITCH, SOUNDS } from '../src/audio/sounds.js';
import { audioConfig } from '../src/audio/audioConfig.js';
import { ENEMIES } from '../src/data/enemies.js';

const ids = (type, payload, ctx = { tick: 10 }) => soundForEvent(type, payload, ctx).map((s) => s.id);
const J = audioConfig.jitterFraction;

test('every event type maps as specified', () => {
  assert.deepEqual(ids(E.TOWER_PLACED, { id: 1 }), ['towerPlace']);
  assert.deepEqual(ids(E.TOWER_UPGRADED, { id: 1 }), ['towerUpgrade']);
  assert.deepEqual(ids(E.TOWER_SOLD, { id: 1 }), ['towerSell']);
  for (const [type, id] of [['lance', 'fireLance'], ['mortar', 'fireMortar'], ['frost', 'fireFrost'], ['poison', 'firePoison'], ['sniper', 'fireSniper']]) assert.deepEqual(ids(E.TOWER_FIRED, { towerId: 3, type }), [id]);
  assert.deepEqual(ids(E.PROJECTILE_IMPACT, { kind: 'shell', type: 'mortar', hit: true }), ['impactShell']);
  assert.deepEqual(ids(E.PROJECTILE_IMPACT, { kind: 'bolt', type: 'poison', hit: true }), ['impactCloud']);
  assert.deepEqual(ids(E.PROJECTILE_IMPACT, { kind: 'bolt', type: 'lance', hit: true }), ['impactSpark']);
  assert.deepEqual(ids(E.PROJECTILE_IMPACT, { kind: 'shell', type: 'mortar', hit: false }), []);
  assert.deepEqual(ids(E.ENEMY_SPAWNED, { id: 4, type: 'armoredGrunt' }), ['enemySpawn']);
  assert.deepEqual(ids(E.ENEMY_LEAKED, { id: 4, type: 'armoredGrunt' }), ['leak']);
  assert.deepEqual(ids(E.LIVES_CHANGED, { lives: 19, delta: -1 }), ['lifeLost']);
  assert.deepEqual(ids(E.LIVES_CHANGED, { lives: 20, delta: 0 }), []);
  assert.deepEqual(ids(E.WAVE_ENDED, { wave: 1 }), ['waveClear']);
  assert.deepEqual(ids(E.GAME_OVER, { result: 'won' }), ['victory']);
  assert.deepEqual(ids(E.GAME_OVER, { result: 'lost' }), ['defeat']);
  for (const t of [E.GAME_STARTED, E.GOLD_CHANGED, E.ENEMY_DAMAGED]) assert.deepEqual(ids(t, { x: 1 }), []);
});

test('kills are sized by enemy radius with exact thresholds, and a shielded bruiser has its own sound', () => {
  const byType = (type) => ids(E.ENEMY_KILLED, { id: 1, type })[0];
  assert.equal(byType('swarmling'), 'killSmall');
  assert.equal(byType('fastRunner'), 'killMedium'); // radius 12 is exactly SMALL_RADIUS: not small
  assert.equal(byType('regenerator'), 'killMedium');
  assert.equal(byType('armoredGrunt'), 'killMedium');
  assert.equal(byType('shieldedBruiser'), 'shieldedKill');
  assert.ok(ENEMIES.swarmling.radius < SMALL_RADIUS && ENEMIES.fastRunner.radius >= SMALL_RADIUS && ENEMIES.shieldedBruiser.radius >= LARGE_RADIUS);
  const sample = soundForEvent(E.ENEMY_KILLED, { id: 7, type: 'swarmling' }, { tick: 5 })[0];
  assert.ok(Math.abs(sample.pitch / KILL_PITCH.swarmling - 1) <= J + 1e-9);
});

test('the director sweep plays only for adapted and prior waves', () => {
  const wave = (reason) => ids(E.WAVE_STARTED, { wave: 5, director: reason ? { reason } : null });
  assert.deepEqual(wave('adapted'), ['waveStart', 'directorSweep']);
  assert.deepEqual(wave('prior'), ['waveStart', 'directorSweep']);
  for (const r of ['cold-start', 'random', 'fixed', 'intro', null]) assert.deepEqual(wave(r), ['waveStart'], String(r));
});

test('pitch jitter stays in the band, is deterministic and varies with the id', () => {
  const seen = new Set();
  for (let id = 0; id < 200; id++) {
    const p = pitchJitter(id, 100, 2);
    assert.ok(p >= 1 - J - 1e-12 && p <= 1 + J + 1e-12);
    assert.equal(p, pitchJitter(id, 100, 2));
    seen.add(p);
  }
  assert.ok(seen.size > 150);
  assert.notEqual(pitchJitter(1, 100, 2), pitchJitter(2, 100, 2));
  assert.deepEqual(soundForEvent(E.TOWER_FIRED, { towerId: 9, type: 'lance' }, { tick: 3 }), soundForEvent(E.TOWER_FIRED, { towerId: 9, type: 'lance' }, { tick: 3 }));
});

test('unknown types, missing payloads and missing fields give an empty array and never throw', () => {
  for (const [t, p] of [['nope', {}], [E.TOWER_FIRED, null], [E.TOWER_FIRED, {}], [E.TOWER_FIRED, { type: 'laser' }], [E.ENEMY_KILLED, {}], [E.ENEMY_KILLED, { type: 'dragon' }], [E.PROJECTILE_IMPACT, {}], [E.LIVES_CHANGED, {}], [E.WAVE_STARTED, undefined], [E.GAME_OVER, 5]]) {
    assert.doesNotThrow(() => soundForEvent(t, p, undefined));
    assert.ok(Array.isArray(soundForEvent(t, p)));
  }
  assert.deepEqual(soundForEvent(E.TOWER_FIRED, {}), []);
  assert.deepEqual(soundForEvent(E.ENEMY_KILLED, { type: 'dragon' }), []);
});

test('every returned id is a catalogue sound and MAPPED_EVENTS are real event types', () => {
  const real = new Set(Object.values(E));
  for (const t of MAPPED_EVENTS) assert.ok(real.has(t), t);
  for (const t of real) for (const s of soundForEvent(t, { type: 'lance', towerId: 1, id: 1, hit: true, kind: 'shell', delta: -1, result: 'won', director: { reason: 'adapted' } }, { tick: 1 })) assert.ok(SOUNDS[s.id], s.id);
});
