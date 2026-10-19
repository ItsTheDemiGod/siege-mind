// Tiny SVG element helper (createElementNS; text is always set with textContent).
const NS = 'http://www.w3.org/2000/svg';

/**
 * @param {string} tag @param {Record<string, string|number>} [attrs] @param {(Node|string)[]} [children]
 * @returns {SVGElement}
 */
export function svg(tag, attrs = {}, children = []) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = String(v);
    else node.setAttribute(k, String(v));
  }
  for (const c of children) node.append(c);
  return node;
}
