// Shared types for the simulator.

export type AbilityName = "str" | "dex" | "con" | "int" | "wis" | "cha";

export const ABILITY_ORDER: AbilityName[] = ["str", "dex", "con", "int", "wis", "cha"];

export const ABILITY_LABELS: Record<AbilityName, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export type Abilities = Record<AbilityName, number>;

export type TargetMode = "enemy" | "ally" | "self" | "all-enemies";

export type ActionType =
  | "weapon" // attack roll vs AC, ability mod added to hit & damage
  | "spellAttack" // attack roll vs AC, uses a spellcasting ability
  | "autoHit" // always hits (e.g. Magic Missile)
  | "save" // target rolls a saving throw vs a DC
  | "heal"
  | "buff";

/** A declarative description of something a combatant can do on its turn. */
export interface CombatAction {
  id: string;
  name: string;
  description: string;
  type: ActionType;
  target: TargetMode;
  /** Ability that governs the attack roll / save DC / spell. */
  ability: AbilityName;
  /** Whether proficiency bonus is added to the attack roll or save DC. */
  proficient: boolean;
  /** Damage dice, e.g. "1d8". Ability modifier is added on top for weapons. */
  damage?: string;
  /** Whether to add the governing ability modifier to damage. */
  addAbilityToDamage?: boolean;
  /** Healing dice, e.g. "1d8". Ability modifier is added on top. */
  heal?: string;
  /** For "save" actions: which ability the target rolls. */
  saveAbility?: AbilityName;
  /** On a successful save the target takes half damage instead of none. */
  saveForHalf?: boolean;
  /** A status effect applied by "buff" actions. */
  buff?: Buff;
  /** Uses per encounter. Undefined means unlimited. */
  maxUses?: number;
  /** Bonus damage applied only when an ally is adjacent (Sneak Attack flavour). */
  sneakDamage?: string;
  /** Flavour text shown when the action lands. */
  flavor?: string;
}

export interface Buff {
  id: string;
  name: string;
  description: string;
  /** Rounds the buff lasts. */
  duration: number;
  acBonus?: number;
  attackBonus?: number;
  damageBonus?: number;
}

export interface ActiveBuff extends Buff {
  remaining: number;
}

export type Side = "party" | "enemy";

export interface Combatant {
  id: string;
  name: string;
  side: Side;
  isPlayerControlled: boolean;

  level: number;
  xp: number;
  raceId?: string;
  raceName?: string;
  classId?: string;
  className?: string;
  /** Short descriptive role, e.g. "Goblin", "Hobgoblin Captain". */
  kind: string;

  abilities: Abilities;
  maxHp: number;
  hp: number;
  baseAc: number;
  proficiency: number;
  speed: number;

  actions: CombatAction[];
  usesLeft: Record<string, number>;
  buffs: ActiveBuff[];
  /** Passive racial trait ids, e.g. "lucky", "relentless". */
  traits: string[];

  initiative: number;
  alive: boolean;
}

export interface LogEntry {
  id: number;
  text: string;
  tone: "normal" | "good" | "bad" | "hit" | "miss" | "system" | "narrate";
}

export type Screen = "title" | "create" | "explore" | "combat" | "victory" | "defeat";

export interface RoomExit {
  label: string;
  to: string;
}

export type RoomKind = "story" | "fight" | "treasure" | "rest" | "boss";

export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
  description: string;
  /** Monster kind ids for a fight/boss room. */
  encounter?: string[];
  /** Narrative shown after clearing the room. */
  aftermath?: string;
  exits: RoomExit[];
  /** Gold awarded the first time the room is entered/cleared. */
  gold?: number;
}

export interface CampaignState {
  roomId: string;
  visited: Record<string, boolean>;
  cleared: Record<string, boolean>;
  gold: number;
  potions: number;
}

export interface CombatState {
  combatants: Combatant[];
  /** Combatant ids in initiative order. */
  order: string[];
  turnIndex: number;
  round: number;
  rewardXp: number;
  outcome: "ongoing" | "win" | "lose";
  /** True while it is a player-controlled, living combatant's turn. */
  awaitingInput: boolean;
}

export interface GameState {
  screen: Screen;
  party: Combatant[];
  log: LogEntry[];
  campaign: CampaignState;
  combat: CombatState | null;
}
