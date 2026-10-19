// Page-side functions of the audit. Each one is serialized with Function.prototype.toString and evaluated inside the page, so it must not use anything
// outside its own body. They only read the DOM.

/** @returns {object} a JSON snapshot of the interactive elements, dialogs, ids, tab indexes and text colors of the current page */
export function snapshot() {
  const MAX_CONTRAST = 700;
  const visible = (el) => {
    if (el.closest('[hidden], [aria-hidden="true"]')) return false;
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.classList.length ? `.${[...el.classList].slice(0, 2).join('.')}` : '');
  const nameOf = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();
    const by = el.getAttribute('aria-labelledby');
    if (by) { const t = by.split(/\s+/).map((id) => (document.getElementById(id) ? document.getElementById(id).textContent : '')).join(' ').trim(); if (t) return t; }
    if (el.labels && el.labels.length) { const t = [...el.labels].map((l) => l.textContent).join(' ').trim(); if (t) return t; }
    const lab = el.closest('label');
    if (lab && lab.textContent.trim()) return lab.textContent.trim();
    const tx = (el.textContent || '').trim();
    if (tx) return tx;
    return (el.getAttribute('title') || el.getAttribute('alt') || '').trim();
  };
  const roleOf = (el) => {
    const r = el.getAttribute('role');
    if (r) return r;
    if (el.tagName === 'INPUT') return { range: 'slider', checkbox: 'checkbox', radio: 'radio' }[el.type] || null;
    return null;
  };
  const hasState = (el, role) => {
    if (role === 'slider') return el.hasAttribute('aria-valuenow') || el.hasAttribute('aria-valuetext') || (el.tagName === 'INPUT' && el.type === 'range');
    return el.hasAttribute('aria-checked') || (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio'));
  };
  const interactive = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="switch"], [role="radio"], [role="slider"], [role="checkbox"], [tabindex]:not([tabindex="-1"])')]
    .filter(visible).map((el) => { const role = roleOf(el); return { selector: sel(el), role, name: nameOf(el), hasState: hasState(el, role) }; });
  const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible).map((d) => ({ selector: sel(d), ariaModal: d.getAttribute('aria-modal'), name: nameOf(d) && (d.getAttribute('aria-label') || (d.getAttribute('aria-labelledby') ? nameOf(d) : '')) }));
  const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
  const tabindexes = [...document.querySelectorAll('[tabindex]')].map((e) => ({ selector: sel(e), tabindex: Number(e.getAttribute('tabindex')) })).filter((e) => Number.isFinite(e.tabindex));

  const parse = (s) => {
    if (!s || s === 'transparent') return [0, 0, 0, 0];
    let m = /^rgba?\(([^)]+)\)$/.exec(s);
    if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    m = /^color\(srgb ([^)]+)\)$/.exec(s);
    if (m) { const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; }
    return null;
  };
  const over = (top, bottom) => { const a = top[3] + bottom[3] * (1 - top[3]); return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / (a || 1)).concat([a]); };
  const hex = (c) => `#${[0, 1, 2].map((i) => Math.max(0, Math.min(255, Math.round(c[i]))).toString(16).padStart(2, '0')).join('')}`;
  const effectiveBg = (el) => {
    const chain = [];
    for (let e = el; e; e = e.parentElement) chain.push(parse(getComputedStyle(e).backgroundColor));
    let base = null;
    for (let i = chain.length - 1; i >= 0; i--) {
      const l = chain[i];
      if (!l || l[3] === 0) continue;
      if (l[3] >= 0.999) base = l; else if (base) base = over(l, base);
    }
    return base;
  };
  const contrast = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n && contrast.length < MAX_CONTRAST; n = walker.nextNode()) {
    const text = n.textContent.trim();
    const el = n.parentElement;
    if (!text || !el || ['SCRIPT', 'STYLE', 'OPTION'].includes(el.tagName) || el.closest('svg') || !visible(el)) continue;
    const cs = getComputedStyle(el);
    const bg = effectiveBg(el);
    let fg = parse(cs.color);
    if (fg && bg && fg[3] < 1) fg = over(fg, bg);
    const key = `${sel(el)}|${cs.color}|${cs.fontSize}|${cs.fontWeight}`;
    if (seen.has(key)) continue;
    seen.add(key);
    contrast.push({ selector: sel(el), text: text.slice(0, 40), fg: fg ? hex(fg) : null, bg: bg ? hex(bg) : null, fontPx: parseFloat(cs.fontSize), bold: Number(cs.fontWeight) >= 700 });
  }
  return { interactive, dialogs, ids, tabindexes, contrast };
}

/** @returns {{selector: string, outlineStyle: string, outlineWidth: string, boxShadow: string}} the focused element's focus-ring styles */
export function focusSample() {
  const el = document.activeElement;
  const cs = getComputedStyle(el);
  return { selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.classList.length ? `.${[...el.classList].slice(0, 2).join('.')}` : ''), outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, boxShadow: cs.boxShadow };
}

/** @returns {{inside: boolean, selector: string, dialog: string | null}} whether the focused element is inside the topmost open dialog */
export function trapSample() {
  const dialogs = [...document.querySelectorAll('[role="dialog"]')];
  const top = dialogs[dialogs.length - 1] || null;
  const el = document.activeElement;
  return { inside: !!top && top.contains(el), selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.classList.length ? `.${[...el.classList].slice(0, 2).join('.')}` : ''), dialog: top ? (top.getAttribute('aria-labelledby') || top.className) : null };
}

/** @returns {{width: number, height: number, innerWidth: number, innerHeight: number, scrollWidth: number, stage: object | null, animations: number, reducedClass: boolean}} layout and motion facts */
export function layoutSample() {
  const c = document.getElementById('game');
  const r = c ? c.getBoundingClientRect() : null;
  return {
    innerWidth: window.innerWidth, innerHeight: window.innerHeight, scrollWidth: document.documentElement.scrollWidth,
    stage: r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null,
    animations: document.getAnimations().length, reducedClass: document.documentElement.classList.contains('reduced-motion'),
  };
}

/** @param {number} warmupMs @param {number} sampleMs @returns {Promise<number[]>} requestAnimationFrame deltas in ms after the warm-up */
export function sampleFrames(warmupMs, sampleMs) {
  return new Promise((resolve) => {
    const deltas = [];
    let last = null;
    let start = null;
    const step = (now) => {
      if (start === null) start = now;
      if (last !== null && now - start > warmupMs) deltas.push(now - last);
      last = now;
      if (now - start < warmupMs + sampleMs) requestAnimationFrame(step); else resolve(deltas);
    };
    requestAnimationFrame(step);
  });
}
