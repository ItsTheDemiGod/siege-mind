## Engineering practice

### Tests

The whole suite runs on Node's built-in test runner with a single command (`CLAUDE.md`, Coding Conventions; `README.md`, Tests and the freeze). Beyond unit tests of the simulation modules it contains:

- **Determinism tests**: the same seed and the same bot give identical results (`CLAUDE.md`, Coding Conventions).
- **Golden files**: the static waves and their threat were generated before the wave composer was refactored and are never regenerated, which proves the refactor left Static bit for bit unchanged; later goldens pin the director payloads and results of every mode, so changing one mode cannot silently change another (`CLAUDE.md`, Decisions Log, Director and goldens).
- **A balance ladder**: bots of increasing strength must lose at increasingly late waves, which guards the shape of the difficulty rather than a single win or lose number (`CLAUDE.md`, Decisions Log, difficulty rework), and a calibration guard that fails when the balance changes in a way that requires recalibrating the experiment bots (`docs/EXPERIMENT.md`, Players).
- **Parity and rule tests**: the style sheet must mirror the render theme, z-index values must be tokens, and render rule tests search the drawing code for forbidden techniques such as shadow blur (`CLAUDE.md`, Decisions Log, theme parity and z-index tokens; Folder Structure, tests).
- **Documentation tests**: the telemetry documentation must mention every column, superseded statements must carry a pointer to the held-out result, and the generated documents guard their own wording (see below) (`docs/TELEMETRY.md`; `CLAUDE.md`, Decisions Log, results document).

### The freeze tripwire

After the held-out evaluation the simulation and data folders were frozen: a test hashes them and fails on any change, and checks that the held-out lock belongs to the current protocol. A change to the game therefore defines a new version outside the study and requires updating the pinned hash on purpose (`tests/study-freeze.test.js`; `CLAUDE.md`, Phase Tracker, study freeze). Work after the freeze touched only interface, rendering, audio, documentation and deployment.

### Generated documents with guards

The results document, the figures and this report are produced by scripts. No number is typed by hand in a generated document. The results generator throws if the confirmatory outcome differs from the outcome its fixed sentences describe, and every claim in those sentences is checked against named thresholds, so a different result cannot silently produce stale text (`CLAUDE.md`, Decisions Log, results document; `docs/RESULTS.md`). The same rule applies to hand-written documents: they use words and file pointers instead of numbers that exist in generated outputs (`CLAUDE.md`, Decisions Log, results package).

### Accessibility and performance audit

An audit tool drives a headless Chrome through the main screens and applies pure rules: accessible names and roles, dialogs and focus traps, focus rings, text contrast, overflow at several window sizes, reduced motion and frame times in the stress mode; its output is the generated `docs/AUDIT.md`. It is a practical subset, not a full WCAG audit, and entries drawn over the canvas are listed as unresolved rather than passed (`docs/AUDIT.md`; `CLAUDE.md`, Decisions Log, audit). It found and led to fixes for a muted text color below the contrast limit on a selected menu option and duplicate SVG pattern ids in the Director legend (`CLAUDE.md`, Decisions Log, audit). Frame times were measured with software rendering only; a real GPU was not measured (`CLAUDE.md`, Known Issues).

### Browser checks and screenshots

Dev tools drive a local headless Chrome over the DevTools protocol using only Node built-ins: a smoke check loads every page and exercises key flows (keyboard building, the hint card position, the Sound lab analysis, stress mode), and a screenshot tool produces the README images and validates their size and byte range (`README.md`, Browser checks; `tools/browser-check`). These tools are not part of the test suite because they need a browser.

### Continuous integration and the static site build

A GitHub Actions workflow runs on every push to the main branch and on pull requests: it checks out the full history and tags, installs Node, runs the tests, builds the static site and runs the hygiene scan (`.github/workflows/ci.yml`). The site build copies only what the browser needs, writes a deterministic manifest and refuses to clean any folder other than its own output; tests check that every script, stylesheet, module import and font reachable from the two pages exists with the exact letter case, because a case-insensitive development machine would hide errors that a Linux server shows (`scripts/build-site.js`, `tests/siteBuild.test.js`). The workflow could not be executed locally; it is covered by structure tests only (`CLAUDE.md`, Known Issues).

### Public repository hygiene

The repository is public. A scanner reads the tracked files and reports personal home paths, e-mail addresses, access tokens and key patterns, tracked environment files and oversized files; an allowlist may name only frozen or generated study files, each with a reason, and the tests reject an allowlist entry for any editable file (`tools/hygiene`; `CLAUDE.md`, Decisions Log, public repository). The code is released under the MIT license and the two vendored font families under the SIL Open Font License (`LICENSE`, `THIRD_PARTY.md`).

### Working protocol

The project was built phase by phase with Claude Code. Each phase began by reading the project brain file, worked only on the current phase, ended with the tests, an update of the phase tracker, the decision log, the known issues and the session log, and a commit and tag; the next phase began only when the user said so (`CLAUDE.md`, Working Protocol and Session Log).
