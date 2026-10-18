// Pure measurement helpers (no DOM, no clocks): rate meter and frame-time stats. Allocation-free after creation.

const BUCKETS = 20;

/**
 * Events-per-second meter over a sliding window of fixed buckets.
 * Call tick(now, count) every frame (count may be 0) so gaps decay the rate; call reset() after pause/hidden.
 * @param {{windowSeconds?: number}} [options]
 * @returns {{tick: (nowSeconds: number, count?: number) => void, reset: () => void, readonly rate: number}}
 */
export function createRateMeter({ windowSeconds = 1 } = {}) {
  const width = windowSeconds / BUCKETS;
  const counts = new Float64Array(BUCKETS);
  let started = false;
  let first = 0;
  let last = 0;
  let cur = 0; // absolute index of the newest bucket

  const advanceTo = (idx) => {
    const gap = idx - cur;
    if (gap >= BUCKETS) counts.fill(0);
    else for (let i = 1; i <= gap; i++) counts[(cur + i) % BUCKETS] = 0;
    cur = idx;
  };

  return {
    tick(now, count = 1) {
      const idx = Math.floor(now / width);
      if (!started) {
        started = true;
        first = now;
        cur = idx;
      } else if (idx > cur) advanceTo(idx);
      last = now;
      counts[cur % BUCKETS] += count;
    },
    reset() {
      counts.fill(0);
      started = false;
    },
    get rate() {
      if (!started) return 0;
      let sum = 0;
      for (let i = 0; i < BUCKETS; i++) sum += counts[i];
      // Covered span: the full older buckets plus the filled part of the newest one.
      const span = Math.min((BUCKETS - 1) * width + (last - cur * width), last - first + width);
      return span > 0 ? sum / span : 0;
    },
  };
}

/**
 * Ring buffer of recent frame times with avg / p95 / max / fps.
 * p95 is recomputed at most every 250 ms of accumulated frame time (or on refresh()).
 * @param {{capacity?: number}} [options]
 * @returns {object}
 */
export function createFrameStats({ capacity = 300 } = {}) {
  const ring = new Float32Array(capacity);
  const scratch = new Float32Array(capacity);
  let n = 0;
  let head = 0;
  let sum = 0;
  let p95 = 0;
  let sinceP95 = 0;
  let dirty = false;

  const computeP95 = () => {
    for (let i = 0; i < n; i++) scratch[i] = ring[i];
    scratch.fill(Infinity, n);
    scratch.sort();
    p95 = n === 0 ? 0 : scratch[Math.floor(0.95 * (n - 1))];
    sinceP95 = 0;
    dirty = false;
  };

  return {
    push(frameMs) {
      if (n === capacity) sum -= ring[head];
      else n++;
      ring[head] = frameMs;
      sum += frameMs;
      head = (head + 1) % capacity;
      sinceP95 += frameMs;
      dirty = true;
      if (sinceP95 >= 250) computeP95();
    },
    /** Force the p95 to be recomputed now. */
    refresh() {
      computeP95();
    },
    reset() {
      n = 0; head = 0; sum = 0; p95 = 0; sinceP95 = 0; dirty = false;
    },
    get avgMs() { return n === 0 ? 0 : sum / n; },
    get p95Ms() {
      if (dirty && p95 === 0) computeP95();
      return p95;
    },
    get maxMs() {
      let m = 0;
      for (let i = 0; i < n; i++) if (ring[i] > m) m = ring[i];
      return m;
    },
    get fps() { return n === 0 || sum <= 0 ? 0 : 1000 / (sum / n); },
  };
}
