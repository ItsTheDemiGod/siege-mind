// A recording fake of the Web Audio subset the engine and synth use. It runs nothing: it only records nodes, connections and parameter calls.

export class FakeParam {
  constructor(value = 0) { this.value = value; this.calls = []; }
  setValueAtTime(v, t) { this.calls.push(['set', v, t]); return this; }
  linearRampToValueAtTime(v, t) { this.calls.push(['linear', v, t]); return this; }
  exponentialRampToValueAtTime(v, t) { this.calls.push(['exp', v, t]); return this; }
  setTargetAtTime(v, t, c) { this.calls.push(['target', v, t, c]); return this; }
  cancelScheduledValues(t) { this.calls.push(['cancel', t]); return this; }
}

class FakeNode {
  constructor(ctx, kind) { this.ctx = ctx; this.kind = kind; this.connections = []; ctx.nodes.push(this); }
  connect(dest) { this.connections.push(dest); return dest; }
  disconnect() { this.connections = []; this.disconnected = true; }
}

class FakeSource extends FakeNode {
  constructor(ctx, kind) { super(ctx, kind); this.starts = []; this.stops = []; this.onended = null; }
  start(t) { this.starts.push(t); }
  stop(t) { this.stops.push(t); }
}

/** Build a fake AudioContext class; `Ctor.instances` lists the created contexts. @param {{throws?: boolean, state?: string, sampleRate?: number}} [o] */
export function makeFakeAudioContext({ throws = false, state = 'suspended', sampleRate = 8000 } = {}) {
  class FakeAudioContext {
    constructor() {
      if (throws) throw new Error('no audio');
      this.nodes = [];
      this.state = state;
      this.sampleRate = sampleRate;
      this.currentTime = 0;
      this.destination = new FakeNode(this, 'destination');
      this.calls = [];
      FakeAudioContext.instances.push(this);
    }
    createGain() { const n = new FakeNode(this, 'gain'); n.gain = new FakeParam(1); return n; }
    createOscillator() { const n = new FakeSource(this, 'osc'); n.type = 'sine'; n.frequency = new FakeParam(440); n.detune = new FakeParam(0); return n; }
    createBiquadFilter() { const n = new FakeNode(this, 'filter'); n.type = 'lowpass'; n.frequency = new FakeParam(350); n.Q = new FakeParam(1); return n; }
    createBufferSource() { const n = new FakeSource(this, 'buffer'); n.buffer = null; n.loop = false; return n; }
    createDynamicsCompressor() { const n = new FakeNode(this, 'compressor'); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new FakeParam(0); return n; }
    createBuffer(channels, length, rate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      this.calls.push(['createBuffer', length]);
      return { length, sampleRate: rate, numberOfChannels: channels, getChannelData: (i) => data[i] };
    }
    resume() { this.calls.push(['resume']); this.state = 'running'; return Promise.resolve(); }
    suspend() { this.calls.push(['suspend']); this.state = 'suspended'; return Promise.resolve(); }
    close() { this.calls.push(['close']); this.state = 'closed'; return Promise.resolve(); }
    count(kind) { return this.nodes.filter((n) => n.kind === kind).length; }
  }
  FakeAudioContext.instances = [];
  return FakeAudioContext;
}

/** A settings stand-in with get/subscribe/set. */
export function fakeSettings(initial = {}) {
  const values = { muted: false, masterVolume: 0.6, sfxVolume: 0.8, ...initial };
  const subs = [];
  return { get: (k) => values[k], set(k, v) { values[k] = v; for (const s of subs) s(k, v); }, subscribe(fn) { subs.push(fn); return () => subs.splice(subs.indexOf(fn), 1); } };
}
