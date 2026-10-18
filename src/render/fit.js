// Canvas fitting: largest letterboxed size that keeps the logical aspect ratio, DPR-aware.

/**
 * Compute canvas CSS and backing sizes for a window.
 * @param {number} windowWidth
 * @param {number} windowHeight
 * @param {number} logicalWidth
 * @param {number} logicalHeight
 * @param {number} devicePixelRatio
 * @param {number} maxDpr - upper clamp for the DPR
 * @returns {{cssWidth: number, cssHeight: number, backingWidth: number, backingHeight: number, scale: number, dpr: number}}
 */
export function computeFit(windowWidth, windowHeight, logicalWidth, logicalHeight, devicePixelRatio, maxDpr) {
  const cssScale = Math.min(windowWidth / logicalWidth, windowHeight / logicalHeight);
  const cssWidth = logicalWidth * cssScale;
  const cssHeight = logicalHeight * cssScale;
  const dpr = Math.min(Math.max(devicePixelRatio || 1, 1), maxDpr);
  return {
    cssWidth,
    cssHeight,
    backingWidth: Math.round(cssWidth * dpr),
    backingHeight: Math.round(cssHeight * dpr),
    scale: cssScale * dpr, // logical unit -> backing pixel
    dpr,
  };
}

/**
 * Apply a fit to a canvas so drawing code can use logical coordinates.
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<typeof computeFit>} fit
 * @param {number} logicalWidth
 * @param {number} logicalHeight
 * @returns {void}
 */
export function applyFit(canvas, ctx, fit, logicalWidth, logicalHeight) {
  canvas.style.width = `${fit.cssWidth}px`;
  canvas.style.height = `${fit.cssHeight}px`;
  canvas.width = fit.backingWidth;
  canvas.height = fit.backingHeight;
  ctx.setTransform(fit.backingWidth / logicalWidth, 0, 0, fit.backingHeight / logicalHeight, 0, 0);
}
