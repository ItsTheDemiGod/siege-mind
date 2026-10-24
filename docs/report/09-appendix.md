## Appendix

### File map

| Path | What it holds |
|---|---|
| `index.html`, `gallery.html` | The game page and the style gallery |
| `src/sim` | Pure simulation: map, enemies, towers, projectiles, waves, economy, lives, statistics, the Director arms, telemetry |
| `src/data` | Every tower, enemy, wave and economy number, configuration, the generated Director baseline |
| `src/render` | Canvas drawing, particles, glow sprites, quality tiers, tower and enemy art |
| `src/ui` | DOM interface and the pure view models behind it |
| `src/audio` | Procedural sound catalogue, event mapper, voice limiter, engine, analysis |
| `assets` | Favicon and the vendored fonts with their license texts |
| `experiments` | Bots, batch runner, protocol, statistics, analysis, generators of results and figures |
| `tests` | The test suite, golden files and the freeze tripwire |
| `tools/browser-check` | Headless Chrome tools: smoke checks, audit, screenshots |
| `tools/hygiene` | The public-repository scanner and its allowlist |
| `tools/docs` | The report builder |
| `scripts` | Dev server, static site build, live-URL helper |
| `docs` | Documentation, committed results, fixtures and screenshots |

(`CLAUDE.md`, Folder Structure; `README.md`, Architecture.)

### Documents

| Document | Kind | Purpose |
|---|---|---|
| `README.md` | hand-written | Entry point: pitch, screenshots, controls, modes, architecture, reproducibility |
| `CLAUDE.md` | hand-written | Project brain: rules, specifications, phase tracker, decision log, known issues, session log |
| `docs/DIRECTOR.md` | hand-written | The Director algorithm, configuration keys, decision record, overlay and report |
| `docs/TELEMETRY.md` | hand-written | Telemetry schema, attribution rules, CSV tables |
| `docs/EXPERIMENT.md` | hand-written | The pre-registered protocol, amendments, incident log, held-out procedure |
| `docs/RESULTS.md` | generated | Results of the held-out evaluation |
| `docs/AUDIT.md` | generated | Accessibility and performance audit |
| `docs/PROJECT_REPORT.md` | generated | This report |
| `docs/DEMO_SCRIPT.md` | hand-written | A six-minute demo plan |
| `docs/results/README.md` | hand-written | Explains every committed result file |

### Frozen and generated files

The held-out rows, tables and confirmatory analysis under `docs/results`, the training first-look files, the lock and the Director baseline are frozen or generated study files and are never edited by hand (`CLAUDE.md`, Working Protocol and Decisions Log; `docs/results/README.md`).

### Glossary

- **Threat budget**: the total threat a wave spends, the same in every mode.
- **Tilt**: the bounded weight by which a mode multiplies an enemy type's template share.
- **Held weights**: the weights the Director believes in, computed from its scores, even on waves where it may not adapt.
- **Eligible wave**: a wave in which the composition may differ from the static script.
- **Style bot**: a scripted defense with a fixed tower mix that omits one tower.
- **Style contrast**: how much more weight a Director gives, at a fixed wave, to the enemy type predicted for a defense than it gives the same type against the other defenses.
- **Attribution chain**: the exact decomposition of Director v1's effect into composition variability, a fixed durability lean and learning on top.
- **Held-out lock**: the file that records the single confirmatory run and the commit and protocol it used.
- **Freeze**: the test that fails if the simulation changes after the study.
