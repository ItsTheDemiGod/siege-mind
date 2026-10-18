import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWERS, TOWER_ORDER, TARGET_MODES } from '../src/data/towers.js';
import { ENEMIES } from '../src/data/enemies.js';
import { THEME } from '../src/render/theme.js';
import { ICONS } from '../src/ui/icons.js';

test('exactly the five ids in order, frozen', () => {
  assert.deepEqual([...TOWER_ORDER], ['lance', 'mortar', 'frost', 'poison', 'sniper']);
  assert.deepEqual(Object.keys(TOWERS), [...TOWER_ORDER]);
  assert.ok(Object.isFrozen(TOWERS) && Object.isFrozen(TOWER_ORDER) && Object.isFrozen(TARGET_MODES));
  for (const d of Object.values(TOWERS)) {
    assert.ok(Object.isFrozen(d) && Object.isFrozen(d.upgrades) && Object.isFrozen(d.upgrades[0]));
  }
});

test('numeric fields are finite and sane', () => {
  for (const d of Object.values(TOWERS)) {
    for (const k of ['cost', 'range', 'intervalTicks', 'damage', 'shieldMult', 'projectileSpeed']) assert.ok(Number.isFinite(d[k]), `${d.id}.${k}`);
    assert.ok(d.cost > 0 && d.range > 0 && d.intervalTicks >= 1 && d.damage >= 0 && d.shieldMult >= 1);
    assert.equal(d.projectileSpeed > 0, d.kind === 'bolt' || d.kind === 'shell', `${d.id} speed`);
    assert.ok(typeof d.armorPierce === 'boolean');
  }
  assert.ok(TOWERS.mortar.splashRadius > 0 && TOWERS.mortar.splashMinFraction > 0 && TOWERS.mortar.splashMinFraction <= 1);
  assert.ok(TOWERS.frost.slowFactor > 0 && TOWERS.frost.slowFactor < 1 && TOWERS.frost.slowSeconds > 0);
  assert.ok(TOWERS.poison.poisonDps > 0 && TOWERS.poison.poisonSeconds > 0 && TOWERS.poison.cloudRadius > 0);
});

test('hotkeys are unique single letters a s d f g', () => {
  assert.deepEqual(TOWER_ORDER.map((id) => TOWERS[id].hotkey), ['a', 's', 'd', 'f', 'g']);
});

test('two upgrades with positive costs and non-decreasing multipliers', () => {
  for (const d of Object.values(TOWERS)) {
    assert.equal(d.upgrades.length, 2);
    for (const u of d.upgrades) assert.ok(u.cost > 0);
    const [a, b] = d.upgrades;
    for (const k of ['damageMult', 'dpsMult', 'rangeMult', 'splashMult', 'cloudMult']) {
      if (k in a) assert.ok(b[k] >= a[k] && a[k] >= 1, `${d.id}.${k}`);
    }
    assert.ok(a.intervalMult <= 1 && b.intervalMult <= a.intervalMult);
  }
  const f = TOWERS.frost.upgrades;
  assert.ok(f[0].slowFactor < TOWERS.frost.slowFactor && f[1].slowFactor < f[0].slowFactor); // lower factor = stronger slow
});

test('strongVs / weakVs reference real enemy ids', () => {
  for (const d of Object.values(TOWERS)) for (const id of [...d.strongVs, ...d.weakVs]) assert.ok(id in ENEMIES, `${d.id}: ${id}`);
});

test('ids match theme tower accents and tower icons', () => {
  for (const id of TOWER_ORDER) {
    assert.ok(id in THEME.tower, id);
    assert.ok(`tower-${id}` in ICONS, id);
  }
});

test('only frost has no default target; kinds and roles are valid', () => {
  for (const d of Object.values(TOWERS)) {
    assert.equal(d.defaultTarget === null, d.id === 'frost');
    if (d.defaultTarget !== null) assert.ok(TARGET_MODES.includes(d.defaultTarget));
    assert.ok(['bolt', 'shell', 'pulse', 'hitscan'].includes(d.kind));
    assert.ok(typeof d.role === 'string' && d.role.length > 0);
  }
});
