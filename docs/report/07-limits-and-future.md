## Limits and future work

### Limits of the study

The results section embeds the generated limits and non-claims of the held-out evaluation. In addition, the pre-registration and the decision log record these structural limits (`docs/EXPERIMENT.md`, Threats to validity and Amendment A3, Limits stated in advance):

- The players are scripted bots with a small family of tower mixes, not humans; the study says nothing about enjoyment or fairness as people experience them.
- There is one map and one enemy set, and the simulation is deterministic, so seeds change only enemy lanes and the bots' random choices.
- The bots were calibrated on static outcomes only, and the styles are pooled in the primary analysis.
- Late-wave contrasts are conditional on surviving to that wave, and the coverage rule for the fixed wave was not met.
- The counter arm reads the loadout and is a reference, not a fair competitor.
- The attribution follows one path through the arms.

### Limits of the product

These are open items recorded in the project's known issues (`CLAUDE.md`, Known Issues):

- No human played a structured playtest; visual checks were made in a headless Chrome with software rendering, so animation feel and real frame rates on a GPU are unverified.
- No human has listened to the procedural sounds; only offline analysis (peak, loudness, offset, leading silence) and engine tests exist. Music was left out on purpose.
- The accessibility audit is a practical subset, and keyboard-only play was smoke-tested for building only.
- The continuous integration workflow and the Mermaid architecture diagram in the README could not be run or rendered locally.
- The deployed build keeps the `debug` URL parameters. They are a research tool and harmless for visitors, but they exist.
- The Director's Report modal sits above the end card without hiding it, so the card shows faintly behind the report.

### Out of scope on purpose

Changing the game after the held-out run defines a new version outside the study. The items below were identified and deliberately not done (`CLAUDE.md`, Phase Tracker, study freeze):

- a late-game gold sink such as a third upgrade tier, because the balanced bot ends long games with a large unspent balance;
- separate early and late slopes of the hit point curve, because lives are only lost in the early and middle waves today;
- a finale wave in the Quick game;
- a balance pass and rebalance from harness data, which would require recalibrating the bots;
- a re-check of one clause of the balance ladder.

### Future work

- Human playtests: do people notice the adaptation, does it feel fair, and does the overlay help them understand it?
- Other maps and enemy sets, to see whether the durability bias and the response to the defense carry over.
- Better Director signals: the reward favors durable enemies against most defenses, and Director v2 shows that normalizing against a static baseline removes the bias at the cost of a milder response.
- A rebalance as a new version with its own tag and, if it is to be studied, its own pre-registration.
- Optional music, final visual tuning and a listening pass on the sounds.
