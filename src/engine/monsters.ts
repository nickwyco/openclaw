// Monster stat blocks and encounter construction.

import { nextId } from "./character";
import { roll } from "./dice";
import type { Abilities, CombatAction, Combatant } from "./types";

export interface MonsterDef {
  id: string;
  name: string;
  description: string;
  abilities: Partial<Abilities>;
  /** Hit point dice, rolled fresh for each monster. */
  hpDice: string;
  ac: number;
  proficiency: number;
  speed: number;
  /** Experience awarded for defeating one of these. */
  xp: number;
  actions: CombatAction[];
}

function abilities(partial: Partial<Abilities>): Abilities {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...partial };
}

export const MONSTERS: Record<string, MonsterDef> = {
  goblin: {
    id: "goblin",
    name: "Goblin",
    description: "A small, vicious raider with a rusty blade.",
    abilities: { str: 8, dex: 14, con: 10 },
    hpDice: "2d6",
    ac: 15,
    proficiency: 2,
    speed: 30,
    xp: 50,
    actions: [
      {
        id: "scimitar",
        name: "Scimitar",
        description: "A wild slash with a notched blade.",
        type: "weapon",
        target: "enemy",
        ability: "dex",
        proficient: true,
        damage: "1d6",
        addAbilityToDamage: true,
      },
    ],
  },
  skeleton: {
    id: "skeleton",
    name: "Skeleton",
    description: "Animated bones that clatter forward without fear.",
    abilities: { str: 10, dex: 14, con: 15 },
    hpDice: "2d8+4",
    ac: 13,
    proficiency: 2,
    speed: 30,
    xp: 50,
    actions: [
      {
        id: "bone-blade",
        name: "Rusted Shortsword",
        description: "A jagged thrust of corroded iron.",
        type: "weapon",
        target: "enemy",
        ability: "dex",
        proficient: true,
        damage: "1d6",
        addAbilityToDamage: true,
      },
    ],
  },
  hobgoblin: {
    id: "hobgoblin",
    name: "Hobgoblin",
    description: "A disciplined soldier in battered chainmail.",
    abilities: { str: 13, dex: 12, con: 12 },
    hpDice: "2d8+2",
    ac: 18,
    proficiency: 2,
    speed: 30,
    xp: 100,
    actions: [
      {
        id: "war-longsword",
        name: "Longsword",
        description: "A trained, measured cut.",
        type: "weapon",
        target: "enemy",
        ability: "str",
        proficient: true,
        damage: "1d8",
        addAbilityToDamage: true,
      },
    ],
  },
  orc: {
    id: "orc",
    name: "Orc",
    description: "A snarling brute swinging a heavy axe.",
    abilities: { str: 16, dex: 12, con: 16 },
    hpDice: "2d8+6",
    ac: 13,
    proficiency: 2,
    speed: 30,
    xp: 100,
    actions: [
      {
        id: "greataxe",
        name: "Greataxe",
        description: "A brutal overhead chop.",
        type: "weapon",
        target: "enemy",
        ability: "str",
        proficient: true,
        damage: "1d12",
        addAbilityToDamage: true,
      },
    ],
  },
  "giant-spider": {
    id: "giant-spider",
    name: "Giant Spider",
    description: "A hairy horror the size of a pony, dripping venom.",
    abilities: { str: 14, dex: 16, con: 12 },
    hpDice: "4d10",
    ac: 14,
    proficiency: 2,
    speed: 30,
    xp: 200,
    actions: [
      {
        id: "spider-bite",
        name: "Bite",
        description: "Fangs sink in, seeking flesh.",
        type: "weapon",
        target: "enemy",
        ability: "dex",
        proficient: true,
        damage: "1d8",
        addAbilityToDamage: true,
      },
      {
        id: "venom",
        name: "Venom Spray",
        description: "A spray of poison. Constitution save for half.",
        type: "save",
        target: "enemy",
        ability: "con",
        proficient: true,
        damage: "2d8",
        saveAbility: "con",
        saveForHalf: true,
        maxUses: 2,
      },
    ],
  },
  "dire-wolf": {
    id: "dire-wolf",
    name: "Dire Wolf",
    description: "A wolf grown monstrous, fast and relentless.",
    abilities: { str: 17, dex: 15, con: 15 },
    hpDice: "5d10+5",
    ac: 14,
    proficiency: 2,
    speed: 50,
    xp: 200,
    actions: [
      {
        id: "wolf-bite",
        name: "Savage Bite",
        description: "A lunging bite that drags prey down.",
        type: "weapon",
        target: "enemy",
        ability: "str",
        proficient: true,
        damage: "2d6",
        addAbilityToDamage: true,
      },
    ],
  },
  ogre: {
    id: "ogre",
    name: "Ogre",
    description: "A towering slab of muscle with a tree-trunk club.",
    abilities: { str: 19, dex: 8, con: 16 },
    hpDice: "7d10+21",
    ac: 11,
    proficiency: 2,
    speed: 40,
    xp: 450,
    actions: [
      {
        id: "greatclub",
        name: "Greatclub",
        description: "A sweeping blow that flattens armour.",
        type: "weapon",
        target: "enemy",
        ability: "str",
        proficient: true,
        damage: "2d8",
        addAbilityToDamage: true,
      },
    ],
  },
  "cult-acolyte": {
    id: "cult-acolyte",
    name: "Cult Acolyte",
    description: "A robed zealot muttering profane prayers.",
    abilities: { str: 11, dex: 12, con: 12, wis: 14 },
    hpDice: "3d8",
    ac: 12,
    proficiency: 2,
    speed: 30,
    xp: 100,
    actions: [
      {
        id: "shadow-bolt",
        name: "Shadow Bolt",
        description: "A bolt of clinging darkness.",
        type: "spellAttack",
        target: "enemy",
        ability: "wis",
        proficient: true,
        damage: "2d6",
      },
      {
        id: "dark-prayer",
        name: "Dark Prayer",
        description: "Shadows knit a wounded ally's flesh.",
        type: "heal",
        target: "ally",
        ability: "wis",
        proficient: false,
        heal: "2d8",
        addAbilityToDamage: true,
        maxUses: 2,
      },
    ],
  },
  "bone-tyrant": {
    id: "bone-tyrant",
    name: "Malgrith, the Bone Tyrant",
    description:
      "An ancient necromancer wreathed in cold green fire, the master of this dungeon.",
    abilities: { str: 11, dex: 14, con: 16, int: 16, wis: 15, cha: 16 },
    hpDice: "10d8+30",
    ac: 16,
    proficiency: 3,
    speed: 30,
    xp: 1800,
    actions: [
      {
        id: "withering-touch",
        name: "Withering Touch",
        description: "A grasp that rots flesh from bone.",
        type: "spellAttack",
        target: "enemy",
        ability: "int",
        proficient: true,
        damage: "2d6",
      },
      {
        id: "bone-spear",
        name: "Bone Spear",
        description: "A spear of jagged bone hurled with arcane force.",
        type: "spellAttack",
        target: "enemy",
        ability: "int",
        proficient: true,
        damage: "3d8",
        maxUses: 3,
      },
      {
        id: "necrotic-burst",
        name: "Necrotic Burst",
        description: "A wave of grave-cold death. Constitution save for half.",
        type: "save",
        target: "all-enemies",
        ability: "int",
        proficient: true,
        damage: "3d6",
        saveAbility: "con",
        saveForHalf: true,
        maxUses: 2,
      },
    ],
  },
};

