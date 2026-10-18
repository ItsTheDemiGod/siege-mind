import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICONS, iconSvg } from '../src/ui/icons.js';

const REQUIRED = [
  'gold', 'lives', 'wave', 'play', 'pause', 'step', 'speed1', 'speed2', 'speed3', 'settings', 'close', 'info', 'quality',
  'shake', 'motion', 'director', 'tower-lance', 'tower-mortar', 'tower-frost', 'tower-poison', 'tower-sniper',
  'enemy-armored-grunt', 'enemy-swarmling', 'enemy-fast-runner', 'enemy-regenerator', 'enemy-shielded-bruiser',
];

test('every required icon exists and is safe, color-free inline SVG', () => {
  for (const name of REQUIRED) {
    assert.ok(name in ICONS, name);
    const svg = iconSvg(name);
    assert.ok(svg.startsWith('<svg'), name);
    assert.match(svg, /viewBox="0 0 24 24"/);
    assert.ok(!/<script/i.test(svg), `${name} script`);
    assert.ok(!/\son\w+\s*=/i.test(svg), `${name} on* attribute`);
    assert.ok(!/https?:\/\//i.test(svg), `${name} external reference`);
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(svg), `${name} hard-coded color`);
  }
});

test('names are unique and bodies are distinct', () => {
  const names = Object.keys(ICONS);
  assert.equal(new Set(names).size, names.length);
  assert.equal(new Set(Object.values(ICONS)).size, names.length);
});

test('iconSvg applies size and throws on unknown names', () => {
  assert.match(iconSvg('gold', 32), /width="32" height="32"/);
  assert.match(iconSvg('gold'), /width="20"/);
  assert.throws(() => iconSvg('nope'));
});
