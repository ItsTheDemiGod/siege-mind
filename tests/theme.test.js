import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEME, cssVariables } from '../src/render/theme.js';
import { contrastRatio, deltaE76, hexToRgb } from '../src/render/color.js';

const { colors, enemy, tower } = THEME;

test('every color is valid hex', () => {
  for (const group of [colors, enemy, tower]) for (const v of Object.values(group)) assert.doesNotThrow(() => hexToRgb(v));
});

test('text and muted are readable on bg0 and panel (>= 4.5)', () => {
  for (const fg of [colors.text, colors.muted]) {
    for (const bg of [colors.bg0, colors.panel]) assert.ok(contrastRatio(fg, bg) >= 4.5, `${fg} on ${bg}`);
  }
});

test('enemy, defense, director and danger colors reach 3:1 on bg0', () => {
  const list = [
    ...Object.values(enemy), colors.primary, colors.secondary, colors.tertiary, colors.whiteHot, colors.director, colors.danger, colors.gold,
  ];
  for (const c of list) assert.ok(contrastRatio(c, colors.bg0) >= 3, `${c}: ${contrastRatio(c, colors.bg0)}`);
});

test('the five enemy colors are pairwise distinct (deltaE76 >= 25)', () => {
  const ids = ['armoredGrunt', 'swarmling', 'fastRunner', 'regenerator', 'shieldedBruiser'];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const d = deltaE76(enemy[ids[i]], enemy[ids[j]]);
      assert.ok(d >= 25, `${ids[i]} vs ${ids[j]}: ${d}`);
    }
  }
});

test('style.css :root matches cssVariables() exactly', () => {
  const css = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');
  const root = /:root\s*{([^}]*)}/.exec(css)[1];
  const parsed = {};
  for (const m of root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) parsed[m[1]] = m[2].trim();
  const expected = cssVariables();
  for (const [k, v] of Object.entries(expected)) assert.equal(parsed[k], v, k);
  assert.deepEqual(Object.keys(parsed).sort(), Object.keys(expected).sort());
});

test('tower accents come from the Defense family', () => {
  const defense = new Set([colors.primary, colors.secondary, colors.tertiary, colors.whiteHot]);
  for (const c of Object.values(tower)) assert.ok(defense.has(c));
});
