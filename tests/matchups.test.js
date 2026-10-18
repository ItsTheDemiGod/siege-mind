// Encodes the counter relationships of Section 6 (R1-R7) using the real sim through experiments/matchups.js.
// The sim is deterministic, so these are exact, not statistical. If one fails after a data change, retune the data
// in src/data (and log it), never the assertion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPass } from '../experiments/matchups.js';
import { TOWERS } from '../src/data/towers.js';

const pass = (towers, enemy) => runPass({ towers: towers.map((type) => ({ type })), enemy });

test('R1 armor: lance deals nominal damage per hit to a grunt; mortar deals less', () => {
  const lance = pass(['lance'], { type: 'armoredGrunt', count: 1 });
  const mortar = pass(['mortar'], { type: 'armoredGrunt', count: 1 });
  assert.equal(lance.avgDamagePerHit, TOWERS.lance.damage);
  assert.ok(mortar.avgDamagePerHit < TOWERS.mortar.damage, `${mortar.avgDamagePerHit}`);
});

test('R2 packs: against 8 swarmlings the mortar kills at least 2 more than the lance', () => {
  const swarm = { type: 'swarmling', count: 8 };
  const mortar = pass(['mortar'], swarm);
  const lance = pass(['lance'], swarm);
  assert.ok(mortar.kills >= lance.kills + 2, `mortar ${mortar.kills} lance ${lance.kills}`);
});

test('R3 shells vs speed: mortar hit rate against runners is under half its rate against grunts', () => {
  // Spaced streams (120 ticks apart). In a dense stream (default 20 ticks) a shell aimed at the leader still
  // lands on a follower inside the splash, so "hit" is ~100% for any stream; spacing isolates the dodge effect.
  const spacingTicks = 120;
  const runners = pass(['mortar'], { type: 'fastRunner', count: 10, spacingTicks });
  const grunts = pass(['mortar'], { type: 'armoredGrunt', count: 10, spacingTicks });
  assert.ok(grunts.impactsTotal > 5 && runners.impactsTotal > 5);
  assert.ok(runners.hitRate < grunts.hitRate / 2, `runners ${runners.hitRate} grunts ${grunts.hitRate}`);
});

test('R4 frost support: lance + frost kills at least 25% more of a 10-runner stream than lance alone', () => {
  const stream = { type: 'fastRunner', count: 10 };
  const alone = pass(['lance'], stream);
  const both = pass(['lance', 'frost'], stream);
  assert.ok(alone.kills > 0);
  assert.ok(both.kills >= alone.kills * 1.25, `alone ${alone.kills} with frost ${both.kills}`);
});

test('R5 shields: poison alone never hurts a shielded bruiser; one sniper shot breaks the shield', () => {
  const poison = pass(['poison'], { type: 'shieldedBruiser', count: 1 });
  assert.equal(poison.damageDealt, 0);
  assert.equal(poison.kills, 0);
  const sniper = pass(['sniper'], { type: 'shieldedBruiser', count: 1 });
  assert.equal(sniper.kills, 1);
  // first shot: shield 160 / shieldMult 3 absorbed, remainder to hp (see combat.test.js for the exact figures)
  assert.ok(sniper.damageDealt >= 160);
});

test('R6 regeneration: poison never lets a poisoned regenerator heal, and out-damages the lance per exposure second', () => {
  const regen = { type: 'regenerator', count: 1 };
  const poison = pass(['poison'], regen);
  const lance = pass(['lance'], regen);
  assert.equal(poison.healedWhilePoisoned, 0);
  assert.ok(poison.damageDealt > 0);
  assert.ok(poison.damageDealt / poison.exposureSeconds > lance.damageDealt / lance.exposureSeconds,
    `poison ${poison.damageDealt / poison.exposureSeconds} lance ${lance.damageDealt / lance.exposureSeconds}`);
});

test('R7 sniper vs packs: the mortar kills at least 2 more of a swarmling pack than the sniper', () => {
  const swarm = { type: 'swarmling', count: 8 };
  const mortar = pass(['mortar'], swarm);
  const sniper = pass(['sniper'], swarm);
  assert.ok(mortar.kills >= sniper.kills + 2, `mortar ${mortar.kills} sniper ${sniper.kills}`);
});

test('the harness is deterministic', () => {
  const a = pass(['mortar'], { type: 'swarmling', count: 8 });
  const b = pass(['mortar'], { type: 'swarmling', count: 8 });
  assert.deepEqual(a, b);
});
