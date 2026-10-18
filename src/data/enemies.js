// Enemy definitions. Initial values (Phase 9 rebalances them). Ids match the theme enemy color keys.

const def = (d) => Object.freeze(d);

export const ENEMIES = Object.freeze({
  armoredGrunt: def({
    id: 'armoredGrunt', name: 'Armored Grunt', hp: 120, speed: 55, armor: 6, regenFraction: 0, shield: 0, shieldBlocksDot: false,
    packSize: 1, packIntervalTicks: 0, threatCost: 10, reward: 10, leakDamage: 1, radius: 16,
  }),
  swarmling: def({
    id: 'swarmling', name: 'Swarmling', hp: 28, speed: 70, armor: 0, regenFraction: 0, shield: 0, shieldBlocksDot: false,
    packSize: 8, packIntervalTicks: 12, threatCost: 3, reward: 2, leakDamage: 1, radius: 9,
  }),
  fastRunner: def({
    id: 'fastRunner', name: 'Fast Runner', hp: 45, speed: 130, armor: 0, regenFraction: 0, shield: 0, shieldBlocksDot: false,
    packSize: 1, packIntervalTicks: 0, threatCost: 8, reward: 6, leakDamage: 1, radius: 12,
  }),
  regenerator: def({
    id: 'regenerator', name: 'Regenerator', hp: 260, speed: 45, armor: 1, regenFraction: 0.02, shield: 0, shieldBlocksDot: false,
    packSize: 1, packIntervalTicks: 0, threatCost: 16, reward: 16, leakDamage: 2, radius: 14,
  }),
  shieldedBruiser: def({
    id: 'shieldedBruiser', name: 'Shielded Bruiser', hp: 220, speed: 38, armor: 3, regenFraction: 0, shield: 160, shieldBlocksDot: true,
    packSize: 1, packIntervalTicks: 0, threatCost: 24, reward: 24, leakDamage: 3, radius: 22,
  }),
});

export const ENEMY_ORDER = Object.freeze(['armoredGrunt', 'swarmling', 'fastRunner', 'regenerator', 'shieldedBruiser']);
export const ENEMY_IDS = ENEMY_ORDER;
