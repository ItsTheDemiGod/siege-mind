// Pure two-click confirmation: the first click arms, a second click within the window confirms.

/**
 * @param {number} windowSeconds
 * @returns {{click: (nowSeconds: number) => 'arm'|'confirm', armed: (nowSeconds: number) => boolean, reset: () => void}}
 */
export function createConfirmClick(windowSeconds) {
  let armedAt = null;
  const isArmed = (now) => armedAt !== null && now - armedAt <= windowSeconds;
  return {
    click(now) {
      if (isArmed(now)) { armedAt = null; return 'confirm'; }
      armedAt = now;
      return 'arm';
    },
    armed: isArmed,
    reset() { armedAt = null; },
  };
}
