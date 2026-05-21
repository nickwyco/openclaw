// Playable classes. Each defines hit dice, armour, and a level-scaled action list.

import type { AbilityName, CombatAction } from "./types";

export interface ClassDef {
  id: string;
  name: string;
  description: string;
  /** Hit die size — drives hit points per level. */
  hitDie: number;
  /** Ability that governs the class's attacks and abilities. */
  primaryAbility: AbilityName;
  /** Order in which auto-assigned ability scores are placed (best first). */
  priority: AbilityName[];
  /** Armour class given a Dexterity modifier. */
  ac: (dexMod: number) => number;
  acText: string;
  /** Actions available at the given character level. */
  actions: (level: number) => CombatAction[];
}

const sneakDice = (level: number) => `${Math.ceil(level / 2)}d6`;

export const CLASSES: ClassDef[] = [
  {
    id: "fighter",
    name: "Fighter",
    description: "A master of weapons and armour who stands at the front and refuses to break.",
    hitDie: 10,
    primaryAbility: "str",
    priority: ["str", "con", "dex", "wis", "cha", "int"],
    ac: () => 18,
    acText: "Chain mail & shield (AC 18)",
    actions: (level) => {
      const list: CombatAction[] = [
        {
          id: "longsword",
          name: "Longsword",
          description: "A reliable swing of well-forged steel.",
          type: "weapon",
          target: "enemy",
          ability: "str",
          proficient: true,
          damage: "1d8",
          addAbilityToDamage: true,
          flavor: "steel bites deep",
        },
        {
          id: "second-wind",
          name: "Second Wind",
          description: "Draw on your stamina to bind your wounds mid-fight.",
          type: "heal",
          target: "self",
          ability: "con",
          proficient: false,
          heal: "1d10",
          addAbilityToDamage: true,
          maxUses: 1,
        },
      ];
      if (level >= 3) {
        list.push({
          id: "heavy-strike",
          name: "Heavy Strike",
          description: "A committed, crushing blow that few foes shrug off.",
          type: "weapon",
          target: "enemy",
          ability: "str",
          proficient: true,
          damage: "2d6",
          addAbilityToDamage: true,
          maxUses: 2,
          flavor: "a bone-shattering blow",
        });
      }
      return list;
    },
  },
  {
    id: "wizard",
    name: "Wizard",
    description: "A scholar of the arcane who unravels foes with fire and force.",
    hitDie: 6,
    primaryAbility: "int",
    priority: ["int", "dex", "con", "wis", "cha", "str"],
    ac: (dexMod) => 13 + dexMod,
    acText: "Mage armour (AC 13 + Dex)",
    actions: (level) => {
      const list: CombatAction[] = [
        {
          id: "fire-bolt",
          name: "Fire Bolt",
          description: "A mote of fire hurled at a single foe.",
          type: "spellAttack",
          target: "enemy",
          ability: "int",
          proficient: true,
          damage: level >= 5 ? "2d10" : "1d10",
          flavor: "fire scorches the target",
        },
        {
          id: "magic-missile",
          name: "Magic Missile",
          description: "Three darts of force that strike unerringly — they never miss.",
          type: "autoHit",
          target: "enemy",
          ability: "int",
          proficient: false,
          damage: "3d4+3",
          maxUses: 3,
          flavor: "darts of force slam home",
        },
        {
          id: "burning-hands",
          name: "Burning Hands",
          description: "A sheet of flame that sears every enemy. Dexterity save for half.",
          type: "save",
          target: "all-enemies",
          ability: "int",
          proficient: true,
          damage: "3d6",
          saveAbility: "dex",
          saveForHalf: true,
          maxUses: 2,
        },
      ];
      if (level >= 3) {
        list.push({
          id: "shatter",
          name: "Shatter",
          description: "A ringing burst of sound that batters all foes. Constitution save for half.",
          type: "save",
          target: "all-enemies",
          ability: "int",
          proficient: true,
          damage: "3d8",
          saveAbility: "con",
          saveForHalf: true,
          maxUses: 1,
        });
      }
      return list;
    },
  },
  {
    id: "cleric",
    name: "Cleric",
    description: "A holy warrior who mends allies and smites the wicked with divine power.",
    hitDie: 8,
    primaryAbility: "wis",
    priority: ["wis", "con", "str", "dex", "cha", "int"],
    ac: () => 16,
    acText: "Scale mail & shield (AC 16)",
    actions: (level) => {
      const list: CombatAction[] = [
        {
          id: "mace",
          name: "Mace",
          description: "A solid strike with a blessed weapon.",
          type: "weapon",
          target: "enemy",
          ability: "str",
          proficient: true,
          damage: "1d6",
          addAbilityToDamage: true,
        },
        {
          id: "sacred-flame",
          name: "Sacred Flame",
          description: "Radiant fire descends on a foe. Dexterity save negates.",
          type: "save",
          target: "enemy",
          ability: "wis",
          proficient: true,
          damage: level >= 5 ? "2d8" : "1d8",
          saveAbility: "dex",
          saveForHalf: false,
          flavor: "radiance pours down",
        },
        {
          id: "cure-wounds",
          name: "Cure Wounds",
          description: "Channel divine power to heal a wounded ally.",
          type: "heal",
          target: "ally",
          ability: "wis",
          proficient: false,
          heal: "1d8",
          addAbilityToDamage: true,
          maxUses: 3,
        },
        {
          id: "bless",
          name: "Bless",
          description: "Bless an ally, sharpening their attacks for several rounds.",
          type: "buff",
          target: "ally",
          ability: "wis",
          proficient: false,
          maxUses: 2,
          buff: {
            id: "bless",
            name: "Blessed",
            description: "+2 to attack rolls.",
            duration: 3,
            attackBonus: 2,
          },
        },
      ];
      if (level >= 3) {
        list.push({
          id: "guiding-bolt",
          name: "Guiding Bolt",
          description: "A lance of light that blasts a single foe.",
          type: "spellAttack",
          target: "enemy",
          ability: "wis",
          proficient: true,
          damage: "4d6",
          maxUses: 2,
          flavor: "a searing lance of light",
        });
      }
      return list;
    },
  },
  {
    id: "rogue",
    name: "Rogue",
    description: "A nimble skirmisher who exploits any opening for a deadly strike.",
    hitDie: 8,
    primaryAbility: "dex",
    priority: ["dex", "con", "wis", "int", "cha", "str"],
    ac: (dexMod) => 12 + dexMod,
    acText: "Leather armour (AC 12 + Dex)",
    actions: (level) => {
      const list: CombatAction[] = [
        {
          id: "shortsword",
          name: "Shortsword",
          description: "A quick thrust — deadlier when an ally distracts the target.",
          type: "weapon",
          target: "enemy",
          ability: "dex",
          proficient: true,
          damage: "1d6",
          addAbilityToDamage: true,
          sneakDamage: sneakDice(level),
          flavor: "a precise, vicious strike",
        },
        {
          id: "cunning-dodge",
          name: "Cunning Action: Dodge",
          description: "Tumble and weave, making yourself far harder to hit.",
          type: "buff",
          target: "self",
          ability: "dex",
          proficient: false,
          maxUses: 3,
          buff: {
            id: "dodge",
            name: "Dodging",
            description: "+4 AC.",
            duration: 1,
            acBonus: 4,
          },
        },
      ];
      if (level >= 3) {
        list.push({
          id: "assassinate",
          name: "Assassinate",
          description: "A perfectly placed strike aimed at a vital point.",
          type: "weapon",
          target: "enemy",
          ability: "dex",
          proficient: true,
          damage: "1d6",
          addAbilityToDamage: true,
          sneakDamage: `${Math.ceil(level / 2) + 2}d6`,
          maxUses: 1,
          flavor: "a strike straight to the heart",
        });
      }
      return list;
    },
  },
];

export function getClass(id: string): ClassDef {
  const cls = CLASSES.find((c) => c.id === id);
  if (!cls) throw new Error(`Unknown class: ${id}`);
  return cls;
}
