// Turn-based combat engine: initiative, attacks, saves, healing, and AI.

import { average, roll, rollD20 } from "./dice";
import { buildEncounter, getMonster } from "./monsters";
import {
  abilityMod,
  buffAttackBonus,
  buffDamageBonus,
  effectiveAc,
} from "./rules";
import type { CombatAction, CombatState, Combatant, LogEntry } from "./types";
import { ABILITY_LABELS } from "./types";

export type Logger = (text: string, tone?: LogEntry["tone"]) => void;

function byId(state: CombatState, id: string): Combatant | undefined {
  return state.combatants.find((c) => c.id === id);
}

export function currentActor(state: CombatState): Combatant | undefined {
  if (state.turnIndex < 0 || state.turnIndex >= state.order.length) return undefined;
  return byId(state, state.order[state.turnIndex]);
}

/** Living combatants on the side opposing `actor`. */
export function enemiesOf(state: CombatState, actor: Combatant): Combatant[] {
  return state.combatants.filter((c) => c.side !== actor.side && c.alive);
}

/** Living combatants on the same side as `actor` (including `actor`). */
export function alliesOf(state: CombatState, actor: Combatant): Combatant[] {
  return state.combatants.filter((c) => c.side === actor.side && c.alive);
}

function canUse(actor: Combatant, action: CombatAction): boolean {
  return action.maxUses === undefined || (actor.usesLeft[action.id] ?? 0) > 0;
}

/** Create a combat encounter from the party and a list of monster kind ids. */
export function startCombat(party: Combatant[], enemyKinds: string[]): CombatState {
  const enemies = buildEncounter(enemyKinds);
  const combatants = [...party, ...enemies];

  for (const c of combatants) {
    c.buffs = [];
    c.alive = c.hp > 0;
    const uses: Record<string, number> = {};
    for (const a of c.actions) {
      if (a.maxUses !== undefined) uses[a.id] = a.maxUses;
    }
    if (c.traits.includes("relentless")) uses["relentless"] = 1;
    c.usesLeft = uses;
    c.initiative = rollD20(abilityMod(c.abilities.dex)).total;
  }

  const order = [...combatants]
    .sort(
      (a, b) =>
        b.initiative - a.initiative ||
        abilityMod(b.abilities.dex) - abilityMod(a.abilities.dex) ||
        Math.random() - 0.5,
    )
    .map((c) => c.id);

  const rewardXp = enemyKinds.reduce((sum, k) => sum + getMonster(k).xp, 0);

  return {
    combatants,
    order,
    turnIndex: -1,
    round: 1,
    rewardXp,
    outcome: "ongoing",
    awaitingInput: false,
  };
}

/** Returns true once a side has been wiped out. */
export function refreshOutcome(state: CombatState): boolean {
  if (state.outcome !== "ongoing") return true;
  const partyAlive = state.combatants.some((c) => c.side === "party" && c.alive);
  const enemyAlive = state.combatants.some((c) => c.side === "enemy" && c.alive);
  if (!enemyAlive) {
    state.outcome = "win";
    state.awaitingInput = false;
    return true;
  }
  if (!partyAlive) {
    state.outcome = "lose";
    state.awaitingInput = false;
    return true;
  }
  return false;
}

function tickBuffs(c: Combatant, log: Logger): void {
  if (c.buffs.length === 0) return;
  const surviving = [];
  for (const b of c.buffs) {
    const remaining = b.remaining - 1;
    if (remaining <= 0) {
      log(`${c.name}'s ${b.name} fades.`, "system");
    } else {
      surviving.push({ ...b, remaining });
    }
  }
  c.buffs = surviving;
}

function rollDamage(notation: string, crit: boolean): number {
  const base = roll(notation).total;
  if (!crit) return base;
  // A critical hit rolls the damage dice twice; the flat bonus is added once.
  const diceOnly = notation.replace(/[+-]\d+$/, "");
  return base + roll(diceOnly).total;
}

function applyDamage(target: Combatant, dmg: number, log: Logger): void {
  target.hp -= dmg;
  if (target.hp > 0) return;
  if (target.traits.includes("relentless") && (target.usesLeft["relentless"] ?? 0) > 0) {
    target.hp = 1;
    target.usesLeft["relentless"] = 0;
    log(`${target.name} refuses to fall — Relentless Endurance keeps them at 1 HP!`, "good");
    return;
  }
  target.hp = 0;
  target.alive = false;
  if (target.side === "enemy") log(`${target.name} is slain!`, "good");
  else log(`${target.name} collapses, gravely wounded!`, "bad");
}

function hasFlankingAlly(state: CombatState, actor: Combatant): boolean {
  return state.combatants.some((c) => c !== actor && c.side === actor.side && c.alive);
}

