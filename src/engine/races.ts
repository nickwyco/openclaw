// Playable ancestries. Each grants ability score increases and a passive trait.

import type { AbilityName } from "./types";

export interface RaceDef {
  id: string;
  name: string;
  description: string;
  /** Ability score increases applied on top of rolled scores. */
  bonuses: Partial<Record<AbilityName, number>>;
  /** Passive trait id (see combat.ts for how each is used). */
  trait: string;
  traitName: string;
  traitText: string;
  speed: number;
}

export const RACES: RaceDef[] = [
  {
    id: "human",
    name: "Human",
    description: "Ambitious and adaptable, humans excel at whatever they set their minds to.",
    bonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    trait: "versatile",
    traitName: "Versatile",
    traitText: "+1 to every ability score.",
    speed: 30,
  },
  {
    id: "elf",
    name: "High Elf",
    description: "Graceful and long-lived, elves move with uncanny precision.",
    bonuses: { dex: 2, int: 1 },
    trait: "keen-senses",
    traitName: "Keen Senses",
    traitText: "+2 Dexterity, +1 Intelligence.",
    speed: 30,
  },
  {
    id: "dwarf",
    name: "Mountain Dwarf",
    description: "Hardy folk of stone and steel, dwarves shrug off wounds that would fell others.",
    bonuses: { str: 2, con: 2 },
    trait: "dwarven-toughness",
    traitName: "Dwarven Toughness",
    traitText: "+2 Strength, +2 Constitution, and +1 max HP per level.",
    speed: 25,
  },
  {
    id: "halfling",
    name: "Lightfoot Halfling",
    description: "Small, cheerful, and impossibly fortunate when it counts.",
    bonuses: { dex: 2, cha: 1 },
    trait: "lucky",
    traitName: "Lucky",
    traitText: "+2 Dexterity, +1 Charisma, and reroll natural 1s on attack rolls.",
    speed: 25,
  },
  {
    id: "half-orc",
    name: "Half-Orc",
    description: "Fierce and unyielding, half-orcs refuse to fall while a fight remains.",
    bonuses: { str: 2, con: 1 },
    trait: "relentless",
    traitName: "Relentless Endurance",
    traitText: "+2 Strength, +1 Constitution. Once per battle, drop to 1 HP instead of 0.",
    speed: 30,
  },
];

export function getRace(id: string): RaceDef {
  const race = RACES.find((r) => r.id === id);
  if (!race) throw new Error(`Unknown race: ${id}`);
  return race;
}
