// Pure: where a large dialog (end card, Director report) sits so it clears the HUD strip and the bottom edge.

/**
 * @param {{stageH: number, hudH: number, margin: number}} o logical stage height, HUD strip height and margin
 * @returns {{top: number, maxHeight: number}}
 * @throws {RangeError} for non-finite or non-positive input, or when no room is left
 */
export function endCardLayout({ stageH, hudH, margin }) {
  for (const [name, v] of Object.entries({ stageH, hudH, margin })) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) throw new RangeError(`endCardLayout: ${name} must be a positive finite number, got ${String(v)}`);
  }
  const maxHeight = stageH - hudH - 2 * margin;
  if (maxHeight <= 0) throw new RangeError('endCardLayout: no room below the HUD strip');
  return { top: hudH + margin, maxHeight };
}
