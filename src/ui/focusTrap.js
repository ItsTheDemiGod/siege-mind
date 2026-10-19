// Keyboard focus containment for dialogs: Tab and Shift+Tab wrap inside `container`.
const FOCUSABLE = 'button:not([disabled]), select, input, a[href], [tabindex]:not([tabindex="-1"])';

/**
 * @param {HTMLElement} container
 * @returns {(e: KeyboardEvent) => void} keydown handler; attach it to the dialog or its backdrop
 */
export function trapTab(container) {
  return (e) => {
    if (e.key !== 'Tab') return;
    const items = [...container.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[hidden]'));
    if (items.length === 0) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
}
