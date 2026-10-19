import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudioEngine } from '../src/audio/engine.js';
import { renderSound, noiseSamples, makeNoiseBuffer } from '../src/audio/synth.js';
import { bindUnlock } from '../src/audio/unlock.js';
import { SOUNDS } from '../src/audio/sounds.js';
import { MAPPED_EVENTS } from '../src/audio/eventMap.js';
import { audioConfig as cfg } from '../src/audio/audioConfig.js';
import { gainsFor } from '../src/audio/volume.js';
import { EVENT_TYPES as E } from '../src/sim/events.js';
import { createGame, stepGame, snapshotGame } from '../src/sim/game.js';
import { createBot } from '../experiments/bots.js';
import { makeFakeAudioContext, fakeSettings } from './helpers/fakeAudio.js';

function setup(settingsInit = {}, ctxOpts = {}) {
  const Ctor = makeFakeAudioContext(ctxOpts);
  const settings = fakeSettings(settingsInit);
  const clock = { now: 1000 };
  const engine = createAudioEngine({ AudioContextCtor: Ctor, settings, nowMs: () => clock.now });
  return { Ctor, settings, clock, engine };
}
const voiceCount = (ctx) => ctx.nodes.filter((n) => n.kind === 'gain' && n.connections.includes(ctx.nodes[1])).length; // gains wired into the sfx bus

test('nothing is created before unlock; unlock builds the chain once and resumes a suspended context', () => {
  const { Ctor, engine } = setup();
  assert.equal(Ctor.instances.length, 0);
  engine.handleEvent(E.TOWER_PLACED, { id: 1 }, { tick: 1 });
  assert.equal(engine.play('uiClick'), false);
  assert.equal(Ctor.instances.length, 0);
  assert.equal(engine.unlock(), true);
  assert.equal(Ctor.instances.length, 1);
  const ctx = Ctor.instances[0];
  const nodes = ctx.nodes.length;
  assert.deepEqual(ctx.nodes.slice(0, 4).map((n) => n.kind), ['destination', 'gain', 'gain', 'compressor']);
  assert.deepEqual(ctx.calls.filter((c) => c[0] === 'resume').length, 1);
  engine.unlock();
  assert.equal(Ctor.instances.length, 1);
  assert.equal(ctx.nodes.length, nodes);
  assert.equal(ctx.nodes[3].threshold.value, cfg.compressor.threshold);
  assert.equal(engine.status().unlocked, true);
});

test('a constructor that throws leaves the engine inert and unavailable without an exception', () => {
  const { engine } = setup({}, { throws: true });
  assert.doesNotThrow(() => engine.unlock());
  assert.equal(engine.unlock(), false);
  assert.equal(engine.status().available, false);
  assert.doesNotThrow(() => engine.handleEvent(E.TOWER_FIRED, { towerId: 1, type: 'lance' }, { tick: 1 }));
  assert.equal(engine.play('uiClick'), false);
  const none = createAudioEngine({ AudioContextCtor: undefined, settings: fakeSettings(), nowMs: () => 0 });
  assert.equal(none.status().available, false);
  assert.equal(none.unlock(), false);
});

test('a muted engine renders no voices', () => {
  const { Ctor, engine } = setup({ muted: true });
  engine.unlock();
  const ctx = Ctor.instances[0];
  const n = ctx.nodes.length;
  assert.equal(engine.play('towerPlace'), false);
  engine.handleEvent(E.TOWER_PLACED, { id: 1 }, { tick: 1 });
  assert.equal(ctx.nodes.length, n);
});

test('200 tower shots in one millisecond render at most one voice per fire sound and never more than maxVoices', () => {
  const { Ctor, engine } = setup();
  engine.unlock();
  const types = ['lance', 'mortar', 'frost', 'poison', 'sniper'];
  for (let i = 0; i < 200; i++) engine.handleEvent(E.TOWER_FIRED, { towerId: i, type: types[i % 5] }, { tick: 7 });
  const ctx = Ctor.instances[0];
  assert.equal(voiceCount(ctx), 5); // the per-sound minimum interval admits one of each
  assert.ok(voiceCount(ctx) <= cfg.maxVoices);
  assert.equal(engine.status().stats.played, 5);
  assert.equal(engine.status().stats.droppedRate, 195);
});

