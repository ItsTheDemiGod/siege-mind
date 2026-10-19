// Opens and closes the Director report modal: builds the model from the telemetry run at click time. Browser wiring only.
import { buildDirectorReport } from './directorReport.js';
import { renderDirectorReport } from './directorReportView.js';

/**
 * @param {{root: HTMLElement, telemetry: {getRun: () => object}, toaster: {show: Function}, onDownload: () => void, restoreFocus: () => void}} o
 * @returns {{open: () => void, close: () => void, readonly isOpen: boolean}}
 */
export function createReportController({ root, telemetry, toaster, onDownload, restoreFocus }) {
  let view = null;
  let errorLogged = false;

  function close() {
    if (!view) return;
    view.el.remove();
    view = null;
    restoreFocus();
  }

  function open() {
    if (view) return;
    try {
      const model = buildDirectorReport(telemetry.getRun());
      if (!model.available) return;
      view = renderDirectorReport(model, { onClose: close, onDownload });
      root.append(view.el);
      view.focusFirst();
    } catch (e) {
      view = null;
      if (!errorLogged) { errorLogged = true; console.error('director report failed', e); }
      toaster.show('Could not build the report');
    }
  }

  return { open, close, get isOpen() { return view !== null; } };
}
