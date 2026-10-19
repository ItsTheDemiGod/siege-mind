// Compare two result row sets unit by unit (pure): used to prove that an amendment changed only the columns it says it changes.

const keyOf = (r) => `${r.style}/${r.mode}/${r.seed}`;

function index(rows, label) {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    if (map.has(k)) throw new Error(`duplicate unit ${k} in ${label}`);
    map.set(k, r);
  }
  return map;
}

/**
 * @param {object[]} rowsA @param {object[]} rowsB @param {{ignore?: string[]}} [o] columns to leave out of the comparison
 * @returns {{unit: string, column: string, a: *, b: *}[]} every differing cell (arrays compared by value), in unit order then column order
 * @throws {Error} on missing or duplicate units
 */
export function diffColumns(rowsA, rowsB, { ignore = [] } = {}) {
  const a = index(rowsA, 'A');
  const b = index(rowsB, 'B');
  for (const k of a.keys()) if (!b.has(k)) throw new Error(`unit ${k} is missing in B`);
  for (const k of b.keys()) if (!a.has(k)) throw new Error(`unit ${k} is missing in A`);
  const skip = new Set(ignore);
  const diffs = [];
  for (const [unit, ra] of a) {
    const rb = b.get(unit);
    const columns = [...new Set([...Object.keys(ra), ...Object.keys(rb)])].filter((c) => !skip.has(c));
    for (const column of columns) {
      if (JSON.stringify(ra[column]) !== JSON.stringify(rb[column])) diffs.push({ unit, column, a: ra[column], b: rb[column] });
    }
  }
  return diffs;
}

/** @param {{unit: string, column: string}[]} diffs @returns {{count: number, units: number, byColumn: Record<string, number>}} */
export function summarizeDiff(diffs) {
  const byColumn = {};
  for (const d of diffs) byColumn[d.column] = (byColumn[d.column] ?? 0) + 1;
  return { count: diffs.length, units: new Set(diffs.map((d) => d.unit)).size, byColumn };
}