function resolveTargets(
  state: CombatState,
  actor: Combatant,
  action: CombatAction,
  targetId: string | undefined,
): Combatant[] {
  if (action.target === "self") return [actor];
  if (action.target === "all-enemies") return enemiesOf(state, actor);

  const chosen = targetId ? byId(state, targetId) : undefined;
  if (chosen && chosen.alive) return [chosen];

  if (action.target === "ally") {
    const allies = alliesOf(state, actor);
    return allies.length ? [allies[0]] : [];
  }
  const enemies = enemiesOf(state, actor);
  return enemies.length ? [enemies[0]] : [];
}

function doAttackRoll(
  state: CombatState,
  actor: Combatant,
  action: CombatAction,
  target: Combatant,
  log: Logger,
): void {
  const abilityBonus = abilityMod(actor.abilities[action.ability]);
  const toHit =
    abilityBonus + (action.proficient ? actor.proficiency : 0) + buffAttackBonus(actor);

  let attack = rollD20(toHit);
  if (attack.fumble && actor.traits.includes("lucky")) {
    log(`${actor.name}'s Lucky trait shrugs off a fumbled roll.`, "system");
    attack = rollD20(toHit);
  }

  const ac = effectiveAc(target);
  if (attack.fumble) {
    log(`${actor.name}'s ${action.name} goes wide — a natural 1. Miss!`, "miss");
    return;
  }
  if (!attack.crit && attack.total < ac) {
    log(
      `${actor.name}'s ${action.name} misses ${target.name} (rolled ${attack.total} vs AC ${ac}).`,
      "miss",
    );
    return;
  }

  let dmg = rollDamage(action.damage ?? "1d4", attack.crit);
  if (action.addAbilityToDamage) dmg += abilityBonus;
  dmg += buffDamageBonus(actor);

  let sneakNote = "";
  if (action.sneakDamage && hasFlankingAlly(state, actor)) {
    const sneak = rollDamage(action.sneakDamage, attack.crit);
    dmg += sneak;
    sneakNote = ` Sneak Attack adds ${sneak}!`;
  }

  dmg = Math.max(1, dmg);
  const critNote = attack.crit ? " CRITICAL HIT!" : "";
  log(
    `${actor.name}'s ${action.name} hits ${target.name} for ${dmg} damage.${critNote}${sneakNote}`,
    attack.crit ? "good" : "hit",
  );
  applyDamage(target, dmg, log);
}

function doAutoHit(actor: Combatant, action: CombatAction, target: Combatant, log: Logger): void {
  let dmg = roll(action.damage ?? "1d4").total;
  if (action.addAbilityToDamage) dmg += abilityMod(actor.abilities[action.ability]);
  dmg = Math.max(1, dmg);
  log(`${actor.name}'s ${action.name} strikes ${target.name} unerringly for ${dmg} damage.`, "hit");
  applyDamage(target, dmg, log);
}

function doSaveAction(
  actor: Combatant,
  action: CombatAction,
  targets: Combatant[],
  log: Logger,
): void {
  if (targets.length === 0) return;
  const dc = 8 + actor.proficiency + abilityMod(actor.abilities[action.ability]);
  const saveName = ABILITY_LABELS[action.saveAbility ?? "dex"];
  const dmg = roll(action.damage ?? "1d6").total;
  log(`${actor.name} unleashes ${action.name}! (DC ${dc} ${saveName} save)`, "system");

  for (const t of targets) {
    const save = rollD20(abilityMod(t.abilities[action.saveAbility ?? "dex"]));
    const saved = save.total >= dc;
    let applied = dmg;
    if (saved) applied = action.saveForHalf ? Math.floor(dmg / 2) : 0;

    if (saved && applied === 0) {
      log(`${t.name} dives clear (save ${save.total}) and is unharmed.`, "miss");
      continue;
    }
    log(
      `${t.name} ${saved ? "partly resists" : "is caught"} (save ${save.total}) — ${applied} damage.`,
      "hit",
    );
    applyDamage(t, applied, log);
  }
}

function doHeal(actor: Combatant, action: CombatAction, target: Combatant, log: Logger): void {
  let amount = roll(action.heal ?? "1d4").total;
  if (action.addAbilityToDamage) amount += abilityMod(actor.abilities[action.ability]);
  amount = Math.max(1, amount);
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  log(`${actor.name}'s ${action.name} restores ${target.hp - before} HP to ${target.name}.`, "good");
}

function doBuff(actor: Combatant, action: CombatAction, targets: Combatant[], log: Logger): void {
  if (!action.buff) return;
  for (const t of targets) {
    t.buffs = t.buffs.filter((b) => b.id !== action.buff!.id);
    t.buffs.push({ ...action.buff, remaining: action.buff.duration });
    log(`${actor.name} uses ${action.name} — ${t.name} gains ${action.buff.name}.`, "good");
  }
}