export function getMonster(id: string): MonsterDef {
  const def = MONSTERS[id];
  if (!def) throw new Error(`Unknown monster: ${id}`);
  return def;
}

const LETTERS = "ABCDEFGH";

/** Instantiate a list of monster kind ids into combat-ready monsters. */
export function buildEncounter(kindIds: string[]): Combatant[] {
  const counts: Record<string, number> = {};
  for (const id of kindIds) counts[id] = (counts[id] ?? 0) + 1;

  const seen: Record<string, number> = {};
  return kindIds.map((id) => {
    const def = getMonster(id);
    const index = seen[id] ?? 0;
    seen[id] = index + 1;
    const name = counts[id] > 1 ? `${def.name} ${LETTERS[index]}` : def.name;
    const hp = roll(def.hpDice).total;
    return {
      id: nextId("foe"),
      name,
      side: "enemy",
      isPlayerControlled: false,
      level: 1,
      xp: 0,
      kind: def.name,
      abilities: abilities(def.abilities),
      maxHp: hp,
      hp,
      baseAc: def.ac,
      proficiency: def.proficiency,
      speed: def.speed,
      actions: def.actions.map((a) => ({ ...a })),
      usesLeft: Object.fromEntries(
        def.actions.filter((a) => a.maxUses !== undefined).map((a) => [a.id, a.maxUses as number]),
      ),
      buffs: [],
      traits: [],
      initiative: 0,
      alive: true,
    } satisfies Combatant;
  });
}
