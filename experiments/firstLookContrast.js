// Fixed-wave style contrast (pure): shared by the first look and its matched-set sensitivity.
import { roundTo } from '../src/sim/telemetrySchema.js';
import { tiltAtWave } from './metrics.js';
import { mean, signFlipTest, bootstrapCI } from './stats.js';

const r6 = (x) => roundTo(x, 6);
const rCI = (ci) => [r6(ci[0]), r6(ci[1])];
const keyOf = (r) => `${r.style}|${r.seed}`;

/** Style contrast at a fixed wave W for one mode (same definition as contrastPerSeed, with the tilt taken from tiltByWave at W). */
export function contrastAtWave(popRows, mode, W, protocol) {
  const st = protocol.stats;
  const cell = new Map();
  for (const r of popRows) { const t = r.mode === mode ? tiltAtWave(r, W) : null; if (t) cell.set(keyOf(r), t); }
  const S = protocol.styles.filter((s) => Array.isArray(protocol.tiltPredictions[s]) && protocol.tiltPredictions[s].length > 0);
  const seeds = [...new Set(popRows.map((r) => r.seed))].sort((x, y) => x - y);
  const values = [];
  const pairAcc = new Map();
  for (const seed of seeds) {
    const pairs = [];
    for (const s of S) {
      const own = cell.get(`${s}|${seed}`);
      const refs = S.filter((x) => x !== s).map((x) => cell.get(`${x}|${seed}`)).filter(Boolean);
      if (!own || refs.length < 1) continue;
      for (const t of protocol.tiltPredictions[s]) {
        const v = r6(own[t] - mean(refs.map((x) => x[t])));
        pairs.push(v);
        (pairAcc.get(`${s}|${t}`) ?? pairAcc.set(`${s}|${t}`, []).get(`${s}|${t}`)).push(v);
      }
    }
    if (pairs.length) values.push(mean(pairs));
  }
  const popUnits = new Set(popRows.map(keyOf)).size;
  const base = { mode, wave: W, observedUnits: cell.size, popUnits, coverage: r6(popUnits ? cell.size / popUnits : 0), seeds: values.length };
  const perPair = [...pairAcc.entries()].map(([k, v]) => { const [style, type] = k.split('|'); return { style, type, n: v.length, mean: r6(mean(v)) }; }).sort((a, b) => (a.style + a.type < b.style + b.type ? -1 : 1));
  if (values.length === 0) return { ...base, mean: null, ci95: null, pRaw: null, perPair };
  const test = signFlipTest(values, { resamples: st.signFlipResamples, exactMaxN: st.exactMaxN, seed: st.seed });
  return { ...base, mean: r6(mean(values)), ci95: rCI(bootstrapCI(values, { resamples: st.bootstrapResamples, alpha: st.alpha, seed: st.seed })), pRaw: r6(test.p), perPair };
}