function performAction(
  state: CombatState,
  actor: Combatant,
  action: CombatAction,
  targetId: string | undefined,
  log: Logger,
): void {
  if (action.maxUses !== undefined) {
    actor.usesLeft[action.id] = Math.max(0, (actor.usesLeft[action.id] ?? 0) - 1);
  }
  const targets = resolveTargets(state, actor, action, targetId);
  if (action.flavor && targets[0]) {
    log(`${actor.name} — ${action.flavor}.`, "narrate");
  }

  switch (action.type) {
    case "weapon":
    case "spellAttack":
      if (targets[0]) doAttackRoll(state, actor, action, targets[0], log);
      break;
    case "autoHit":
      if (targets[0]) doAutoHit(actor, action, targets[0], log);
      break;
    case "save":
      doSaveAction(actor, action, targets, log);
      break;
    case "heal":
      if (targets[0]) doHeal(actor, action, targets[0], log);
      break;
    case "buff":
      doBuff(actor, action, targets, log);
      break;
  }
}

function actionScore(action: CombatAction): number {
  let score = action.damage ? average(action.damage) : 0;
  if (action.sneakDamage) score += average(action.sneakDamage);
  return score;
}

/** Decide and perform a turn for an AI-controlled combatant. */
function runAiTurn(state: CombatState, actor: Combatant, log: Logger): void {
  const enemies = enemiesOf(state, actor);
  const allies = alliesOf(state, actor);
  if (enemies.length === 0) return;

  // 1. Heal a badly wounded ally.
  const healAction = actor.actions.find((a) => a.type === "heal" && canUse(actor, a));
  if (healAction) {
    const pool = healAction.target === "self" ? [actor] : allies;
    const wounded = pool
      .filter((t) => t.hp < t.maxHp && t.hp / t.maxHp <= 0.5)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    if (wounded.length > 0) {
      performAction(state, actor, healAction, wounded[0].id, log);
      return;
    }
  }

  // 2. Apply a buff to an ally who lacks it.
  const buffAction = actor.actions.find((a) => a.type === "buff" && a.buff && canUse(actor, a));
  if (buffAction && buffAction.buff && Math.random() < 0.6) {
    const pool = buffAction.target === "self" ? [actor] : allies;
    const target = pool.find((t) => !t.buffs.some((b) => b.id === buffAction.buff!.id));
    if (target) {
      performAction(state, actor, buffAction, target.id, log);
      return;
    }
  }

  // 3. Attack — favour area effects when several foes are clustered.
  let attack: CombatAction | undefined;
  if (enemies.length >= 2) {
    attack = actor.actions.find((a) => a.target === "all-enemies" && canUse(actor, a));
  }
  if (!attack) {
    const damaging = actor.actions
      .filter(
        (a) =>
          a.damage &&
          a.target !== "all-enemies" &&
          a.type !== "heal" &&
          a.type !== "buff" &&
          canUse(actor, a),
      )
      .sort((a, b) => actionScore(b) - actionScore(a));
    attack = damaging[0];
  }
  if (!attack) attack = actor.actions.find((a) => a.damage);
  if (!attack) return;

  const focus = [...enemies].sort((a, b) => a.hp - b.hp)[0];
  performAction(state, actor, attack, focus.id, log);
}

/**
 * Advance the turn pointer, auto-resolving AI turns, until it is a living
 * player-controlled combatant's turn or the combat ends.
 */
export function advanceToNextActor(state: CombatState, log: Logger): void {
  if (refreshOutcome(state)) return;

  for (let guard = 0; guard < 1000; guard++) {
    state.turnIndex += 1;
    if (state.turnIndex >= state.order.length) {
      state.turnIndex = 0;
      state.round += 1;
      log(`— Round ${state.round} —`, "system");
    }

    const actor = byId(state, state.order[state.turnIndex]);
    if (!actor || !actor.alive) continue;

    tickBuffs(actor, log);

    if (actor.isPlayerControlled) {
      state.awaitingInput = true;
      return;
    }

    runAiTurn(state, actor, log);
    if (refreshOutcome(state)) return;
  }
}

/** Resolve the action chosen by the player for the current combatant. */
export function playerAct(
  state: CombatState,
  actionId: string,
  targetId: string | undefined,
  log: Logger,
): void {
  if (!state.awaitingInput) return;
  const actor = currentActor(state);
  if (!actor || !actor.alive || !actor.isPlayerControlled) return;
  const action = actor.actions.find((a) => a.id === actionId);
  if (!action || !canUse(actor, action)) return;

  state.awaitingInput = false;
  performAction(state, actor, action, targetId, log);
  if (refreshOutcome(state)) return;
  advanceToNextActor(state, log);
}
