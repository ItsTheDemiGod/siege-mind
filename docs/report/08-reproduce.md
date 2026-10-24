## How to run and reproduce

### Run the game

Node 22 or newer is the only requirement; there are no npm dependencies (`README.md`, Run locally).

```text
npm start          # serves the game at http://localhost:8137 (set PORT to change it)
npm test           # the whole test suite
npm run build:site # writes the static site into dist/
```

A game is set up by its URL: `?seed=<integer or text>&mode=static|adaptive|random|adaptive2|prior|counter&waves=15|30&play=1`. Without `play` or `debug` the menu opens first (`README.md`, Game modes).

### Replay a game headlessly

```text
npm run playthrough -- --bot=balanced --seed=1 --waves=15 --mode=static
npm run playthrough -- --bot=balanced --seed=1 --waves=15 --mode=adaptive
npm run playthrough -- --bot=balanced --seed=1 --waves=15 --mode=random
```

The same seed and bot always give the same result; add `--telemetry=full` to write the run as JSON and CSV and `npm run summarize` to print tables (`README.md`, Run data; `docs/TELEMETRY.md`, How to export).

### Regenerate the study outputs

These commands rebuild the analysis and the documents from the committed data (`docs/EXPERIMENT.md`, Reproduction; `docs/RESULTS.md`, Provenance):

```text
npm run confirm -- --in=docs/results/heldout.rows.json --out=docs/results/heldout-confirmatory
npm run figures:final
npm run results-doc
npm run report-doc
```

The held-out evaluation itself must not be repeated: `experiments/heldout.lock.json` records that it was run, and the command refuses to run again without an explicit new-lock flag, which would be recorded as another run (`docs/EXPERIMENT.md`, The held-out procedure). The exploratory pipeline (`npm run calibrate`, `npm run experiment -- --set=tuning`, `npm run analyze`) is documented in the same place.

### Other checks

```text
npm run smoke:browser   # headless Chrome smoke checks of every page
npm run smoke:dist      # the same checks against the built site
npm run audit           # accessibility and performance audit, writes docs/AUDIT.md
npm run shots           # README screenshots into docs/screens
npm run hygiene         # public-repository scan
```

After deploying, `npm run smoke:live -- --base=<url>` runs the smoke checks against the live address and `npm run set-live-url -- --url=<url>` records the address in the README (`README.md`, Site build).

### Verifying that the study is untouched

The freeze test fails on any change under `src/sim` or `src/data`, the lock must match the protocol hash, and the held-out files carry recorded hashes in the Provenance section of the results document (`docs/RESULTS.md`, Provenance; `tests/study-freeze.test.js`).
