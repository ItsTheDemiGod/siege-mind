// Pure: what the Escape key does, given what is open. Exactly one action, by priority.

/**
 * @param {{menuOpen: boolean, howToOpen: boolean, pauseMenuOpen: boolean, endScreenOpen: boolean, settingsOpen: boolean,
 *   buildMode: 'idle'|'placing'|'selected', gameOver: boolean, reportOpen?: boolean, overlayOpen?: boolean}} ui
 * @returns {'none'|'close-howto'|'close-report'|'close-pause-menu'|'hide-end-screen'|'cancel-placing'|'clear-selection'|'close-overlay'|'open-pause-menu'}
 */
export function resolveEscape(ui) {
  if (ui.howToOpen) return 'close-howto';
  if (ui.reportOpen) return 'close-report';
  if (ui.menuOpen) return 'none';
  if (ui.settingsOpen) return 'none'; // the settings modal handles its own Escape
  if (ui.pauseMenuOpen) return 'close-pause-menu';
  if (ui.endScreenOpen) return 'hide-end-screen';
  if (ui.buildMode === 'placing') return 'cancel-placing';
  if (ui.buildMode === 'selected') return 'clear-selection';
  if (ui.overlayOpen && !ui.gameOver) return 'close-overlay';
  if (ui.gameOver) return 'none';
  return 'open-pause-menu';
}
