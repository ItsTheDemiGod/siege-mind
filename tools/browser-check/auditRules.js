// Pure audit rules: they take JSON snapshots extracted from a page (tools/browser-check/auditPage.js) and return violation lists. No browser, no DOM.
// The checks are a practical subset (names, roles, dialogs, ids, tab order, focus rings, focus traps, text contrast, overflow, reduced motion), not a full WCAG audit.
import { contrastRatio } from '../../src/render/color.js';

/** WCAG AA: 4.5 for normal text, 3 for large text (24 px, or 18.66 px and bold). */
export const CONTRAST = Object.freeze({ normal: 4.5, large: 3, largePx: 24, largeBoldPx: 18.66 });
const STATEFUL = new Set(['switch', 'radio', 'checkbox', 'slider']);

/** @param {{interactive?: {selector: string, name: string}[]}} s @returns {{selector: string}[]} interactive elements without an accessible name */
export const unnamedInteractive = (s) => (s.interactive ?? []).filter((e) => !String(e.name ?? '').trim()).map((e) => ({ selector: e.selector }));

/** @param {{interactive?: {selector: string, role: string | null, hasState: boolean}[]}} s @returns {{selector: string, role: string}[]} switches, radios, checkboxes and sliders without their state attribute */
export const badRoles = (s) => (s.interactive ?? []).filter((e) => STATEFUL.has(e.role) && !e.hasState).map((e) => ({ selector: e.selector, role: e.role }));

/** @param {{dialogs?: {selector: string, ariaModal: string | null, name: string}[]}} s @returns {{selector: string, problem: string}[]} */
export function dialogProblems(s) {
  const out = [];
  for (const d of s.dialogs ?? []) {
    if (d.ariaModal !== 'true') out.push({ selector: d.selector, problem: 'no aria-modal="true"' });
    if (!String(d.name ?? '').trim()) out.push({ selector: d.selector, problem: 'no accessible name' });
  }
  return out;
}

/** @param {{ids?: string[]}} s @returns {string[]} ids used more than once */
export function duplicateIds(s) {
  const seen = new Set();
  const dup = new Set();
  for (const id of s.ids ?? []) { if (seen.has(id)) dup.add(id); seen.add(id); }
  return [...dup].sort();
}

/** @param {{tabindexes?: {selector: string, tabindex: number}[]}} s @returns {{selector: string, tabindex: number}[]} */
export const positiveTabindex = (s) => (s.tabindexes ?? []).filter((e) => e.tabindex > 0);

/** @param {{selector: string, outlineStyle: string, outlineWidth: string, boxShadow: string}[]} samples focused elements @returns {{selector: string}[]} focus with no outline and no shadow */
export const focusRingMissing = (samples) => samples.filter((x) => (x.outlineStyle === 'none' || parseFloat(x.outlineWidth) === 0) && (x.boxShadow === 'none' || !x.boxShadow)).map((x) => ({ selector: x.selector }));

/** @param {{dialog: string, tabs: {inside: boolean, selector: string}[]}[]} samples @returns {{dialog: string, selector: string, step: number}[]} Tab presses where focus left the open dialog */
export function focusTrapEscapes(samples) {
  const out = [];
  for (const s of samples) s.tabs.forEach((t, i) => { if (!t.inside) out.push({ dialog: s.dialog, selector: t.selector, step: i + 1 }); });
  return out;
}

/** @param {number} fontPx @param {boolean} bold @returns {number} the minimum contrast ratio for this text */
export const minContrast = (fontPx, bold) => (fontPx >= CONTRAST.largePx || (bold && fontPx >= CONTRAST.largeBoldPx) ? CONTRAST.large : CONTRAST.normal);

/**
 * @param {{selector: string, text: string, fg: string | null, bg: string | null, fontPx: number, bold: boolean}[]} entries hex colors; bg null = could not be resolved
 * @param {(a: string, b: string) => number} [ratioOf] defaults to src/render/color.js contrastRatio
 * @returns {{failures: object[], unresolved: object[], checked: number}} unresolved entries are neither passes nor failures
 */
export function contrastProblems(entries, ratioOf = contrastRatio) {
  const failures = [];
  const unresolved = [];
  let checked = 0;
  for (const e of entries) {
    if (!e.fg || !e.bg) { unresolved.push({ selector: e.selector, text: e.text }); continue; }
    checked++;
    const ratio = ratioOf(e.fg, e.bg);
    const need = minContrast(e.fontPx, e.bold);
    if (ratio < need) failures.push({ selector: e.selector, text: e.text, ratio: Math.round(ratio * 100) / 100, need, fg: e.fg, bg: e.bg, fontPx: e.fontPx });
  }
  return { failures, unresolved, checked };
}

/** @param {{label: string, innerWidth: number, innerHeight: number, scrollWidth: number, stage: {left: number, top: number, right: number, bottom: number} | null}[]} samples @returns {{label: string, problem: string}[]} */
export function overflowProblems(samples) {
  const out = [];
  const eps = 0.5;
  for (const s of samples) {
    if (s.scrollWidth > s.innerWidth + eps) out.push({ label: s.label, problem: `horizontal overflow (${s.scrollWidth} > ${s.innerWidth})` });
    if (!s.stage) out.push({ label: s.label, problem: 'no stage found' });
    else if (s.stage.left < -eps || s.stage.top < -eps || s.stage.right > s.innerWidth + eps || s.stage.bottom > s.innerHeight + eps) out.push({ label: s.label, problem: `stage outside the viewport (${Math.round(s.stage.left)},${Math.round(s.stage.top)} to ${Math.round(s.stage.right)},${Math.round(s.stage.bottom)})` });
  }
  return out;
}

/** @param {{animations: number, reducedClass: boolean}} reduced the page with prefers-reduced-motion emulated @returns {string[]} problems */
export function motionProblems(reduced) {
  const out = [];
  if (!reduced.reducedClass) out.push('the reduced-motion class is not set although the OS asks for reduced motion');
  if (reduced.animations > 0) out.push(`${reduced.animations} CSS animations or transitions are still running`);
  return out;
}

/** @param {number[]} deltas frame times in ms @returns {{count: number, avgMs: number, p95Ms: number, maxMs: number}} */
export function frameSummary(deltas) {
  if (deltas.length === 0) return { count: 0, avgMs: 0, p95Ms: 0, maxMs: 0 };
  const sorted = [...deltas].sort((a, b) => a - b);
  const sum = deltas.reduce((a, b) => a + b, 0);
  return { count: deltas.length, avgMs: sum / deltas.length, p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))], maxMs: sorted[sorted.length - 1] };
}
