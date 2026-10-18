import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventBus, EVENT_TYPES } from '../src/sim/events.js';

const T = EVENT_TYPES.ENEMY_KILLED;

test('handlers receive the payload and run in subscription order', () => {
  const bus = createEventBus();
  const log = [];
  bus.on(T, (p) => log.push(['a', p]));
  bus.on(T, (p) => log.push(['b', p]));
  bus.emit(T, 42);
  assert.deepEqual(log, [['a', 42], ['b', 42]]);
});

test('unsubscribe works', () => {
  const bus = createEventBus();
  let n = 0;
  const off = bus.on(T, () => n++);
  bus.emit(T);
  off();
  bus.emit(T);
  assert.equal(n, 1);
});

test('off removes a handler', () => {
  const bus = createEventBus();
  let n = 0;
  const h = () => n++;
  bus.on(T, h);
  bus.off(T, h);
  bus.emit(T);
  assert.equal(n, 0);
});

test('once fires a single time', () => {
  const bus = createEventBus();
  let n = 0;
  bus.once(T, () => n++);
  bus.emit(T);
  bus.emit(T);
  assert.equal(n, 1);
  assert.equal(bus.listenerCount(T), 0);
});

test('unsubscribing inside a handler during emit is safe', () => {
  const bus = createEventBus();
  const log = [];
  const offA = bus.on(T, () => { log.push('a'); offA(); });
  bus.on(T, () => log.push('b'));
  bus.emit(T);
  bus.emit(T);
  assert.deepEqual(log, ['a', 'b', 'b']);
});

test('a throwing handler does not stop others; onError is called', () => {
  const errors = [];
  const bus = createEventBus({ onError: (e, type) => errors.push([e.message, type]) });
  let ran = false;
  bus.on(T, () => { throw new Error('boom'); });
  bus.on(T, () => { ran = true; });
  bus.emit(T);
  assert.ok(ran);
  assert.deepEqual(errors, [['boom', T]]);
});

test('without onError a throwing handler is logged via console.error', (t) => {
  const spy = t.mock.method(console, 'error', () => {});
  const bus = createEventBus();
  bus.on(T, () => { throw new Error('x'); });
  bus.emit(T);
  assert.equal(spy.mock.callCount(), 1);
});

test('strict mode throws on unknown types; non-strict does not', () => {
  const strict = createEventBus();
  assert.throws(() => strict.on('nope', () => {}));
  assert.throws(() => strict.emit('nope'));
  const loose = createEventBus({ strict: false });
  let got;
  loose.on('custom', (p) => { got = p; });
  loose.emit('custom', 5);
  assert.equal(got, 5);
});

test('listenerCount and clear work', () => {
  const bus = createEventBus();
  bus.on(T, () => {});
  bus.on(T, () => {});
  assert.equal(bus.listenerCount(T), 2);
  bus.clear();
  assert.equal(bus.listenerCount(T), 0);
});

test('EVENT_TYPES is frozen', () => {
  assert.ok(Object.isFrozen(EVENT_TYPES));
});
