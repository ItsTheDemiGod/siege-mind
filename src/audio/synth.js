// Renders one catalogue sound onto ANY BaseAudioContext (live or offline). Browser audio API only; no DOM, no clock, no Math.random.
// Nodes used: OscillatorNode, GainNode, BiquadFilterNode, AudioBufferSourceNode (precomputed noise buffer) and parameter automation.

const FLOOR = 0.0001; // exponential ramps cannot reach 0
const NOISE_SEED = 0x2545f491;
const NOISE_SECONDS = 1;
const noiseCache = new WeakMap(); // context -> AudioBuffer

/** @returns {Float32Array-like} deterministic white noise in [-1, 1) from a seeded xorshift32 */
export function noiseSamples(length) {
  const out = new Float32Array(length);
  let x = NOISE_SEED;
  for (let i = 0; i < length; i++) {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    out[i] = (x / 2147483648) - 1;
  }
  return out;
}

/** The cached noise buffer of a context (mono, deterministic). */
export function makeNoiseBuffer(ctx, seconds = NOISE_SECONDS) {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
    buf.getChannelData(0).set(noiseSamples(buf.length));
    noiseCache.set(ctx, buf);
  }
  return buf;
}

function envelope(param, t0, layer, gain) {
  param.setValueAtTime(FLOOR, t0);
  param.linearRampToValueAtTime(Math.max(FLOOR, gain), t0 + layer.attack);
  param.exponentialRampToValueAtTime(FLOOR, t0 + layer.attack + layer.decay);
}

/**
 * @param {BaseAudioContext} ctx @param {AudioNode} destination @param {object} spec a SOUNDS entry @param {number} when context time to start
 * @param {{pitch?: number, gainMul?: number}} [opts]
 * @returns {{endTime: number, nodes: AudioNode[], output: GainNode}} output is the sound's own gain node (the caller can fade it to steal the voice)
 */
export function renderSound(ctx, destination, spec, when, { pitch = 1, gainMul = 1 } = {}) {
  const out = ctx.createGain();
  out.gain.setValueAtTime(spec.gain * gainMul, when);
  out.connect(destination);
  const nodes = [out];
  let endTime = when;
  for (const layer of spec.layers) {
    const t0 = when + layer.at;
    const t1 = t0 + layer.attack + layer.decay;
    const stopAt = t1 + 0.02;
    const env = ctx.createGain();
    envelope(env.gain, t0, layer, layer.gain);
    env.connect(out);
    nodes.push(env);
    const sources = [];
    if (layer.kind === 'osc') {
      const o = ctx.createOscillator();
      o.type = layer.wave;
      o.frequency.setValueAtTime(layer.freq * pitch, t0);
      if (layer.freqEnd) o.frequency.exponentialRampToValueAtTime(layer.freqEnd * pitch, t1);
      o.connect(env);
      nodes.push(o);
      sources.push(o);
      if (layer.vibrato) {
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.setValueAtTime(layer.vibrato.rate, t0);
        depth.gain.setValueAtTime(layer.vibrato.depth, t0); // detune is in cents
        lfo.connect(depth);
        depth.connect(o.detune);
        nodes.push(lfo, depth);
        sources.push(lfo);
      }
    } else {
      const src = ctx.createBufferSource();
      src.buffer = makeNoiseBuffer(ctx);
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = layer.filter.type;
      f.frequency.setValueAtTime(layer.filter.freq, t0);
      if (layer.filter.freqEnd) f.frequency.exponentialRampToValueAtTime(layer.filter.freqEnd, t1);
      f.Q.setValueAtTime(layer.filter.q, t0);
      src.connect(f);
      f.connect(env);
      nodes.push(src, f);
      sources.push(src);
    }
    sources.forEach((s, i) => {
      s.start(t0);
      s.stop(stopAt);
      if (i === 0) s.onended = () => { for (const n of [...sources, env]) try { n.disconnect(); } catch { /* already disconnected */ } };
    });
    if (stopAt > endTime) endTime = stopAt;
  }
  return { endTime, nodes, output: out };
}
