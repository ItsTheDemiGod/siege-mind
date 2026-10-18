// Dev keyboard controls. Calls handlers only; owns no state.

/**
 * Bind the dev keys.
 * @param {{togglePause: () => void, setSpeed: (n: number) => void, singleStep: () => void, toggleHud: () => void}} handlers
 * @returns {() => void} unbind function
 */
export function bindKeys(handlers) {
  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
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
      default:
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