test('the global cap is respected and priority 3 sounds still play when low priority voices fill the pool', () => {
  const { Ctor, engine } = setup();
  engine.unlock();
  const p1 = Object.values(SOUNDS).filter((s) => s.priority === 1);
  for (const s of p1) for (let k = 0; k < s.maxVoices; k++) engine.play(s.id, { ignoreLimit: true });
  assert.equal(engine.status().voices, cfg.maxVoices); // saturated
  const before = engine.status().stats.stolen;
  assert.equal(engine.play('leak'), true);
  engine.handleEvent(E.LIVES_CHANGED, { lives: 19, delta: -1 }, { tick: 1 });
  engine.handleEvent(E.GAME_OVER, { result: 'lost' }, { tick: 2 });
  assert.equal(engine.status().stats.stolen, before + 3);
  assert.ok(engine.status().voices <= cfg.maxVoices);
  assert.ok(Ctor.instances[0].nodes.length > 0);
});

test('volume changes ramp the gain nodes instead of jumping', () => {
  const { Ctor, engine, settings } = setup();
  engine.unlock();
  const [, sfx, master] = Ctor.instances[0].nodes;
  assert.equal(sfx.gain.calls.length, 0); // the initial value is written directly
  const initial = { sfx: sfx.gain.value, master: master.gain.value };
  settings.set('masterVolume', 0.3);
  const g = gainsFor({ muted: false, masterVolume: 0.3, sfxVolume: 0.8 });
  const last = master.gain.calls.at(-1);
  assert.deepEqual([last[0], last[1], last[3]], ['target', g.master, cfg.rampSeconds]);
  assert.equal(master.gain.value, initial.master); // value untouched: only automation
  settings.set('muted', true);
  assert.equal(sfx.gain.calls.at(-1)[1], 0);
  settings.set('muted', false);
  assert.ok(sfx.gain.calls.at(-1)[1] > 0);
});

test('setVisible suspends and resumes, but does not resume a muted engine', () => {
  const { Ctor, engine, settings } = setup();
  engine.unlock();
  const ctx = Ctor.instances[0];
  engine.setVisible(false);
  assert.equal(ctx.state, 'suspended');
  assert.equal(engine.play('uiClick'), false); // hidden: nothing is rendered
  engine.setVisible(true);
  assert.equal(ctx.state, 'running');
  settings.set('muted', true);
  engine.setVisible(false);
  engine.setVisible(true);
  assert.equal(ctx.state, 'suspended');
  settings.set('muted', false); // unmuting while visible resumes
  assert.equal(ctx.state, 'running');
});

test('dispose closes the context and later calls are no-ops', () => {
  const { Ctor, engine } = setup();
  engine.unlock();
  const ctx = Ctor.instances[0];
  engine.dispose();
  assert.equal(ctx.state, 'closed');
  const n = ctx.nodes.length;
  assert.equal(engine.play('uiClick'), false);
  assert.doesNotThrow(() => { engine.handleEvent(E.TOWER_PLACED, { id: 1 }, { tick: 1 }); engine.setVisible(false); engine.unlock(); engine.dispose(); });
  assert.equal(ctx.nodes.length, n);
  assert.equal(engine.status().running, false);
});

