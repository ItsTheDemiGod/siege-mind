## Architecture

The code is vanilla JavaScript with ES modules, the HTML canvas element and no framework, no bundler and no runtime dependencies; Node is used only for development tooling, tests and headless simulation (`CLAUDE.md`, Tech Stack and Hard Constraints; `THIRD_PARTY.md`). Eight architecture rules were fixed at the start and every change to them had to be logged (`CLAUDE.md`, Architecture Rules).

### Rules that shape everything

1. **Sim and render are separate.** Everything in `src/sim` is pure game logic with no reference to the window, the document, a canvas or any DOM API, so it runs unchanged in Node; `src/render` and `src/ui` read state and never mutate it. A test enforces the purity (`tests/sim-purity.test.js`; `CLAUDE.md`, Decisions Log, simulation purity).
2. **Fixed timestep.** The simulation advances in fixed steps. Game speed means more steps per rendered frame, never a larger step, and a frame-time clamp prevents a spiral of death (`CLAUDE.md`, Architecture Rules and Decisions Log, stepper).
3. **Seeded randomness.** All simulation randomness goes through one seeded generator with independent forked streams, so the Director's randomness does not shift when combat code consumes more numbers (`CLAUDE.md`, Decisions Log, RNG).
4. **Data-driven design.** Every tower, enemy, wave and economy number lives in `src/data`.
5. **Event bus.** The simulation emits events (wave started and ended, enemy spawned, killed or leaked, tower placed or fired, game over); telemetry, audio, particles and the interface subscribe instead of being called from simulation code (`CLAUDE.md`, Architecture Rules).
6. **Serializable state.** Game state is plain objects and arrays, so runs can be logged, snapshotted and compared.
7. **Small modules.** One responsibility per file, around three hundred lines at most.
8. **Render performance rules.** No per-frame allocation in hot paths, pooled particles and projectiles, cached glow sprites instead of shadow blur, a cached static background, a pixel-ratio-aware canvas and interpolation between simulation steps (`CLAUDE.md`, Architecture Rules).

### Layers

```text
data  ->  sim (pure, fixed timestep, seeded RNG)  ->  event bus  ->  render | ui | audio | telemetry
                       |
                       +-->  headless experiments: bots, batch runner, statistics  ->  results  ->  generated documents and figures
```

- `src/sim` holds the map, enemies, towers, projectiles, waves, the economy, lives, statistics and the Director arms. The Director math uses only basic arithmetic, comparisons and a few Math functions, and avoids power, exponential and logarithm functions so that every JavaScript engine gives the same numbers (`CLAUDE.md`, Director AI Spec, Numeric rules; Decisions Log, Director).
- `src/render` draws the canvas: a cached static layer, animated path flow, entities, additive effects and overlays (`CLAUDE.md`, Visual Design Bible, Rendering).
- `src/ui` is the DOM and CSS interface, driven by CSS variables that mirror the render theme; a test keeps the two in sync (`CLAUDE.md`, Decisions Log, theme parity). Pure view models (for example the Director overlay, the end screen, the keyboard cursor and the hint placement) are separated from the DOM code so they can be tested without a browser.
- `src/audio` is a procedural synthesizer driven only by simulation events, inert until the first user gesture (`CLAUDE.md`, Decisions Log, procedural audio).

### Reuse for experiments

Because the simulation is pure, the experiment harness imports the same modules the browser uses: scripted bots act only through simulation commands, the batch runner plays whole games headlessly and the same game reaches the same result from the same seed (`CLAUDE.md`, Decisions Log, style bots; Experiment Harness Spec). The Director is independent of telemetry, and telemetry is observation only: it copies primitives out of events, never writes game state and never uses a clock or a random number, which a test proves by comparing snapshots with and without it (`CLAUDE.md`, Telemetry Spec and Decisions Log, telemetry; `docs/TELEMETRY.md`).

### Telemetry

A run exports as one self-describing JSON object (configuration and definitions included) and four CSV tables (waves, wave by enemy type, enemies, towers); a validator checks the consistency of a run, and a documentation test checks every column (`docs/TELEMETRY.md`). Each wave also carries the Director's decision record, which is what the overlay and the report read (`docs/DIRECTOR.md`, The decision record).

### Deployment shape

The deployed site is a static build: a script copies the pages, the whole `src` tree (the browser imports the simulation and data modules too), the assets, the gallery fixture and the final figures into a `dist` folder and writes a manifest of sizes and hashes; nothing else ships (`scripts/build-site.js`; `README.md`, Site build). The build is described in the Engineering section.
