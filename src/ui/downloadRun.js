// Browser only: hand a text file to the user. Call it from a button handler (a user click), never on its own.

/**
 * @param {string} filename @param {string} text @param {string} mime
 * @returns {void}
 */
export function downloadText(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
