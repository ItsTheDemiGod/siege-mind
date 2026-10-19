import { test } from 'node:test';
import assert from 'node:assert/strict';

// bindKeys talks to window and Element: give Node minimal stand-ins before importing it.
class FakeElement { constructor(selectors = []) { this.selectors = selectors; this.isContentEditable = false; } matches(s) { return this.selectors.some((x) => s.includes(x)); } }
const listeners = [];
globalThis.Element = FakeElement;
globalThis.window = { addEventListener: (t, f) => listeners.push([t, f]), removeEventListener: (t, f) => { const i = listeners.findIndex((l) => l[0] === t && l[1] === f); if (i >= 0) listeners.splice(i, 1); } };
const { bindKeys } = await import('../src/ui/keys.js');

const press = (e) => { const ev = { ctrlKey: false, metaKey: false, altKey: false, repeat: false, target: null, preventDefault() { this.prevented = true; }, ...e }; for (const [, f] of [...listeners]) f(ev); return ev; };
const handlers = () => { const calls = []; return { calls, h: { togglePause: () => calls.push('pause'), setSpeed: (n) => calls.push(`speed${n}`), singleStep: () => calls.push('step'), toggleHud: () => calls.push('hud') } }; };

test('extra keys accept named keys (arrows, Enter, brackets) and lower-cased letters, and fire once per press', () => {
  const { calls, h } = handlers();
  const unbind = bindKeys(h, { ArrowLeft: () => calls.push('left'), Enter: () => calls.push('enter'), '[': () => calls.push('['), ']': () => calls.push(']'), m: () => calls.push('m') });
  press({ code: 'ArrowLeft', key: 'ArrowLeft' });
  press({ code: 'Enter', key: 'Enter' });
  press({ code: 'BracketLeft', key: '[' });
  press({ code: 'BracketRight', key: ']' });
  press({ code: 'KeyM', key: 'M' }); // shift or caps lock still matches
  press({ code: 'KeyM', key: 'm', repeat: true }); // auto-repeat is ignored
  assert.deepEqual(calls, ['left', 'enter', '[', ']', 'm']);
  unbind();
  press({ code: 'KeyM', key: 'm' });
  assert.equal(calls.length, 5);
});

test('keys are ignored with a modifier and while a button, input, select or editable element has focus', () => {
  const { calls, h } = handlers();
  bindKeys(h, { ArrowDown: () => calls.push('down'), m: () => calls.push('m') });
  press({ code: 'ArrowDown', key: 'ArrowDown', ctrlKey: true });
  press({ code: 'KeyM', key: 'm', metaKey: true });
  press({ code: 'KeyM', key: 'm', altKey: true });
  for (const sel of ['button', 'input', 'select', 'textarea', '[role="switch"]']) press({ code: 'ArrowDown', key: 'ArrowDown', target: new FakeElement([sel]) });
  const editable = new FakeElement(); editable.isContentEditable = true;
  press({ code: 'KeyM', key: 'm', target: editable });
  assert.deepEqual(calls, []);
  press({ code: 'ArrowDown', key: 'ArrowDown', target: new FakeElement(['div']) });
  assert.deepEqual(calls, ['down']);
});

test('the built-in keys still work: space pauses without scrolling, digits set the speed, N steps, backquote toggles the debug panel', () => {
  const { calls, h } = handlers();
  bindKeys(h, {});
  const space = press({ code: 'Space', key: ' ' });
  press({ code: 'Digit1', key: '1' }); press({ code: 'Digit2', key: '2' }); press({ code: 'Digit3', key: '3' });
  press({ code: 'KeyN', key: 'n' }); press({ code: 'Backquote', key: '`' });
  assert.equal(space.prevented, true);
  assert.deepEqual(calls, ['pause', 'speed1', 'speed2', 'speed3', 'step', 'hud']);
});
