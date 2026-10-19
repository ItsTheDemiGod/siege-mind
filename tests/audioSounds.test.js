import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SOUNDS, KILL_PITCH, FIRE_SOUND, IMPACT_SOUND } from '../src/audio/sounds.js';
import { audioConfig } from '../src/audio/audioConfig.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { TOWER_ORDER } from '../src/data/towers.js';

const CATEGORIES = Object.keys(audioConfig.minGapMsByCategory);
const list = Object.values(SOUNDS);
const WAVES = ['sine', 'triangle', 'square', 'sawtooth'];
const FILTERS = ['lowpass', 'highpass', 'bandpass'];
const inRange = (f) => Number.isFinite(f) && f >= 20 && f <= 12000;

test('the catalogue has unique ids that match their keys, valid categories and priorities', () => {
  assert.equal(new Set(list.map((s) => s.id)).size, list.length);
  for (const [k, s] of Object.entries(SOUNDS)) {
    assert.equal(k, s.id);
    assert.ok(CATEGORIES.includes(s.category), s.id);
    assert.ok([1, 2, 3].includes(s.priority), s.id);
    assert.ok(Number.isInteger(s.maxVoices) && s.maxVoices >= 1 && Number.isFinite(s.minIntervalMs) && s.minIntervalMs >= 0, s.id);
  }
  for (const id of ['uiClick', 'towerSelect', 'uiDeny', 'pauseOn', 'pauseOff', 'speedChange', 'towerPlace', 'towerUpgrade', 'towerSell', 'impactShell', 'impactCloud', 'impactSpark', 'enemySpawn', 'killSmall', 'killMedium', 'killLarge', 'shieldedKill', 'waveStart', 'waveClear', 'directorSweep', 'leak', 'lifeLost', 'victory', 'defeat']) assert.ok(SOUNDS[id], id);
});

test('every sound has sane gain, duration and 1-4 layers with in-range numbers that fit the duration', () => {
  for (const s of list) {
    assert.ok(s.gain > 0 && s.gain <= 0.9, `${s.id} gain`);
    assert.ok(Number.isFinite(s.duration) && s.duration > 0 && s.duration <= 2.0, `${s.id} duration`);
    assert.ok(s.layers.length >= 1 && s.layers.length <= 4, `${s.id} layers`);
    for (const l of s.layers) {
      for (const k of ['at', 'attack', 'decay', 'gain']) assert.ok(Number.isFinite(l[k]) && l[k] >= 0, `${s.id} ${k}`);
      assert.ok(l.attack > 0 && l.decay > 0 && l.gain > 0 && l.gain <= 1, `${s.id} envelope`);
      assert.ok(l.at + l.attack + l.decay <= s.duration + 0.001, `${s.id}: a layer ends after the sound`);
      if (l.kind === 'osc') {
        assert.ok(WAVES.includes(l.wave), s.id);
        assert.ok(inRange(l.freq) && (l.freqEnd === undefined || inRange(l.freqEnd)), `${s.id} freq`);
        if (l.vibrato) assert.ok(l.vibrato.rate > 0 && l.vibrato.rate < 40 && l.vibrato.depth > 0, s.id);
      } else {
        assert.equal(l.kind, 'noise');
        assert.ok(FILTERS.includes(l.filter.type) && inRange(l.filter.freq) && (l.filter.freqEnd === undefined || inRange(l.filter.freqEnd)) && l.filter.q > 0, `${s.id} filter`);
      }
    }
  }
});

test('the five fire sounds are pairwise distinct (dominant layer, start frequency in octaves, duration)', () => {
  // The descriptor of a sound is its loudest layer: label (noise filter or oscillator wave), start frequency and the sound length.
  // Distance = 1 if the labels differ + octaves between the start frequencies + 4 * the length difference in seconds. Two sounds closer than 1.0 would
  // be hard to tell apart by ear (same timbre within one octave and nearly the same length), so 1.0 is the minimum.
  const desc = (s) => { const l = [...s.layers].sort((a, b) => b.gain - a.gain)[0]; return { label: l.kind === 'noise' ? `noise:${l.filter.type}` : l.wave, f: l.kind === 'noise' ? l.filter.freq : l.freq, d: s.duration }; };
  const dist = (a, b) => (a.label === b.label ? 0 : 1) + Math.abs(Math.log2(a.f / b.f)) + 4 * Math.abs(a.d - b.d);
  const fire = Object.values(FIRE_SOUND).map((id) => desc(SOUNDS[id]));
  for (let i = 0; i < fire.length; i++) for (let j = i + 1; j < fire.length; j++) assert.ok(dist(fire[i], fire[j]) >= 1.0, `${Object.values(FIRE_SOUND)[i]} vs ${Object.values(FIRE_SOUND)[j]}: ${dist(fire[i], fire[j])}`);
});

test('KILL_PITCH covers the enemies and falls with the enemy radius; FIRE_SOUND and IMPACT_SOUND point at real sounds', () => {
  assert.deepEqual(Object.keys(KILL_PITCH).sort(), [...ENEMY_ORDER].sort());
  const byRadius = ENEMY_ORDER.map((t) => ({ r: ENEMIES[t].radius, p: KILL_PITCH[t] })).sort((a, b) => a.r - b.r);
  for (let i = 1; i < byRadius.length; i++) assert.ok(byRadius[i].p < byRadius[i - 1].p, 'bigger enemies sound lower');
  assert.deepEqual(Object.keys(FIRE_SOUND).sort(), [...TOWER_ORDER].sort());
  for (const id of [...Object.values(FIRE_SOUND), ...Object.values(IMPACT_SOUND)]) assert.ok(SOUNDS[id], id);
});

test('the pure audio modules use no pow, exp or log (plain arithmetic only)', () => {
  const dir = fileURLToPath(new URL('../src/audio/', import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) assert.ok(!/Math\.(pow|exp|log)/.test(readFileSync(dir + f, 'utf8')), f);
});
