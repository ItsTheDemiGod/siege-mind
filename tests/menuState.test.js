import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSeedInput, shouldShowMenu, buildPlayUrl, buildMenuUrl, parseModeParam } from '../src/ui/menuState.js';

test('parseSeedInput: empty, integers and boundaries', () => {
  assert.deepEqual(parseSeedInput(''), { ok: false, reason: 'empty' });
  assert.deepEqual(parseSeedInput('   '), { ok: false, reason: 'empty' });
  assert.deepEqual(parseSeedInput(undefined), { ok: false, reason: 'empty' });
  assert.deepEqual(parseSeedInput('0'), { ok: true, seed: 0 });
  assert.deepEqual(parseSeedInput(' 12345 '), { ok: true, seed: 12345 });
  assert.deepEqual(parseSeedInput('4294967295'), { ok: true, seed: 4294967295 });
  assert.deepEqual(parseSeedInput('4294967296'), { ok: false, reason: 'too_large' });
  assert.deepEqual(parseSeedInput('9'.repeat(40)), { ok: false, reason: 'too_large' });
  assert.deepEqual(parseSeedInput('007'), { ok: true, seed: 7 });
});

test('parseSeedInput: text seeds, allowed characters and the 24 character limit', () => {
  assert.deepEqual(parseSeedInput('hello_world-2'), { ok: true, seed: 'hello_world-2' });
  assert.deepEqual(parseSeedInput('a'.repeat(24)), { ok: true, seed: 'a'.repeat(24) });
  assert.deepEqual(parseSeedInput('a'.repeat(25)), { ok: false, reason: 'too_long' });
  for (const bad of ['has space', 'semi;colon', 'ünï', 'a/b', '-5.5', 'x y']) assert.deepEqual(parseSeedInput(bad), { ok: false, reason: 'bad_chars' }, bad);
  assert.deepEqual(parseSeedInput('-5'), { ok: true, seed: '-5' }); // hyphen text, not a number
});

test('shouldShowMenu truth table', () => {
  const p = (q) => new URLSearchParams(q);
  assert.equal(shouldShowMenu(p('')), true);
  assert.equal(shouldShowMenu(p('play=1')), false);
  assert.equal(shouldShowMenu(p('debug=1')), false);
  assert.equal(shouldShowMenu(p('play=1&debug=1')), false);
  assert.equal(shouldShowMenu(p('seed=5')), true);
  assert.equal(shouldShowMenu(p('seed=5&mode=static&waves=15')), true);
});

test('buildPlayUrl replaces or adds parameters, preserves the others and the hash', () => {
  assert.equal(buildPlayUrl('http://x.test/', { seed: 5, mode: 'static', waves: 15 }), 'http://x.test/?seed=5&mode=static&waves=15&play=1');
  assert.equal(buildPlayUrl('http://x.test/?seed=1&waves=30&foo=bar#top', { seed: 'abc', mode: 'static', waves: 15 }), 'http://x.test/?seed=abc&waves=15&foo=bar&mode=static&play=1#top');
  const u = new URL(buildPlayUrl('http://x.test/?play=1&gold=9', { seed: 4294967295, mode: 'static', waves: 30 }));
  assert.equal(u.searchParams.get('seed'), '4294967295');
  assert.equal(u.searchParams.get('gold'), '9');
  assert.equal(u.searchParams.getAll('play').length, 1);
});

test('buildMenuUrl removes the play/debug parameters and keeps seed, mode, waves and the hash', () => {
  const href = 'http://x.test/g.html?seed=7&mode=static&waves=15&play=1&debug=1&stress=1&wave=12&gold=500&spawn=3&startlives=5&keep=me#frag';
  assert.equal(buildMenuUrl(href), 'http://x.test/g.html?seed=7&mode=static&waves=15&keep=me#frag');
  assert.equal(buildMenuUrl('http://x.test/'), 'http://x.test/');
});

test('parseModeParam: absent and empty are Static, known modes are case-insensitive, anything else falls back with ok false', () => {
  const table = [
    [null, true, 'static'], [undefined, true, 'static'], ['', true, 'static'], ['  ', true, 'static'],
    ['static', true, 'static'], ['adaptive', true, 'adaptive'], ['random', true, 'random'],
    [' Adaptive ', true, 'adaptive'], ['RANDOM', true, 'random'], ['Static', true, 'static'],
    ['hard', false, 'static'], ['adaptiv', false, 'static'], ['1', false, 'static'], ['static;adaptive', false, 'static'],
  ];
  for (const [input, ok, mode] of table) assert.deepEqual(parseModeParam(input), { ok, mode }, String(input));
});
