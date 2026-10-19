// First-run hint texts and card geometry. These live here (not in src/data) because the study freezes src/data.

export const HINTS = Object.freeze([
  Object.freeze({ id: 'build', text: 'Build a tower: press A to G or click one in the top bar, then click a glowing slot beside the path.' }),
  Object.freeze({ id: 'start', text: 'Press Enter or the Start button to send the wave. Speed: keys 1, 2, 3. Pause: Space.' }),
  Object.freeze({ id: 'upgrade', text: 'Wave cleared. Click a tower to upgrade it (U) or sell it (Delete). Gold comes from kills and wave bonuses.' }),
  Object.freeze({ id: 'director', text: 'The enemy adapts to your defense. Press I to see how the Director is reacting.' }),
]);

/** Logical px at the 1280x720 stage; the card top is the HUD height plus topOffset. */
export const HINT_GEOMETRY = Object.freeze({ width: 300, margin: 16, maxHeight: 96, topOffset: 8, left: 16, autoHideSeconds: 14, delaySeconds: 0.8 });

/** Modes in which the Director hint may appear (the Director modes the menu offers). */
export const DIRECTOR_HINT_MODES = Object.freeze(['adaptive', 'adaptive2']);
