// Tower definitions. Initial values (Phase 9 rebalances them). Upgrade multipliers are ABSOLUTE vs the base level, not compounding.

const t = (d) => Object.freeze({ ...d, upgrades: Object.freeze(d.upgrades.map((u) => Object.freeze(u))), strongVs: Object.freeze(d.strongVs), weakVs: Object.freeze(d.weakVs) });

export const TOWERS = Object.freeze({
  lance: t({
    id: 'lance', name: 'Lance', hotkey: 'a', cost: 60, kind: 'bolt', range: 150, intervalTicks: 54, damage: 24,
    armorPierce: true, shieldMult: 1, projectileSpeed: 900, defaultTarget: 'first',
    role: 'Piercing bolts that ignore armor; single target, slow against crowds.',
    strongVs: ['armoredGrunt'], weakVs: ['swarmling'],
    upgrades: [
      { cost: 45, damageMult: 1.35, rangeMult: 1.1, intervalMult: 0.9 },
      { cost: 80, damageMult: 1.8, rangeMult: 1.2, intervalMult: 0.8 },
    ],
  }),
  mortar: t({
    id: 'mortar', name: 'Mortar', hotkey: 's', cost: 100, kind: 'shell', range: 170, intervalTicks: 90, damage: 36,
    armorPierce: false, shieldMult: 1, projectileSpeed: 240, splashRadius: 60, splashMinFraction: 0.5, defaultTarget: 'first',
    role: 'Slow area shells aimed where the target is now; fast enemies dodge them.',
    strongVs: ['swarmling'], weakVs: ['fastRunner'],
    upgrades: [
      { cost: 75, damageMult: 1.4, rangeMult: 1.08, intervalMult: 0.9, splashMult: 1.1 },
      { cost: 130, damageMult: 1.9, rangeMult: 1.16, intervalMult: 0.8, splashMult: 1.2 },
    ],
  }),
  frost: t({
    id: 'frost', name: 'Frost', hotkey: 'd', cost: 70, kind: 'pulse', range: 110, intervalTicks: 60, damage: 4,
    armorPierce: true, shieldMult: 1, projectileSpeed: 0, slowFactor: 0.5, slowSeconds: 1.6, defaultTarget: null,
    role: 'Pulses that slow every enemy in range; supports all other towers.',
    strongVs: ['fastRunner'], weakVs: [],
    upgrades: [
      { cost: 50, damageMult: 1.5, rangeMult: 1.1, intervalMult: 0.9, slowFactor: 0.42 },
      { cost: 90, damageMult: 2, rangeMult: 1.2, intervalMult: 0.8, slowFactor: 0.33 },
    ],
  }),
  poison: t({
    id: 'poison', name: 'Poison', hotkey: 'f', cost: 80, kind: 'bolt', range: 140, intervalTicks: 75, damage: 0,
    armorPierce: false, shieldMult: 1, projectileSpeed: 420, poisonDps: 8, poisonSeconds: 4, cloudRadius: 28, defaultTarget: 'first',
    role: 'Stacking poison cloud; stops regeneration, blocked by shields.',
    strongVs: ['regenerator'], weakVs: ['fastRunner', 'shieldedBruiser'],
    upgrades: [
      { cost: 60, dpsMult: 1.4, rangeMult: 1.1, intervalMult: 0.9, cloudMult: 1.2 },
      { cost: 100, dpsMult: 1.9, rangeMult: 1.2, intervalMult: 0.8, cloudMult: 1.4 },
    ],
  }),
  sniper: t({
    id: 'sniper', name: 'Sniper', hotkey: 'g', cost: 120, kind: 'hitscan', range: 320, intervalTicks: 210, damage: 90,
    armorPierce: true, shieldMult: 3, projectileSpeed: 0, defaultTarget: 'strongest',
    role: 'Very long range, slow, heavy shots with triple damage to shields.',
    strongVs: ['shieldedBruiser'], weakVs: ['swarmling', 'fastRunner'],
    upgrades: [
      { cost: 90, damageMult: 1.35, rangeMult: 1.08, intervalMult: 0.9 },
      { cost: 150, damageMult: 1.8, rangeMult: 1.15, intervalMult: 0.8 },
    ],
  }),
});

export const TOWER_ORDER = Object.freeze(['lance', 'mortar', 'frost', 'poison', 'sniper']);
export const TARGET_MODES = Object.freeze(['first', 'strongest', 'closest']);
