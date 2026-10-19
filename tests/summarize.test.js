import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/sim/game.js';
import { attachTelemetry } from '../src/sim/telemetry.js';
import { startNextWave } from '../src/sim/waveRunner.js';
import { getBot } from '../experiments/bots.js';
import { formatRunSummary } from '../experiments/summarize.js';

function shortRun() {
  const game = createGame({ seed: 2, debugSpawnEveryTicks: 0, totalWaves: 15 });
  const tele = attachTelemetry(game);
  const bot = getBot('balanced');
  bot.act(game);
  startNextWave(game);
  for (let i = 0; i < 9000; i++) { if (i % 120 === 0) bot.act(game); stepGame(game); }
  return tele.getRun();
}

test('formatRunSummary has a header, every table, aligned columns and numbers that match the run', () => {
  const run = shortRun();
  const text = formatRunSummary(run);
  const lines = text.split('\n');
  assert.equal(lines[0], `Run: seed=2 mode=static waves=15 result=in progress final wave=${run.result.wave} lives=${run.result.lives} game minutes=${(run.result.seconds / 60).toFixed(1)} detail=full`);
  for (const title of ['Per wave', 'Damage by source (all waves + offWave)', 'Per enemy type', 'Towers (top 12 by damage dealt)']) assert.ok(lines.includes(title), title);

  const at = (title) => lines.indexOf(title);
  const waveRows = lines.slice(at('Per wave') + 3, at('Damage by source (all waves + offWave)') - 1);
  assert.equal(waveRows.length, run.waves.length);
  const first = waveRows[0].trim().split(/\s+/);
  assert.equal(first[0], String(run.waves[0].wave));
  assert.equal(first[4], String(run.waves[0].spawnedUnits));

  for (const title of ['Per wave', 'Damage by source (all waves + offWave)', 'Per enemy type', 'Towers (top 12 by damage dealt)']) {
    const header = lines[at(title) + 1];
    const rule = lines[at(title) + 2];
    assert.equal(rule.length, header.length, `${title}: rule and header widths differ`);
    assert.match(rule, /^[- ]+$/);
  }
  const typeRows = lines.slice(at('Per enemy type') + 3, at('Per enemy type') + 8);
  assert.equal(typeRows.map((r) => Number(r.trim().split(/\s+/)[1])).reduce((a, b) => a + b, 0), run.totals.spawned);
});

test('formatRunSummary limits the wave table with maxWaves and is deterministic', () => {
  const run = shortRun();
  assert.equal(formatRunSummary(run), formatRunSummary(run));
  const limited = formatRunSummary(run, { maxWaves: 1 }).split('\n');
  const start = limited.indexOf('Per wave');
  assert.equal(limited.slice(start + 3).findIndex((l) => l === ''), 1);
});
