// Dev keyboard controls. Calls handlers only; owns no state.

const SELF_HANDLED = 'button, select, input, textarea, [role="switch"]';

/**
 * Bind the dev keys.
 * @param {{togglePause: () => void, setSpeed: (n: number) => void, singleStep: () => void, toggleHud: () => void}} handlers
 * @param {Record<string, (e: KeyboardEvent) => void>} [extraKeys] - single-character keys (lowercase); same ignore rules, no auto-repeat
 * @returns {() => void} unbind function
 */
export function bindKeys(handlers, extraKeys = {}) {
  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t instanceof Element && (t.matches(SELF_HANDLED) || t.isContentEditable)) return; // controls handle their own keys
    switch (e.code) {
      case 'Space':
        e.preventDefault(); // stop the page scrolling
        if (!e.repeat) handlers.togglePause();
        break;
      case 'Digit1': handlers.setSpeed(1); break;
      case 'Digit2': handlers.setSpeed(2); break;
      case 'Digit3': handlers.setSpeed(3); break;
      case 'KeyN': handlers.singleStep(); break;
      case 'Backquote':
        if (!e.repeat) handlers.toggleHud();
        break;
      default: {
        const fn = e.key.length === 1 ? extraKeys[e.key.toLowerCase()] : undefined;
        if (fn && !e.repeat) fn(e);
      }
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
