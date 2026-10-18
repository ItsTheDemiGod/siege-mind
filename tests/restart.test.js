import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRestartUrl } from '../src/ui/restart.js';

test('replaces an existing seed in place and keeps the other parameters in order', () => {
  assert.equal(buildRestartUrl('http://localhost:8137/?debug=1&seed=5&gold=500', { seed: 9 }), 'http://localhost:8137/?debug=1&seed=9&gold=500');
});

test('adds a missing seed', () => {
  assert.equal(buildRestartUrl('http://localhost:8137/', { seed: 42 }), 'http://localhost:8137/?seed=42');
  assert.equal(buildRestartUrl('http://localhost:8137/?debug=1&wave=12', { seed: 3 }), 'http://localhost:8137/?debug=1&wave=12&seed=3');
});

test('preserves the hash fragment and the path', () => {
  assert.equal(buildRestartUrl('http://localhost:8137/game.html?a=1#top', { seed: 2 }), 'http://localhost:8137/game.html?a=1&seed=2#top');
});

test('accepts integer and string seeds', () => {
  assert.equal(new URL(buildRestartUrl('http://x.test/?stress=1', { seed: 123456789 })).searchParams.get('seed'), '123456789');
  assert.equal(new URL(buildRestartUrl('http://x.test/', { seed: 'hello world' })).searchParams.get('seed'), 'hello world');
  assert.equal(new URL(buildRestartUrl('http://x.test/?stress=1&debug=1', { seed: 'a' })).searchParams.get('stress'), '1');
});
