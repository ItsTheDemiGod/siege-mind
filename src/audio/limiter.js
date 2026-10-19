// Voice limiter (pure): per-sound minimum interval and voice cap, a global voice cap with priority stealing. All time comes from the nowMs argument.

/** @param {{maxVoices: number}} o @returns {object} limiter */
export function createVoiceLimiter({ maxVoices }) {
  const voices = new Map(); // voiceId -> { id, priority, startMs, endMs }
  const lastPlayed = new Map(); // sound id -> ms
  const stats = { played: 0, droppedRate: 0, droppedVoices: 0, stolen: 0 };

  const prune = (nowMs) => { for (const [k, v] of voices) if (v.endMs <= nowMs) voices.delete(k); };
  const countOf = (id) => { let n = 0; for (const v of voices.values()) if (v.id === id) n++; return n; };

  return {
    /** @returns {{play: boolean, stealId: number | null}} stealId is a voice the caller must stop (already removed here) */
    request(spec, nowMs) {
      prune(nowMs);
      const last = lastPlayed.get(spec.id);
      if (last !== undefined && nowMs - last < spec.minIntervalMs) { stats.droppedRate++; return { play: false, stealId: null }; }
      if (countOf(spec.id) >= spec.maxVoices) { stats.droppedVoices++; return { play: false, stealId: null }; }
      let stealId = null;
      if (voices.size >= maxVoices) {
        let victim = null;
        for (const [k, v] of voices) if (victim === null || v.priority < victim.v.priority || (v.priority === victim.v.priority && v.startMs < victim.v.startMs)) victim = { k, v };
        if (victim === null || victim.v.priority >= spec.priority) { stats.droppedVoices++; return { play: false, stealId: null }; }
        stealId = victim.k;
        voices.delete(stealId);
        stats.stolen++;
      }
      lastPlayed.set(spec.id, nowMs);
      stats.played++;
      return { play: true, stealId };
    },
    register(voiceId, spec, startMs, endMs) { voices.set(voiceId, { id: spec.id, priority: spec.priority, startMs, endMs }); },
    release(voiceId) { voices.delete(voiceId); },
    activeCount(nowMs) { prune(nowMs); return voices.size; },
    stats: () => ({ ...stats }),
  };
}
