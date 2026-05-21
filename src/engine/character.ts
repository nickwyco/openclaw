// Building and advancing player characters.

import { getClass } from "./classes";
import { rollDie } from "./dice";
import { getRace } from "./races";
import { abilityMod, proficiencyForLevel } from "./rules";
import type { Abilities, AbilityName, Combatant } from "./types";
import { ABILITY_ORDER } from "./types";

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** The classic standard array, offered as a quick alternative to rolling. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

/** Roll six ability scores with 4d6-drop-lowest, sorted highest first. */
export function rollAbilityScores(): number[] {
  const scores: number[] = [];
  for (let i = 0; i < 6; i++) {
    const four = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)].sort((a, b) => b - a);
    scores.push(four[0] + four[1] + four[2]);
  }
  return scores.sort((a, b) => b - a);
}

/** Assign a pool of scores to abilities following a class's priority order. */
export function assignByPriority(scores: number[], priority: AbilityName[]): Abilities {
  const sorted = [...scores].sort((a, b) => b - a);
  const result = {} as Abilities;
  priority.forEach((ability, index) => {
    result[ability] = sorted[index] ?? 10;
  });
  return result;
}

function maxHpFor(hitDie: number, level: number, conMod: number, dwarf: boolean): number {
  let hp = hitDie + conMod; // level 1: full hit die
  const perLevel = Math.floor(hitDie / 2) + 1; // average roll thereafter
  for (let l = 2; l <= level; l++) hp += perLevel + conMod;
  if (dwarf) hp += level; // Dwarven Toughness
  return Math.max(1, hp);
}

function freshUses(actions: Combatant["actions"]): Record<string, number> {
  const uses: Record<string, number> = {};
  for (const a of actions) {
    if (a.maxUses !== undefined) uses[a.id] = a.maxUses;
  }
  return uses;
}

export interface HeroChoice {
  name: string;
  raceId: string;
  classId: string;
  /** Base ability scores before racial bonuses. */
  baseAbilities: Abilities;
}

/** Build a level-1 player character from creation choices. */
export function buildHero(choice: HeroChoice, level = 1): Combatant {
  const race = getRace(choice.raceId);
  const cls = getClass(choice.classId);

  const abilities = { ...choice.baseAbilities };
  for (const ability of ABILITY_ORDER) {
    abilities[ability] += race.bonuses[ability] ?? 0;
  }

  const conMod = abilityMod(abilities.con);
  const dwarf = race.trait === "dwarven-toughness";
  const maxHp = maxHpFor(cls.hitDie, level, conMod, dwarf);
  const actions = cls.actions(level);

  return {
    id: nextId("hero"),
    name: choice.name.trim() || "The Hero",
    side: "party",
    isPlayerControlled: true,
    level,
    xp: 0,
    raceId: race.id,
    raceName: race.name,
    classId: cls.id,
    className: cls.name,
    kind: `${race.name} ${cls.name}`,
    abilities,
    maxHp,
    hp: maxHp,
    baseAc: cls.ac(abilityMod(abilities.dex)),
    proficiency: proficiencyForLevel(level),
    speed: race.speed,
    actions,
    usesLeft: freshUses(actions),
    buffs: [],
    traits: [race.trait],
    initiative: 0,
    alive: true,
  };
}

export interface CompanionTemplate {
  name: string;
  raceId: string;
  classId: string;
  blurb: string;
}

/** Pre-generated party members the player can recruit during creation. */
export const COMPANIONS: CompanionTemplate[] = [
  {
    name: "Bruenor",
    raceId: "dwarf",
    classId: "fighter",
    blurb: "A grizzled dwarf who has never met a wall he couldn't hold.",
  },
  {
    name: "Lyralei",
    raceId: "elf",
    classId: "wizard",
    blurb: "An elven evoker with a fondness for setting things ablaze.",
  },
  {
    name: "Sister Maeve",
    raceId: "human",
    classId: "cleric",
    blurb: "A devout healer whose faith burns as bright as her mace.",
  },
  {
    name: "Pip Nimblefingers",
    raceId: "halfling",
    classId: "rogue",
    blurb: "A halfling scoundrel who finds the soft spots in any defence.",
  },
  {
    name: "Grokk Skullsplitter",
    raceId: "half-orc",
    classId: "fighter",
    blurb: "A half-orc berserker who simply refuses to stay down.",
  },
  {
    name: "Thessaly Vane",
    raceId: "elf",
    classId: "rogue",
    blurb: "An elven duelist who turns every distraction into a killing blow.",
  },
];

/** Build a companion (AI-controlled party member) from a template. */
export function buildCompanion(template: CompanionTemplate, level = 1): Combatant {
  const cls = getClass(template.classId);
  const hero = buildHero(
    {
      name: template.name,
      raceId: template.raceId,
      classId: template.classId,
      baseAbilities: assignByPriority(STANDARD_ARRAY, cls.priority),
    },
    level,
  );
  return { ...hero, id: nextId("ally"), isPlayerControlled: false };
}

/**
 * Advance a party member to a new level: recompute hit points, proficiency,
 * and the action list, healing by the hit points gained.
 */
export function levelUp(c: Combatant, newLevel: number): void {
  if (!c.classId || !c.raceId) return;
  const cls = getClass(c.classId);
  const race = getRace(c.raceId);
  const conMod = abilityMod(c.abilities.con);
  const dwarf = race.trait === "dwarven-toughness";
  const newMax = maxHpFor(cls.hitDie, newLevel, conMod, dwarf);
  const gained = newMax - c.maxHp;

  c.level = newLevel;
  c.maxHp = newMax;
  c.hp = Math.min(newMax, c.hp + Math.max(0, gained));
  c.proficiency = proficiencyForLevel(newLevel);
  c.actions = cls.actions(newLevel);
}
