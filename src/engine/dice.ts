// Dice rolling — the heart of any D&D system.

export interface RollResult {
  total: number;
  rolls: number[];
  modifier: number;
  notation: string;
}

/** Roll a single die with the given number of sides. */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Roll dice from standard notation, e.g. "2d6+3", "d20", "1d8-1".
 * Whitespace is ignored. The count defaults to 1.
 */
export function roll(notation: string): RollResult {
  const cleaned = notation.replace(/\s+/g, "").toLowerCase();
  const match = cleaned.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!match) {
    throw new Error(`Invalid dice notation: "${notation}"`);
  }
  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(sides));
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return { total: Math.max(0, total), rolls, modifier, notation };
}

export type Advantage = "normal" | "advantage" | "disadvantage";

export interface D20Result {
  /** The d20 face used after applying advantage/disadvantage. */
  die: number;
  /** Both d20 faces rolled (one of them is `die`). */
  faces: number[];
  total: number;
  modifier: number;
  advantage: Advantage;
  crit: boolean;
  fumble: boolean;
}

/** Roll a d20 check/attack with a modifier and optional advantage state. */
export function rollD20(modifier: number, advantage: Advantage = "normal"): D20Result {
  const a = rollDie(20);
  const b = rollDie(20);
  let die = a;
  if (advantage === "advantage") die = Math.max(a, b);
  else if (advantage === "disadvantage") die = Math.min(a, b);
  return {
    die,
    faces: [a, b],
    total: die + modifier,
    modifier,
    advantage,
    crit: die === 20,
    fumble: die === 1,
  };
}

/** Average result of a dice notation — used to estimate hit-point totals. */
export function average(notation: string): number {
  const match = notation.replace(/\s+/g, "").toLowerCase().match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!match) return 0;
  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  return Math.floor(count * ((sides + 1) / 2)) + modifier;
}

/** Pick a random element from a non-empty array. */
export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
