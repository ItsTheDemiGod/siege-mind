// Pure text for the volume sliders (aria-valuetext), so screen readers say "60 percent" instead of "0.6".

/** @param {*} v a volume in [0, 1] @returns {string} e.g. '60 percent'; out-of-range and non-numbers are clamped (NaN gives '0 percent') */
export function percentText(v) {
  const x = typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
  return `${Math.round(x * 100)} percent`;
}
