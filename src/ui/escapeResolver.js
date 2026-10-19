// Pure: what the Escape key does, given what is open. Exactly one action, by priority.

/**
 * @param {{menuOpen: boolean, howToOpen: boolean, pauseMenuOpen: boolean, endScreenOpen: boolean, settingsOpen: boolean,
 *   buildMode: 'idle'|'placing'|'selected', gameOver: boolean}} ui
 * @returns {'none'|'close-howto'|'close-pause-menu'|'hide-end-screen'|'cancel-placing'|'clear-selection'|'open-pause-menu'}
 */
export function resolveEscape(ui) {
  if (ui.howToOpen) return 'close-howto';
  if (ui.menuOpen) return 'none';
  if (ui.settingsOpen) return 'none'; // the settings modal handles its own Escape
  if (ui.pauseMenuOpen) return 'close-pause-menu';
  if (ui.endScreenOpen) return 'hide-end-screen';
  if (ui.buildMode === 'placing') return 'cancel-placing';
  if (ui.buildMode === 'selected') return 'clear-selection';
  if (ui.gameOver) return 'none';
  return 'open-pause-menu';
}
