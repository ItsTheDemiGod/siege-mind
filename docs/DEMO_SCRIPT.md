# Siege Mind: demo script

A six-minute walk through the game, the Director and the research. Run it from the deployed site or from `npm start` (`http://localhost:8137`). Open each URL in its own browser tab before you start so nothing has to load on stage. Every game is set up by its URL: `seed` fixes the randomness, `mode` picks the enemy side, `waves` picks Quick or Full and `play=1` skips the menu.

| Tab | URL (append to the site address) |
|---|---|
| Menu | `/` |
| Static | `/?seed=7&mode=static&waves=15&play=1` |
| Adaptive | `/?seed=7&mode=adaptive&waves=15&play=1` |
| Gallery | `/gallery.html` |

Use the same seed in both games so the only difference is the enemy side. Static and Adaptive spend the same threat and the same enemy HP in every wave; the first four waves are identical in both.

## Timeline

### 0:00 to 0:45, the idea (menu tab)

- Open the menu. Say it in one sentence: a tower defense where the enemy studies your defense and counters it, with the same budget as the fixed script.
- Point at the mode choice (**Static** is the control group, **Adaptive** is the Director) and at the seed field: the seed makes a run replayable, which the experiments rely on.

### 0:45 to 2:00, building and hotkeys (static tab)

- Press `A` to arm a Lance, click a free tile beside the path; press `S` for a Mortar. Show the counter relationships in the tooltips: each tower is strong against one enemy type and weak against another.
- Show the keyboard route: press `D`, move with the arrow keys, press `Enter` to place, then `Enter` again to start the wave. Show `1`, `2`, `3` for speed and `Space` for pause.
- Click a tower and press `U` to upgrade it; mention that selling returns most of the gold.
- Start the first wave. Point at the wave banner (composition icons) and, between waves, at the incoming-wave preview above the wave control.

### 2:00 to 3:30, the Director (adaptive tab)

- Build a deliberately lopsided defense (for example only Lance and Frost) and play to the first adapted wave. The banner says **Director adapted this wave**.
- Press `I` to open the Director overlay. Walk down one row: the enemy type, its template share becoming its final share, what it did last wave and the plain-language reason. Say that the weights follow how far each type got against your defense, not a hidden difficulty bonus.
- Optional: press `M` to show that the sound can be muted; every sound is generated live.

### 3:30 to 4:15, the end screen and the report

- Let a game finish (or load `/?debug=1&seed=7&mode=adaptive&waves=15&play=1&startlives=1` for a quick loss). On the end card show the wave-by-wave strip, then open **Director's Report**: the insights, the weight chart and the enemy mix against the static template.
- Mention that the data of every run can be downloaded as JSON and CSV.

### 4:15 to 5:00, one slide: what the study found

Slide text, in words only (the numbers are in [RESULTS.md](RESULTS.md) and the figures in `docs/results/figures-final/`; do not retype them):

- The Directors' weights follow the player's defense, mainly for two of the four counter pairings.
- Random composition alone had no detectable effect on lives lost.
- A fixed lean toward durable enemy types reproduces most of Director v1's added difficulty; learning on top is small.
- Director v2 is not detectably harder than static.
- Bots, one map, no human players.

### 5:00 to 6:00, the engineering story

- The simulation is pure and deterministic: fixed timestep, seeded random numbers, an event bus. The same code runs in the browser and headless, which is how thousands of bot games were played.
- Safety nets: the golden files that pin every mode, the balance ladder, and the freeze tripwire that fails if the simulation changes after the held-out run. The held-out set was run once through a lock.
- CI runs the tests, the static site build and the hygiene scan on every push.

## Likely questions

- **Is the adaptive mode harder?** It was in the data for Director v1, but most of that came from a fixed lean toward durable enemies rather than from learning; Director v2 is not detectably different from static. See the Headline and Limits sections of [RESULTS.md](RESULTS.md).
- **Does it make the game more fun?** Not tested. No human played in the study.
- **Is it fair, or just more total difficulty?** Every wave spends the same threat and the same enemy HP as the static script; only the composition changes.
- **Why a random control and a prior control?** To separate "different" from "responds to the defense" and from "leans toward tanky enemies whatever you build".
- **Could the results be tuned afterwards?** No: the protocol, the seed sets and the analysis were registered before the held-out run, the run went through a lock, and the freeze test guards the simulation.
- **What would you do next?** Human playtests, other maps, better Director signals, and a rebalance as a new version outside the study. See [PROJECT_REPORT.md](PROJECT_REPORT.md).
