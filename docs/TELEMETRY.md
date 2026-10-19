# Siege Mind telemetry (schema version 1)

Telemetry is **observation only**. `attachTelemetry(game, options)` (src/sim/telemetry.js) subscribes to the game's event bus, copies primitive fields out of the payloads, and builds plain JSON-serializable records. It never writes game state, never consumes an rng stream, never reads a clock and never emits events. A game with telemetry attached is identical, tick by tick, to one without (tests/telemetry.test.js proves it with `snapshotGame`).

```js
const tele = attachTelemetry(game, { detail: 'full', meta: { app: 'siege-mind' } }); // right after createGame
// ... play ...
const run = tele.getRun();      // fresh plain object every call
tele.counts();                  // cheap counters for the debug panel
tele.attachDirector(wave, rec); // Phase 6 hook
tele.dispose();                 // unsubscribe everything (idempotent)
```

`detail: 'full'` keeps one record per enemy (capped by `config.telemetry.maxEnemyRecords`, 20000; the rest are counted in `meta.enemyRecordsDropped` and still aggregated). `detail: 'summary'` keeps aggregates only and omits the `enemies` key; batch experiments use it.

## Top-level keys of a run

| Key | Content |
|---|---|
| `schemaVersion` | 1 |
| `meta` | `detail`, `seed`, `mode`, `totalWaves`, `startLives`, `startGold`, `stepSeconds` (exact 1/60), `attachedAtTick` (0 unless attached late), `ignoredEvents`, `enemyRecordsDropped`, then the flat extra keys given in the `meta` option |
| `config` | exact copy of `config.sim`, `game`, `waves`, `economy`, `towers`, `combat`, `statuses`, `enemies` |
| `definitions` | exact copy of the enemy and tower data (`enemies`, `towers`), so a file is self-describing |
| `result` | `over`, `result` ('won' / 'lost' / null), `wave` (current wave number), `lives`, `ticks`, `seconds` |
| `totals` | `spawned`, `killed`, `leaked`, `livesLost`, `shots`, `impacts`, `impactsWithHit`, `damageBySource` (7 numbers), `towersBuilt`, `towersSold`, `upgrades`, `gold` (`earnedKills`, `clearBonus`, `spent`, `refunded`) |
| `offWave` | the same aggregates (`byType`, `towerActivity`, `livesLost`) for everything that happened outside a wave |
| `waves` | one record per started wave |
| `towers` | one record per tower ever built (alive and sold) |
| `enemies` | one record per enemy (full detail only), sorted by id |

Floats in `result`, `totals`, `offWave`, `waves`, `towers` and `enemies` are rounded to 6 decimals (`config.telemetry.floatDigits`); CSV floats to 4 (`csvFloatDigits`). `meta`, `config` and `definitions` are exact copies: rounding `stepSeconds` would skew every derived time.

## Wave record

`wave`, `name`, `fixed`, `complete`, `mode`, `startTick`, `endTick`, `seconds` ((endTick - startTick) x stepSeconds), `hpMult`, `budget` (target threat), `threat` (realized base threat), `composition` and `picks` (units / picks per enemy type), `spawnedUnits`, `killed`, `leaked`, `livesLost`, `livesAfter`, `loadout`, `gold`, `byType`, `towerActivity`, `director`.

- `loadout` is a read-only snapshot at wave start: `totalTowers`, `totalInvested`, `nominalDps` (sum of the display dps of every tower), `byType[tower] = { count, levels: [count at level 0, 1, 2] }`.
- `byType[enemy]` (all five types always present, in ENEMY_ORDER): `spawned`, `killed`, `leaked`, `leakRate` (leaked / spawned), `meanProgress` (progress at death or leak, leaked = 1, averaged over killed + leaked), `meanTimeAliveSeconds`, `progressSum`, `timeAliveTicksSum`, `damageTaken`, `damageBySource`, `killedBySource`. Sources are `lance, mortar, frost, poison, sniper` (the tower type that dealt the damage), `debug` (damage without a source) and `other` (any unknown source).
- `towerActivity[tower]`: `shots`, `impacts`, `impactsWithHit`.
- `director`: null until `attachDirector(wave, record)` stores a deep copy.

## Tower record

`id`, `type`, `col`, `row`, `builtTick`, `builtWave`, `builtPhase` (wave phase when built), `cost`, `upgrades` (`{ level, tick, wave, cost }`), `finalLevel`, `invested`, `sold`, `soldTick`, `soldWave`, `refund` (the last three are null until sold), `damageDealt`, `kills`, `shots`, `damageByEnemyType`, `killsByEnemyType`.

## Enemy record (full detail)

`id`, `type`, `wave` (0 = outside a wave), `hpMult`, `spawnTick`, `maxHp`, `maxShield`, `outcome` ('killed' / 'leaked' / 'alive'), `outcomeTick`, `timeAliveTicks`, `progress` (0..1 along the path; 1 for a leak), `damageTaken`, `damageBySource` (7 fields), `killer` (`{ source, towerId }`, null for leaks and living enemies; `towerId` is -1 for non-tower sources). Enemies still alive when `getRun()` is called get outcome 'alive' and their current progress.

## Attribution rules

