import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  unnamedInteractive, badRoles, dialogProblems, duplicateIds, positiveTabindex, focusRingMissing, focusTrapEscapes, contrastProblems, minContrast,
  overflowProblems, motionProblems, frameSummary,
} from '../tools/browser-check/auditRules.js';
import { auditMarkdown, auditTotals, evaluateState } from '../tools/browser-check/auditReport.js';
import { contrastRatio } from '../src/render/color.js';

test('unnamedInteractive flags empty and blank names only', () => {
  const s = { interactive: [{ selector: 'button#a', name: 'Close' }, { selector: 'button#b', name: '' }, { selector: 'input#c', name: '   ' }, { selector: 'a#d' }] };
  assert.deepEqual(unnamedInteractive(s).map((x) => x.selector), ['button#b', 'input#c', 'a#d']);
  assert.deepEqual(unnamedInteractive({ interactive: [{ selector: 'x', name: 'ok' }] }), []);
  assert.deepEqual(unnamedInteractive({}), []);
});

test('badRoles flags switches, radios, checkboxes and sliders without state and ignores buttons', () => {
  const s = { interactive: [
    { selector: 'a', role: 'switch', hasState: false }, { selector: 'b', role: 'switch', hasState: true }, { selector: 'c', role: 'radio', hasState: false },
    { selector: 'd', role: 'slider', hasState: false }, { selector: 'e', role: 'checkbox', hasState: false }, { selector: 'f', role: 'button', hasState: false }, { selector: 'g', role: null, hasState: false },
  ] };
  assert.deepEqual(badRoles(s).map((x) => x.selector), ['a', 'c', 'd', 'e']);
  assert.deepEqual(badRoles({ interactive: [{ selector: 'ok', role: 'slider', hasState: true }] }), []);
});

test('dialogProblems needs aria-modal true and a name', () => {
  const s = { dialogs: [{ selector: 'ok', ariaModal: 'true', name: 'Settings' }, { selector: 'nomodal', ariaModal: null, name: 'X' }, { selector: 'noname', ariaModal: 'true', name: '' }, { selector: 'both', ariaModal: 'false', name: ' ' }] };
  assert.deepEqual(dialogProblems(s), [
    { selector: 'nomodal', problem: 'no aria-modal="true"' }, { selector: 'noname', problem: 'no accessible name' },
    { selector: 'both', problem: 'no aria-modal="true"' }, { selector: 'both', problem: 'no accessible name' },
  ]);
  assert.deepEqual(dialogProblems({ dialogs: [{ selector: 'ok', ariaModal: 'true', name: 'N' }] }), []);
});

test('duplicateIds lists each repeated id once, sorted', () => {
  assert.deepEqual(duplicateIds({ ids: ['b', 'a', 'b', 'c', 'a', 'b'] }), ['a', 'b']);
  assert.deepEqual(duplicateIds({ ids: ['a', 'b'] }), []);
  assert.deepEqual(duplicateIds({}), []);
});

test('positiveTabindex flags only values above 0', () => {
  assert.deepEqual(positiveTabindex({ tabindexes: [{ selector: 'a', tabindex: 0 }, { selector: 'b', tabindex: -1 }, { selector: 'c', tabindex: 3 }] }).map((x) => x.selector), ['c']);
  assert.deepEqual(positiveTabindex({}), []);
});

test('focusRingMissing needs both no outline and no shadow to flag', () => {
  const ring = { outlineStyle: 'solid', outlineWidth: '2px', boxShadow: 'none' };
  assert.deepEqual(focusRingMissing([{ selector: 'ok1', ...ring }, { selector: 'ok2', outlineStyle: 'none', outlineWidth: '0px', boxShadow: 'rgb(0, 0, 0) 0px 0px 4px' },
    { selector: 'bad1', outlineStyle: 'none', outlineWidth: '0px', boxShadow: 'none' }, { selector: 'bad2', outlineStyle: 'solid', outlineWidth: '0px', boxShadow: 'none' }]).map((x) => x.selector), ['bad1', 'bad2']);
});

test('focusTrapEscapes reports the Tab presses where focus left the dialog', () => {
  const samples = [{ dialog: 'settings', tabs: [{ inside: true, selector: 'a' }, { inside: false, selector: 'body' }, { inside: true, selector: 'b' }] }, { dialog: 'pause', tabs: [{ inside: true, selector: 'c' }] }];
  assert.deepEqual(focusTrapEscapes(samples), [{ dialog: 'settings', selector: 'body', step: 2 }]);
  assert.deepEqual(focusTrapEscapes([]), []);
});

test('minContrast: 4.5 for normal text, 3 for large (24 px, or 18.66 px and bold)', () => {
  assert.equal(minContrast(14, false), 4.5);
  assert.equal(minContrast(18, true), 4.5);
  assert.equal(minContrast(18.66, true), 3);
  assert.equal(minContrast(24, false), 3);
  assert.equal(minContrast(23.9, false), 4.5);
});

