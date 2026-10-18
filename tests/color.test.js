import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hexToRgb, rgbToHex, mixHex, contrastRatio, deltaE76, simulateColorblind, CVD_MATRICES, lighten, darken,
} from '../src/render/color.js';

const KINDS = ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'];

test('hex parsing: 3 and 6 digits, uppercase, invalid throws', () => {
  assert.deepEqual(hexToRgb('#fff'), [255, 255, 255]);
  assert.deepEqual(hexToRgb('#35E0FF'), [53, 224, 255]);
  assert.deepEqual(hexToRgb('#abc'), [170, 187, 204]);
  for (const bad of ['fff', '#ff', '#fffff', '#gggggg', '', 'red', '#ffff']) assert.throws(() => hexToRgb(bad));
});

test('rgbToHex round trips and clamps', () => {
  assert.equal(rgbToHex(53, 224, 255), '#35e0ff');
  assert.equal(rgbToHex(-5, 300, 0.4), '#00ff00');
});

test('mixHex endpoints and midpoint', () => {
  assert.equal(mixHex('#000000', '#ffffff', 0), '#000000');
  assert.equal(mixHex('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(lighten('#000000', 1), '#ffffff');
  assert.equal(darken('#ffffff', 1), '#000000');
});

test('contrastRatio: black/white is 21 and symmetric', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 1e-9);
  assert.equal(contrastRatio('#35e0ff', '#070b14'), contrastRatio('#070b14', '#35e0ff'));
  assert.ok(Math.abs(contrastRatio('#777777', '#777777') - 1) < 1e-9);
});

test('deltaE76: identical is 0, black/white is about 100', () => {
  assert.equal(deltaE76('#35e0ff', '#35e0ff'), 0);
  assert.ok(Math.abs(deltaE76('#000000', '#ffffff') - 100) < 0.5);
});

test('simulateColorblind keeps white and mid-gray, is deterministic and in range', () => {
  for (const kind of KINDS) {
    for (const gray of ['#ffffff', '#808080', '#000000']) {
      const [r, g, b] = hexToRgb(simulateColorblind(gray, kind));
      const [r0] = hexToRgb(gray);
      for (const v of [r, g, b]) assert.ok(Math.abs(v - r0) <= 1, `${kind} ${gray} -> ${v}`);
    }
    const a = simulateColorblind('#ff3d8b', kind);
    assert.equal(a, simulateColorblind('#ff3d8b', kind));
    for (const v of hexToRgb(a)) assert.ok(v >= 0 && v <= 255);
  }
});

test('matrix rows sum to 1', () => {
  for (const kind of KINDS) {
    const m = CVD_MATRICES[kind];
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(m[i * 3] + m[i * 3 + 1] + m[i * 3 + 2] - 1) < 1e-4, kind);
  }
});

test('unknown kind throws', () => {
  assert.throws(() => simulateColorblind('#fff', 'nope'));
});
