// Headless playthrough check — not part of the app build.
import { Game } from "../src/engine/game";
import { COMPANIONS } from "../src/engine/character";
import { enemiesOf } from "../src/engine/combat";

function playthrough(): string {
  const game = new Game();
  game.beginCharacterCreation();
  game.startCampaign(
    {
      name: "Tester",
      raceId: "human",
      classId: "fighter",
      baseAbilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
    },
    [COMPANIONS[0], COMPANIONS[1], COMPANIONS[2]],
  );

  let guard = 0;
  while (game.state.screen !== "victory" && game.state.screen !== "defeat") {
    if (guard++ > 5000) throw new Error("playthrough did not terminate");

    if (game.state.screen === "combat") {
      const combat = game.state.combat!;
      if (!combat.awaitingInput) throw new Error("combat stuck: not awaiting input");
      const actor = game.combatActor()!;
      const heal = actor.actions.find((a) => a.type === "heal" && a.target === "self");
      if (heal && actor.hp / actor.maxHp < 0.35 && (actor.usesLeft[heal.id] ?? 0) > 0) {
        game.combatAction(heal.id);
      } else {
        const action = actor.actions[0];
        const foes = enemiesOf(combat, actor).sort((a, b) => a.hp - b.hp);
        game.combatAction(action.id, foes[0]?.id);
      }
    } else if (game.state.screen === "explore") {
      const room = game.currentRoom();
      if (room.kind === "rest") game.rest();
      while (
        game.state.campaign.potions > 0 &&
        game.state.party.some((m) => m.alive && m.hp / m.maxHp < 0.55)
      ) {
        game.usePotion();
      }
      if (room.exits.length === 0) throw new Error("dead-end explore room");
      game.chooseExit(room.exits[0].to);
    } else {
      throw new Error(`unexpected screen: ${game.state.screen}`);
    }
  }
  return game.state.screen;
}

let wins = 0;
let losses = 0;
for (let i = 0; i < 300; i++) {
  if (playthrough() === "victory") wins++;
  else losses++;
}
console.log(`300 playthroughs — ${wins} victories, ${losses} defeats (${Math.round((wins / 300) * 100)}% win).`);
