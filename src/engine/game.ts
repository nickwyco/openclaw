// Central game controller: owns all state and drives the campaign flow.

import { CAMPAIGN_TITLE, START_ROOM, getRoom } from "./campaign";
import {
  buildCompanion,
  buildHero,
  levelUp,
  type CompanionTemplate,
  type HeroChoice,
} from "./character";
import {
  advanceToNextActor,
  alliesOf,
  currentActor,
  enemiesOf,
  playerAct,
  startCombat,
} from "./combat";
import { roll } from "./dice";
import { levelForXp } from "./rules";
import type { CombatAction, Combatant, GameState, LogEntry, Room } from "./types";

const MAX_LOG = 250;

function initialState(): GameState {
  return {
    screen: "title",
    party: [],
    log: [],
    campaign: { roomId: START_ROOM, visited: {}, cleared: {}, gold: 0, potions: 0 },
    combat: null,
  };
}

export class Game {
  state: GameState = initialState();
  private version = 0;
  private listeners = new Set<() => void>();
  private logId = 0;

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getSnapshot = (): number => this.version;

  private commit(): void {
    this.version += 1;
    for (const cb of this.listeners) cb();
  }

  private log = (text: string, tone: LogEntry["tone"] = "normal"): void => {
    this.state.log.push({ id: this.logId++, text, tone });
    if (this.state.log.length > MAX_LOG) {
      this.state.log.splice(0, this.state.log.length - MAX_LOG);
    }
  };

  // --- Title / setup -------------------------------------------------------

  beginCharacterCreation(): void {
    this.state = initialState();
    this.state.screen = "create";
    this.commit();
  }

  /** Build the party from the player's hero choice and recruited companions. */
  startCampaign(hero: HeroChoice, companions: CompanionTemplate[]): void {
    const heroChar = buildHero(hero);
    const allies = companions.map((c) => buildCompanion(c));
    this.state.party = [heroChar, ...allies];
    this.state.campaign = {
      roomId: START_ROOM,
      visited: {},
      cleared: {},
      gold: 0,
      potions: 1,
    };
    this.log(`A new party gathers to brave ${CAMPAIGN_TITLE}.`, "narrate");
    this.enterRoom(START_ROOM);
    this.commit();
  }

  restartCampaign(): void {
    this.beginCharacterCreation();
  }

  // --- Exploration ---------------------------------------------------------

  private enterRoom(id: string): void {
    const room = getRoom(id);
    this.state.campaign.roomId = id;
    const firstVisit = !this.state.campaign.visited[id];
    this.state.campaign.visited[id] = true;

    if (firstVisit) {
      this.log(`— ${room.name} —`, "system");
      this.log(room.description, "narrate");
    }

    const needsFight =
      (room.kind === "fight" || room.kind === "boss") && !this.state.campaign.cleared[id];

    if (needsFight && room.encounter) {
      this.startRoomCombat(room);
      return;
    }

    if (room.kind === "treasure" && firstVisit) {
      if (room.gold) {
        this.state.campaign.gold += room.gold;
        this.log(`You gather ${room.gold} gold from the hoard.`, "good");
      }
      this.state.campaign.potions += 2;
      this.log("You stock two healing potions from the rack. (+2 potions)", "good");
    }

    this.state.screen = "explore";
  }

  chooseExit(to: string): void {
    this.enterRoom(to);
    this.commit();
  }

  rest(): void {
    const room = this.currentRoom();
    if (room.kind !== "rest") return;
    for (const member of this.state.party) {
      member.hp = member.maxHp;
      member.alive = true;
      member.buffs = [];
    }
    this.log("The party rests at the shrine. Everyone is restored to full health.", "good");
    this.commit();
  }

  usePotion(): void {
    if (this.state.campaign.potions <= 0) return;
    if (this.state.combat) return; // potions are used between battles
    const wounded = this.state.party
      .filter((m) => m.alive && m.hp < m.maxHp)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!wounded) {
      this.log("No one is wounded — the potion stays in the pack.", "system");
      this.commit();
      return;
    }
    const healed = roll("2d4+2").total;
    const before = wounded.hp;
    wounded.hp = Math.min(wounded.maxHp, wounded.hp + healed);
    this.state.campaign.potions -= 1;
    this.log(
      `${wounded.name} drinks a healing potion and recovers ${wounded.hp - before} HP.`,
      "good",
    );
    this.commit();
  }

  // --- Combat --------------------------------------------------------------

  private startRoomCombat(room: Room): void {
    this.log(`Battle begins in ${room.name}!`, "system");
    this.log("— Round 1 —", "system");
    const combat = startCombat(this.state.party, room.encounter ?? []);
    this.state.combat = combat;
    this.state.screen = "combat";
    advanceToNextActor(combat, this.log);
    if (combat.outcome !== "ongoing") this.resolveCombat();
  }

  /** Perform the action the player picked for the current combatant. */
  combatAction(actionId: string, targetId?: string): void {
    const combat = this.state.combat;
    if (!combat) return;
    playerAct(combat, actionId, targetId, this.log);
    if (combat.outcome !== "ongoing") {
      this.resolveCombat();
    }
    this.commit();
  }

  private resolveCombat(): void {
    const combat = this.state.combat;
    if (!combat) return;
    const room = this.currentRoom();

    if (combat.outcome === "lose") {
      this.log("The party has fallen. The tomb claims you all.", "bad");
      this.state.screen = "defeat";
      this.state.combat = null;
      return;
    }

    // Victory.
    this.state.campaign.cleared[room.id] = true;
    if (room.gold) {
      this.state.campaign.gold += room.gold;
      this.log(`The party recovers ${room.gold} gold.`, "good");
    }

    for (const member of this.state.party) {
      member.xp += combat.rewardXp;
      member.buffs = [];
    }
    this.log(`Each hero earns ${combat.rewardXp} XP.`, "good");
    this.applyLevelUps();

    // Stabilise any heroes who were downed during the fight.
    for (const member of this.state.party) {
      if (!member.alive) {
        member.alive = true;
        member.hp = 1;
        this.log(`${member.name} is stabilised, clinging to life at 1 HP.`, "normal");
      }
    }

    if (room.aftermath) this.log(room.aftermath, "narrate");
    this.state.combat = null;

    if (room.kind === "boss") {
      this.state.screen = "victory";
    } else {
      this.state.screen = "explore";
    }
  }

  private applyLevelUps(): void {
    for (const member of this.state.party) {
      const target = levelForXp(member.xp);
      while (member.level < target) {
        levelUp(member, member.level + 1);
        this.log(
          `${member.name} reaches level ${member.level}! (HP ${member.hp}/${member.maxHp})`,
          "good",
        );
      }
    }
  }

  // --- Queries used by the UI ---------------------------------------------

  currentRoom(): Room {
    return getRoom(this.state.campaign.roomId);
  }

  combatActor(): Combatant | undefined {
    return this.state.combat ? currentActor(this.state.combat) : undefined;
  }

  /** Combatants the player may target with the given action. */
  targetsFor(action: CombatAction): Combatant[] {
    const combat = this.state.combat;
    const actor = this.combatActor();
    if (!combat || !actor) return [];
    if (action.target === "self" || action.target === "all-enemies") return [];
    if (action.target === "ally") return alliesOf(combat, actor);
    return enemiesOf(combat, actor);
  }
}

export const game = new Game();