1. **Enemies belong to the wave that was open when they spawned.** An enemy spawned while a wave is open is counted in that wave, no matter when it dies. Debug spawns made while no wave is open (preparation, intermission) go to `offWave`. (The brief said "ENEMY_SPAWNED.wave, wave 0 to offWave"; the sim reports the last finished wave for spawns during an intermission, which would corrupt a closed wave, so the open wave decides.)
2. **Damage** (`ENEMY_DAMAGED`) adds to the enemy record, to its wave's `damageBySource[source]` and, when `towerId >= 0`, to that tower's `damageDealt` and `damageByEnemyType[type]`.
3. **Kills** add `killed`, `progressSum`, `timeAliveTicksSum`, `killedBySource[source]`, the tower's `kills` / `killsByEnemyType` and the enemy's `killer`. A poison damage-over-time kill is credited to `poison` and to the tower that applied the poison last.
4. **Leaks** add `leaked`, progress 1 and time alive; the enemy's outcome is 'leaked'.
5. **Shots and impacts** go to the tower's `shots` and to the open wave's `towerActivity` (`offWave` when no wave is open, for example shells still flying after the wave ended).
6. **Lives lost** go to the open wave (`offWave` when none); `livesAfter` is the lives value reported when the wave ends.
7. The collector keeps its **own tower counters**, because the sim removes a sold tower from `game.towers` before it emits the sold event.

## Gold buckets

Per wave record, `gold` holds: `atStart` (gold when the wave starts), `prepSpent` and `prepRefunded` (builds, upgrades and sells made while no wave was open, since the previous wave ended or the game began), then during the wave `earnedKills`, `clearBonus`, `spentDuring`, `refundedDuring`, and `atEnd` (gold at the end event, after the clear bonus). The run level `totals.gold` accumulates every gold event regardless of bucket and equals the sim's `game.stats` (`goldFromKills`, `goldFromBonus`, `goldSpent`, `goldRefunded`).

## The ordering trap and partial waves

When the final leak takes the last life, the lives module (subscribed before telemetry) emits `GAME_OVER` from inside the `ENEMY_LEAKED` event, **before** the collector's own leak handler runs. Therefore `GAME_OVER` only notes the result; it does not freeze or close anything, and handlers keep working for the events that follow on the same tick. A wave that is still open when the run is read is built **on demand** by `getRun()` as a partial record (`complete: false`, `endTick` = current tick, `livesAfter` = current lives, `gold.atEnd` = current gold) without changing collector state, so calling `getRun()` repeatedly is safe.

## How Phase 6 uses this

The Director reads the just-finished wave's `waves[n].byType[type].leakRate` and `meanProgress` (or recomputes them from the same events) and stores its decision (old and new weights, effectiveness inputs, reason) with `attachDirector(wave, record)`; it appears as `waves[n].director` in JSON.

## CSV tables

Rows use `\n`, fields are quoted RFC 4180 style, floats have 4 decimals, booleans are `true` / `false`, null is empty. The `offWave` aggregate is only in the JSON.

**waves.csv** (one row per wave): `wave,name,fixed,complete,mode,start_tick,end_tick,seconds,hp_mult,budget,threat,spawned_units,killed,leaked,lives_lost,lives_after,gold_at_start,prep_spent,prep_refunded,earned_kills,clear_bonus,spent_during,gold_at_end,total_towers,total_invested,nominal_dps,towers_lance,towers_mortar,towers_frost,towers_poison,towers_sniper`

**wavetypes.csv** (five rows per wave): `wave,enemy_type,spawned,killed,leaked,leak_rate,mean_progress,mean_time_alive_seconds,damage_taken,dmg_lance,dmg_mortar,dmg_frost,dmg_poison,dmg_sniper,dmg_debug,dmg_other,killed_lance,killed_mortar,killed_frost,killed_poison,killed_sniper,killed_debug,killed_other`

**enemies.csv** (full detail only): `id,type,wave,hp_mult,spawn_tick,spawn_seconds,max_hp,max_shield,outcome,outcome_tick,time_alive_seconds,progress,damage_taken,dmg_lance,dmg_mortar,dmg_frost,dmg_poison,dmg_sniper,dmg_debug,dmg_other,killer_source,killer_tower_id`

**towers.csv**: `id,type,col,row,built_tick,built_wave,built_phase,cost,final_level,invested,sold,sold_wave,refund,damage_dealt,kills,shots,dmg_vs_armoredGrunt,dmg_vs_swarmling,dmg_vs_fastRunner,dmg_vs_regenerator,dmg_vs_shieldedBruiser`

## How to export

- **Browser:** the end screen has "Download data (JSON)" and "Wave table (CSV)"; the pause menu has "Download run data". File names look like `siege-mind_seed-1_static_quick_won-w15.json`.
- **CLI:** `npm run playthrough -- --bot=balanced --seed=1 --waves=15 --telemetry=full|summary [--out=DIR]` writes `<base>.json`, `.waves.csv`, `.wavetypes.csv`, `.towers.csv` and, for full detail, `.enemies.csv` into `experiments/results/` (or DIR), then validates the run with `validateRun`.
- **Summarize:** `npm run summarize -- path/to/run.json` prints the per-wave, damage-by-source, per-enemy-type and tower tables.
