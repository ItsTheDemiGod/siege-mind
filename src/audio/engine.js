// The audio engine: inert until unlock() (first user gesture), then voices -> sfxGain -> masterGain -> compressor -> destination.
// Everything is injected (context constructor, settings, clock) so the engine runs against a fake context in Node. Audio can never throw into the caller.
import { audioConfig } from './audioConfig.js';
import { SOUNDS } from './sounds.js';
import { soundForEvent } from './eventMap.js';
import { createVoiceLimiter } from './limiter.js';
import { gainsFor } from './volume.js';
import { renderSound } from './synth.js';

const STEAL_FADE = 0.01; // seconds (time constant) for fading out a stolen voice
const TAIL_MS = 50;

/**
 * @param {{AudioContextCtor?: Function, settings: {get: (k: string) => *, subscribe: (fn: Function) => Function}, nowMs: () => number, cfg?: typeof audioConfig}} o
 * @returns {{unlock: Function, handleEvent: Function, play: Function, setVisible: Function, dispose: Function, status: Function}}
 */
export function createAudioEngine({ AudioContextCtor, settings, nowMs, cfg = audioConfig }) {
  let ctx = null;
  let chain = null;
  let available = typeof AudioContextCtor === 'function';
  let inert = !available;
  let unlocked = false;
  let hidden = false;
  let seq = 0;
  const voices = new Map(); // voiceId -> { output, endMs }
  const limiter = createVoiceLimiter({ maxVoices: cfg.maxVoices });
  let maxSimultaneous = 0;

  const current = () => ({ muted: Boolean(settings.get('muted')), masterVolume: settings.get('masterVolume'), sfxVolume: settings.get('sfxVolume') });

  function applyVolumes(initial) {
    if (!chain) return;
    const g = gainsFor(current(), cfg);
    if (initial) { chain.sfx.gain.value = g.sfx; chain.master.gain.value = g.master; return; }
    const t = ctx.currentTime;
    chain.sfx.gain.setTargetAtTime(g.sfx, t, cfg.rampSeconds);
    chain.master.gain.setTargetAtTime(g.master, t, cfg.rampSeconds);
  }

  const unsubscribe = settings.subscribe((key) => {
    if (inert || !chain || !['muted', 'masterVolume', 'sfxVolume'].includes(key)) return;
    try {
      applyVolumes(false);
      if (key === 'muted' && !current().muted && !hidden && ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch { /* a broken audio context must not break the settings panel */ }
  });

  /** Create the context on the first gesture. @returns {boolean} whether the context is running */
  function unlock() {
    if (inert) return false;
    try {
      if (!ctx) {
        ctx = new AudioContextCtor();
        const sfx = ctx.createGain();
        const master = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();
        for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) comp[k].value = cfg.compressor[k];
        sfx.connect(master);
        master.connect(comp);
        comp.connect(ctx.destination);
        chain = { sfx, master, comp };
        applyVolumes(true);
      }
      unlocked = true;
      if (ctx.state === 'suspended' && !hidden) ctx.resume().catch(() => {});
      return ctx.state === 'running';
    } catch {
      inert = true; available = false; ctx = null; chain = null; unlocked = false;
      return false;
    }
  }

  /** Play a catalogue sound. @param {string} id @param {{pitch?: number, gainMul?: number, ignoreLimit?: boolean}} [opts] @returns {boolean} whether a voice started */
  function play(id, opts = {}) {
    if (inert || !unlocked || !ctx || hidden) return false;
    const spec = SOUNDS[id];
    if (!spec) return false;
    const g = gainsFor(current(), cfg);
    if (g.master * g.sfx <= 0) return false;
    try {
      const now = nowMs();
      for (const [k, v] of voices) if (v.endMs <= now) voices.delete(k);
      const r = limiter.request(opts.ignoreLimit ? { ...spec, minIntervalMs: 0 } : spec, now);
      if (!r.play) return false;
      if (r.stealId !== null) {
        const v = voices.get(r.stealId);
        if (v) { v.output.gain.cancelScheduledValues(ctx.currentTime); v.output.gain.setTargetAtTime(0, ctx.currentTime, STEAL_FADE); voices.delete(r.stealId); }
      }
      const when = ctx.currentTime;
      const out = renderSound(ctx, chain.sfx, spec, when, { pitch: opts.pitch ?? 1, gainMul: opts.gainMul ?? 1 });
      const voiceId = ++seq;
      const endMs = now + (out.endTime - when) * 1000 + TAIL_MS;
      limiter.register(voiceId, spec, now, endMs);
      voices.set(voiceId, { output: out.output, endMs });
      if (voices.size > maxSimultaneous) maxSimultaneous = voices.size;
      return true;
    } catch {
      return false;
    }
  }

  /** Map a sim event to sounds and play them. @param {string} type @param {object} payload @param {{mode?: string, tick?: number}} [c] */
  function handleEvent(type, payload, c) {
    if (inert || !unlocked) return;
    for (const s of soundForEvent(type, payload, c)) play(s.id, { pitch: s.pitch, gainMul: s.gainMul });
  }

  function setVisible(visible) {
    hidden = !visible;
    if (inert || !ctx) return;
    try {
      if (hidden) ctx.suspend().catch(() => {});
      else if (!current().muted) ctx.resume().catch(() => {});
    } catch { /* ignore */ }
  }

  function dispose() {
    unsubscribe();
    if (ctx) { try { ctx.close().catch(() => {}); } catch { /* ignore */ } }
    ctx = null; chain = null; voices.clear(); inert = true; unlocked = false;
  }

  const status = () => ({ available, unlocked, running: Boolean(ctx && ctx.state === 'running'), muted: Boolean(settings.get('muted')), voices: voices.size, maxVoices: maxSimultaneous, stats: limiter.stats() });

  return { unlock, handleEvent, play, setVisible, dispose, status };
}