test('every catalogue sound renders on the fake context with bounded nodes and stop times', () => {
  for (const spec of Object.values(SOUNDS)) {
    const ctx = new (makeFakeAudioContext())();
    const r = renderSound(ctx, ctx.destination, spec, 0, { pitch: 1.03, gainMul: 1 });
    assert.ok(r.nodes.length <= 12, `${spec.id}: ${r.nodes.length} nodes`);
    const sources = ctx.nodes.filter((n) => n.starts);
    assert.ok(sources.length >= 1);
    for (const s of sources) {
      assert.equal(s.starts.length, 1);
      assert.equal(s.stops.length, 1);
      assert.ok(s.stops[0] <= spec.duration + 0.05, `${spec.id} stops at ${s.stops[0]}`);
      assert.ok(s.stops[0] > s.starts[0]);
    }
    assert.ok(r.endTime <= spec.duration + 0.05 + 1e-9);
    for (const n of ctx.nodes.filter((x) => x.kind === 'gain')) for (const c of n.gain.calls) if (c[0] === 'exp') assert.ok(c[1] > 0, 'exponential ramps never target 0');
  }
});

test('a source that ends disconnects its nodes', () => {
  const ctx = new (makeFakeAudioContext())();
  renderSound(ctx, ctx.destination, SOUNDS.uiClick, 0);
  const src = ctx.nodes.find((n) => n.starts);
  src.onended();
  assert.equal(src.disconnected, true);
});

test('the noise is deterministic, in range and cached per context', () => {
  const a = noiseSamples(500);
  const b = noiseSamples(500);
  assert.deepEqual(Array.from(a), Array.from(b));
  assert.ok(a.every((x) => x >= -1 && x < 1));
  assert.ok(new Set(Array.from(a)).size > 400);
  const ctx = new (makeFakeAudioContext())();
  assert.equal(makeNoiseBuffer(ctx), makeNoiseBuffer(ctx));
  assert.equal(ctx.calls.filter((c) => c[0] === 'createBuffer').length, 1);
  assert.deepEqual(Array.from(makeNoiseBuffer(ctx).getChannelData(0).slice(0, 50)), Array.from(a.slice(0, 50)));
});

test('bindUnlock fires once on the first gesture and removes every listener', () => {
  const listeners = new Map();
  const target = { addEventListener: (e, f) => listeners.set(e, f), removeEventListener: (e) => listeners.delete(e) };
  let calls = 0;
  const unbind = bindUnlock({ target, onUnlock: () => { calls++; } });
  assert.deepEqual([...listeners.keys()].sort(), [...cfg.unlockEvents].sort());
  listeners.get('keydown')();
  assert.equal(calls, 1);
  assert.equal(listeners.size, 0);
  unbind();
  unbind();
  const again = bindUnlock({ target, events: ['pointerdown'], onUnlock: () => { calls++; } });
  again();
  assert.equal(listeners.size, 0);
  assert.equal(calls, 1);
});

test('attaching the engine to the sim bus does not change snapshotGame at five checkpoints of a 15-wave game', () => {
  const run = (attach) => {
    const game = createGame({ seed: 1, mode: 'adaptive', totalWaves: 15 });
    let engine = null;
    if (attach) {
      const Ctor = makeFakeAudioContext();
      engine = createAudioEngine({ AudioContextCtor: Ctor, settings: fakeSettings(), nowMs: () => game.tick * 16 });
      engine.unlock();
      for (const t of MAPPED_EVENTS) game.events.on(t, (p) => engine.handleEvent(t, p, { mode: game.mode, tick: game.tick }));
    }
    const bot = createBot('balanced');
    const snaps = [];
    const marks = [3000, 15000, 30000, 50000];
    while (!game.over && game.tick < 200000) {
      const phase = game.waves.phase;
      if (phase === 'prep' || phase === 'intermission' || game.tick % 30 === 0) bot.act(game);
      stepGame(game);
      if (marks.includes(game.tick)) snaps.push(JSON.stringify(snapshotGame(game)));
    }
    snaps.push(JSON.stringify(snapshotGame(game)));
    return { snaps, played: engine ? engine.status().stats.played : 0 };
  };
  const plain = run(false);
  const withAudio = run(true);
  assert.equal(plain.snaps.length, 5);
  assert.deepEqual(withAudio.snaps, plain.snaps);
  assert.ok(withAudio.played > 100, 'the engine really received events');
});
