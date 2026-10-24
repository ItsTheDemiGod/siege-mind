## The game

### The map and the rules

There is one fixed, winding map on a tile grid with a single entry and a single base, drawn as a dark holographic tactical table; towers are placed only on buildable tiles beside the path, and a few decor tiles are blocked (`CLAUDE.md`, Game Design Spec). The player starts with some gold and a number of lives; kills and cleared waves pay gold, upgrades and selling are allowed, and tower prices grow with the number of towers owned, with a cap on the total (`CLAUDE.md`, Game Design Spec; Decisions Log, difficulty rework). A leaking enemy costs lives, and losing all lives ends the game (`CLAUDE.md`, Game Design Spec).

A game is a Quick game of 15 waves (the default) or a Full game of 30 waves. Both use the same wave script, hit point curve and economy; Quick simply ends after wave 15 (`CLAUDE.md`, Game length). A game is fully described by its URL: seed, mode, game length and whether to skip the menu (`CLAUDE.md`, Menu and URL flow; `README.md`).

### Towers

Five towers, each with two upgrade levels and three targeting modes, and each strong against one enemy type and weak against another (`CLAUDE.md`, Towers):

| Tower | Role | Strong against | Weak against |
|---|---|---|---|
| Lance | homing, armor-piercing bolt | Armored Grunt | Swarmling |
| Mortar | ballistic shell with splash damage | Swarmling | Fast Runner and tanky single enemies |
| Frost | pulse that slows everything in range | Fast Runner; supports every tower | low standalone damage |
| Poison | bolt that poisons a small area and stops regeneration | Regenerator | Fast Runner, Shielded Bruiser |
| Sniper | instant, armor-piercing shot with bonus damage against shields | Shielded Bruiser | Swarmling, Fast Runner |

The counter relationships were checked by a headless matchup harness and tests, not only by feel (`CLAUDE.md`, Phase Tracker, tower logic; Decisions Log, matchup relations).

### Enemies

Five enemy types, each identifiable by silhouette and color (`CLAUDE.md`, Enemies and Visual Design Bible):

- **Armored Grunt**: a hexagon with flat armor.
- **Swarmling**: small triangles that arrive in packs.
- **Fast Runner**: an elongated chevron that is much faster than the rest.
- **Regenerator**: a circle with a pulsing ring that heals unless poisoned and costs extra lives when it leaks.
- **Shielded Bruiser**: a large octagon whose shield must break first, which also blocks damage over time, and which costs extra lives when it leaks.

### Waves

Every wave has a threat budget that follows a fixed curve, and the static script builds each wave from a hand-authored template of threat shares; enemy hit points and shields scale with the wave number while armor, speed, rewards and threat costs stay flat (`CLAUDE.md`, Waves). The opening waves introduce the enemy types one by one, three waves are fixed set pieces (wave 10 'The Vanguard', wave 20 'Tide of Swarm', wave 30 'The Siege'), and the waves in between rotate themes (`CLAUDE.md`, Waves).

### The six modes

All modes spend the same threat per wave and apply the same enemy hit points; only the composition of eligible waves differs (`docs/EXPERIMENT.md`, Research question; `docs/DIRECTOR.md`).

- **Static**: the hand-authored waves, the control group.
- **Adaptive** (Director v1): after every finished wave it scores each enemy type by how far it got against the defense, per unit of threat, and tilts the next eligible wave toward the types that scored well (`docs/DIRECTOR.md`, Observation and Composition).
- **Random control**: tilts waves at random by the same amount and learns nothing, so results can be compared against waves that are merely different (`docs/DIRECTOR.md`, Random control).
- **Director v2** (research arm): divides each type's reward by what that type usually earns in static games, and shrinks the estimate for types with few units (`docs/DIRECTOR.md`, Director v2).
- **Prior control** (research arm): fixed weights taken from the static baseline alone, with no learning and no look at the defense (`docs/DIRECTOR.md`, Prior control).
- **Counter arm** (research arm): reads the tower loadout directly; it is a reference for what a Director with that knowledge could do, not a fair competitor (`docs/DIRECTOR.md`, Informed counter arm).

The menu offers Static and Adaptive; the other modes are reachable only through the URL (`README.md`, Game modes).

### Explaining the Director

The Director overlay (key `I`) shows, for the upcoming wave, each enemy type's template share, final share, weight and the evidence behind it, in plain language and with a small chart; direction marks in the wave banner and preview show which types were raised or lowered, and the end screen offers a Director's Report with insights, a weight chart and the enemy mix against the static template (`docs/DIRECTOR.md`, Reading the overlay and The Director's Report). The insight texts are descriptive rather than causal on purpose (`CLAUDE.md`, Decisions Log, explainability).

### Presentation

All visuals are procedural: canvas drawing with pooled particles, glow sprites and quality tiers, DOM and CSS for text, hand-built SVG for icons and charts (`CLAUDE.md`, Tech Stack and Visual Design Bible). Every sound is generated live with the Web Audio API from oscillators and filtered noise, with a voice limiter, volume and mute settings and a Sound lab that analyzes each sound offline (`CLAUDE.md`, Decisions Log, procedural audio). First-run hints, a keyboard tile cursor and reduced-motion support round out accessibility (`CLAUDE.md`, Decisions Log, hints and keyboard cursor; `docs/AUDIT.md`).