test('contrastProblems separates failures, passes and unresolved backgrounds', () => {
  const e = (selector, fg, bg, fontPx = 14, bold = false) => ({ selector, text: selector, fg, bg, fontPx, bold });
  const r = contrastProblems([
    e('white-on-black', '#ffffff', '#000000'), // 21:1 pass
    e('grey-on-white', '#777777', '#ffffff'), // 4.48:1 fails normal
    e('grey-large', '#777777', '#ffffff', 24), // passes as large text
    e('unresolved', '#ffffff', null), e('nofg', null, '#000000'),
  ]);
  assert.equal(r.checked, 3);
  assert.deepEqual(r.failures.map((x) => x.selector), ['grey-on-white']);
  assert.equal(r.failures[0].need, 4.5);
  assert.ok(r.failures[0].ratio < 4.5 && r.failures[0].ratio > 4.4);
  assert.deepEqual(r.unresolved.map((x) => x.selector), ['unresolved', 'nofg']);
  assert.equal(contrastProblems([e('x', '#ffffff', '#000000')], () => 2).failures.length, 1); // the ratio function is injectable
  assert.ok(Math.abs(contrastRatio('#ffffff', '#000000') - 21) < 1e-9);
});

test('overflowProblems flags horizontal scroll and a stage outside the viewport', () => {
  const ok = { label: '1280x720', innerWidth: 1280, innerHeight: 720, scrollWidth: 1280, stage: { left: 0, top: 0, right: 1280, bottom: 720 } };
  assert.deepEqual(overflowProblems([ok]), []);
  assert.deepEqual(overflowProblems([{ ...ok, scrollWidth: 1300 }]).map((x) => x.problem), ['horizontal overflow (1300 > 1280)']);
  assert.match(overflowProblems([{ ...ok, stage: { left: -5, top: 0, right: 1280, bottom: 720 } }])[0].problem, /stage outside the viewport/);
  assert.match(overflowProblems([{ ...ok, stage: { left: 0, top: 0, right: 1280, bottom: 800 } }])[0].problem, /stage outside the viewport/);
  assert.deepEqual(overflowProblems([{ ...ok, stage: null }]).map((x) => x.problem), ['no stage found']);
});

test('motionProblems wants the class and no running animations under reduced motion', () => {
  assert.deepEqual(motionProblems({ animations: 0, reducedClass: true }), []);
  assert.equal(motionProblems({ animations: 2, reducedClass: true }).length, 1);
  assert.equal(motionProblems({ animations: 0, reducedClass: false }).length, 1);
});

test('frameSummary gives count, average, p95 and max', () => {
  const d = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.deepEqual(frameSummary(d), { count: 100, avgMs: 50.5, p95Ms: 96, maxMs: 100 });
  assert.deepEqual(frameSummary([]), { count: 0, avgMs: 0, p95Ms: 0, maxMs: 0 });
});

test('the report lists findings per state, totals them and always carries the performance caveat', () => {
  const clean = { name: 'Clean', snapshot: { contrast: [] } };
  const bad = { name: 'Bad', snapshot: { interactive: [{ selector: 'button#x', name: '' }], ids: ['a', 'a'], contrast: [{ selector: 'p', text: 't', fg: '#777777', bg: '#ffffff', fontPx: 14, bold: false }, { selector: 'q', text: 'u', fg: '#ffffff', bg: null, fontPx: 14, bold: false }] }, escapeCloses: false };
  assert.equal(Object.values(evaluateState(clean).findings).flat().length, 0);
  const r = { states: [clean, bad], sizes: [{ label: '800x600', innerWidth: 800, innerHeight: 600, scrollWidth: 900, stage: { left: 0, top: 0, right: 800, bottom: 450 } }], motion: { normal: { animations: 3 }, reduced: { animations: 0, reducedClass: true } },
    perf: [{ quality: 'high', count: 10, avgMs: 20, p95Ms: 33.3, maxMs: 40, enemies: 5 }], meta: { generatedBy: 'test' } };
  const md = auditMarkdown(r);
  assert.ok(md.includes('## Clean') && md.includes('none'));
  assert.ok(md.includes('Interactive elements without a name') && md.includes('**Duplicate ids** (1)') && md.includes('- a'));
  assert.ok(md.includes('Escape did not close the dialog'));
  assert.ok(md.includes('1 unresolved') || md.includes('1 text entries checked, 1 unresolved'));
  assert.ok(md.includes('measured in headless Chrome without a GPU on this machine: an upper bound on frame time') || md.includes('Measured in headless Chrome without a GPU on this machine: an upper bound on frame time'));
  assert.ok(md.includes('| high | 10 | 20.0 | 33.3 | 40.0 | 5 |'));
  assert.deepEqual(auditTotals(r), { violations: 1 + 1 + 1 + 1 + 1, unresolved: 1 }); // name, duplicate id, contrast, escape, overflow
});
