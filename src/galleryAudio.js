// Gallery section 8: the Sound lab. Every catalogue sound has a button, the volume sliders are the real settings, the limiter can be stressed, and
// "Analyze all" renders every sound offline and checks peak, loudness, DC offset and leading silence (the automated quality check).
import { h } from './ui/dom.js';
import { percentText } from './ui/volumeText.js';
import { SOUNDS } from './audio/sounds.js';
import { createAudioEngine } from './audio/engine.js';
import { renderSound } from './audio/synth.js';
import { analyzeSamples, soundVerdict } from './audio/analysis.js';
import { EVENT_TYPES } from './sim/events.js';

const SAMPLE_RATE = 44100;
const TAIL_SECONDS = 0.1;
const STRESS_EVENTS = 400;
const STRESS_MS = 1000;
const STRESS_BATCH_MS = 20;
const TOWERS = ['lance', 'mortar', 'frost', 'poison', 'sniper'];

/** Offline analysis of one sound: mono, 44100 Hz, straight to the context destination (no master chain). */
export async function analyzeSound(spec) {
  const length = Math.ceil(SAMPLE_RATE * (spec.duration + TAIL_SECONDS));
  const ctx = new OfflineAudioContext(1, length, SAMPLE_RATE);
  renderSound(ctx, ctx.destination, spec, 0);
  const buf = await ctx.startRendering();
  const a = analyzeSamples(buf.getChannelData(0), SAMPLE_RATE);
  return { analysis: a, verdict: soundVerdict(a) };
}

/** @param {HTMLElement} el the section @param {{settings: object}} o */
export function audioSection(el, { settings }) {
  const engine = createAudioEngine({ AudioContextCtor: window.AudioContext || window.webkitAudioContext, settings, nowMs: () => performance.now() });
  const ids = Object.keys(SOUNDS);
  el.dataset.soundCount = String(ids.length);
  const play = (id) => { engine.unlock(); engine.play(id, { ignoreLimit: true }); };

  const slider = (label, key) => {
    const input = h('input', { type: 'range', class: 'slider', min: '0', max: '1', step: '0.05', 'aria-label': label });
    input.value = settings.get(key);
    const speak = () => input.setAttribute('aria-valuetext', percentText(Number(input.value)));
    speak();
    input.addEventListener('input', () => { settings.set(key, Number(input.value)); speak(); });
    return h('label', { class: 'g-row' }, [label, input]);
  };

  const status = h('div', { class: 'mono note', role: 'status', text: '' });
  const stress = h('button', { type: 'button', class: 'btn btn--primary', text: 'Stress the limiter', onclick: () => {
    engine.unlock();
    status.textContent = 'running 1 s…';
    const before = engine.status().stats;
    const start = performance.now();
    let fired = 0;
    const timer = setInterval(() => {
      const target = Math.min(STRESS_EVENTS, Math.floor(((performance.now() - start) / STRESS_MS) * STRESS_EVENTS));
      for (; fired < target; fired++) engine.handleEvent(EVENT_TYPES.TOWER_FIRED, { towerId: fired, type: TOWERS[fired % TOWERS.length] }, { tick: fired });
      if (fired >= STRESS_EVENTS) {
        clearInterval(timer);
        const s = engine.status();
        status.textContent = `${fired} events: played ${s.stats.played - before.played}, dropped by rate ${s.stats.droppedRate - before.droppedRate}, dropped by voices ${s.stats.droppedVoices - before.droppedVoices}, stolen ${s.stats.stolen - before.stolen}, max simultaneous voices ${s.maxVoices}`;
      }
    }, STRESS_BATCH_MS);
  } });

  const summary = h('div', { class: 'mono', role: 'status', 'data-id': 'audio-summary', text: 'Analysis not run yet' });
  const tbody = h('tbody');
  const analyze = h('button', { type: 'button', class: 'btn', text: 'Analyze all', onclick: async () => {
    if (typeof OfflineAudioContext === 'undefined') { summary.textContent = 'Offline audio rendering is not available in this browser'; return; }
    tbody.replaceChildren();
    let ok = 0;
    for (const id of ids) {
      const spec = SOUNDS[id];
      const { analysis: a, verdict } = await analyzeSound(spec);
      if (verdict.ok) ok++;
      const cells = [id, spec.category, `${(spec.duration * 1000).toFixed(0)} ms`, a.peak.toFixed(3), a.rms.toFixed(4), String(a.clippedSamples), a.dcOffset.toFixed(4), verdict.ok ? 'OK' : verdict.problems.join(', ')];
      tbody.append(h('tr', { 'data-id': id, 'data-verdict': verdict.ok ? 'OK' : 'PROBLEM' }, cells.map((c) => h('td', { class: 'mono', text: c }))));
    }
    summary.textContent = `${ok} of ${ids.length} sounds OK`;
  } });

  el.append(
    h('p', { class: 'note', text: 'Sounds are generated live from oscillators and filtered noise; nothing is downloaded. Click a button to hear it (the browser starts audio after your first click).' }),
    h('div', { class: 'g-row' }, ids.map((id) => h('button', { type: 'button', class: 'btn', text: id, onclick: () => play(id) }))),
    slider('Master volume', 'masterVolume'), slider('Effects volume', 'sfxVolume'),
    h('div', { class: 'g-row' }, [stress, analyze]),
    status, summary,
    h('table', { class: 'g-table', 'aria-label': 'Sound analysis' }, [
      h('thead', {}, [h('tr', {}, ['Sound', 'Category', 'Duration', 'Peak', 'RMS', 'Clipped', 'DC offset', 'Verdict'].map((t) => h('th', { text: t })))]),
      tbody,
    ]),
  );
  return engine;
}
