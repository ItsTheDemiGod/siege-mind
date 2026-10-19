// Text for the main menu and the how-to-play screen. Frozen; lengths are checked by tests/menuText.test.js.

export const MODES = Object.freeze([
  Object.freeze({ id: 'static', label: 'Static', available: true, blurb: 'Fixed waves, the same every run. The control group.' }),
  Object.freeze({ id: 'adaptive', label: 'Adaptive', available: true, blurb: 'The enemy studies your defense and counters it' }),
]);

/** The random control mode is reachable only through ?mode=random, so it is not part of MODES. */
export const RANDOM_CONTROL = Object.freeze({ label: 'Random control', blurb: 'A control mode: enemy mixes are tilted at random' });

export const LENGTH_OPTIONS = Object.freeze([
  Object.freeze({ waves: 15, label: 'Quick', blurb: '15 waves, about 20 min at normal speed' }),
  Object.freeze({ waves: 30, label: 'Full', blurb: '30 waves, about 45 min at normal speed' }),
]);

export const ENEMY_BLURBS = Object.freeze({
  armoredGrunt: 'Plating shaves flat damage off every hit. Piercing shots ignore it.',
  swarmling: 'Weak, but it arrives in packs of eight. Splash damage clears them fast.',
  fastRunner: 'Twice as quick as a grunt. Slow shells miss it, so freeze it first.',
  regenerator: 'Heals itself over time unless it is poisoned.',
  shieldedBruiser: 'A shield soaks up damage and blocks poison until it breaks.',
});

export const HOW_TO_STEPS = Object.freeze([
  'Goal: stop enemies reaching your base. Each leak costs lives; lose them all and you lose.',
  'Build a tower with A S D F G or the tray at the top, then click a free tile (right click cancels).',
  'Click a tower to select it. U upgrades it, Delete sells it, and its panel changes how it targets.',
  'Press Enter to start a wave. The next wave also starts by itself after a short break.',
  'Gold comes from kills and from a bonus for every cleared wave. Tower prices rise with each tower you own.',
  'Speed is 1 2 3, Space pauses, and Esc opens the menu.',
]);

export const MENU_LIMITS = Object.freeze({ blurb: 120, step: 160, label: 24 });
