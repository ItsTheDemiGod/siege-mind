// Canvas fitting: largest letterboxed size that keeps the logical aspect ratio, DPR-aware with a backing-pixel budget.

/**
 * Compute canvas CSS and backing sizes for a window.
 * @param {number} windowWidth
 * @param {number} windowHeight
 * @param {number} logicalWidth
 * @param {number} logicalHeight
 * @param {number} devicePixelRatio
 * @param {number} maxDpr - upper clamp for the DPR
 * @param {number} [maxBackingPixels] - pixel budget; dpr is reduced (never below 1) to stay within it
 * @returns {{cssWidth: number, cssHeight: number, cssScale: number, backingWidth: number, backingHeight: number, scale: number, dpr: number}}
 */
export function computeFit(windowWidth, windowHeight, logicalWidth, logicalHeight, devicePixelRatio, maxDpr, maxBackingPixels = Infinity) {
  const cssScale = Math.min(windowWidth / logicalWidth, windowHeight / logicalHeight);
  const cssWidth = logicalWidth * cssScale;
  const cssHeight = logicalHeight * cssScale;
  let dpr = Math.min(Math.max(devicePixelRatio || 1, 1), maxDpr);
  if (cssWidth * cssHeight * dpr * dpr > maxBackingPixels) {
    dpr = Math.max(1, Math.sqrt(maxBackingPixels / (cssWidth * cssHeight)));
  }
  return {
    cssWidth,
    cssHeight,
    cssScale, // logical unit -> CSS px (used to scale the DOM overlay)
    backingWidth: Math.round(cssWidth * dpr),
    backingHeight: Math.round(cssHeight * dpr),
    scale: cssScale * dpr, // logical unit -> backing pixel
    dpr,
  };
}

/**
 * Apply a fit: size the canvas and its stage, scale the DOM overlay, and set the draw transform to logical coordinates.
 * @param {HTMLCanvasElement} canvas - its parent is the #stage; an optional #ui-root inside it is scaled too
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<typeof computeFit>} fit
 * @param {number} logicalWidth
 * @param {number} logicalHeight
 * @returns {void}
 */
export function applyFit(canvas, ctx, fit, logicalWidth, logicalHeight) {
  const stage = canvas.parentElement;
  if (stage) {
    stage.style.width = `${fit.cssWidth}px`;
    stage.style.height = `${fit.cssHeight}px`;
    const ui = stage.querySelector('#ui-root');
    if (ui) ui.style.transform = `scale(${fit.cssScale})`;
  }
  canvas.style.width = `${fit.cssWidth}px`;
  canvas.style.height = `${fit.cssHeight}px`;
  canvas.width = fit.backingWidth;
  canvas.height = fit.backingHeight;
  ctx.setTransform(fit.backingWidth / logicalWidth, 0, 0, fit.backingHeight / logicalHeight, 0, 0);
}
