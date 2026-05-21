// Core 5e-style rules math.

import type { Combatant } from "./types";

/** Ability modifier: (score - 10) / 2, rounded down. */
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Proficiency bonus scales with level: +2 at 1-4, +3 at 5-8, etc. */
export function proficiencyForLevel(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

/**
 * Total XP required to reach each level. Tuned for the bundled campaign so
 * the party climbs from level 1 to roughly level 3-4 before the final boss.
 */
const XP_THRESHOLDS = [0, 0, 150, 400, 700, 1100, 1600];

export function levelForXp(xp: number): number {
  let level = 1;
  for (let l = 2; l < XP_THRESHOLDS.length; l++) {
    if (xp >= XP_THRESHOLDS[l]) level = l;
  }
  return level;
}

export function xpForNextLevel(level: number): number | null {
  return XP_THRESHOLDS[level + 1] ?? null;
}

/** Format a modifier with an explicit sign, e.g. +3 or -1. */
export function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Armour class including any active buffs. */
export function effectiveAc(c: Combatant): number {
  return c.baseAc + c.buffs.reduce((sum, b) => sum + (b.acBonus ?? 0), 0);
}

/** Sum of attack-roll bonuses granted by active buffs. */
export function buffAttackBonus(c: Combatant): number {
  return c.buffs.reduce((sum, b) => sum + (b.attackBonus ?? 0), 0);
}

/** Sum of damage bonuses granted by active buffs. */
export function buffDamageBonus(c: Combatant): number {
  return c.buffs.reduce((sum, b) => sum + (b.damageBonus ?? 0), 0);
}
