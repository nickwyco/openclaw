// Renders every screen of the React tree to HTML to confirm components mount
// without throwing. Not part of the app build.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { App } from "../src/App";
import { game } from "../src/engine/game";
import { COMPANIONS } from "../src/engine/character";
import { enemiesOf } from "../src/engine/combat";

function render(label: string, expect: string): void {
  const html = renderToString(createElement(App));
  if (!html.includes(expect)) {
    throw new Error(`${label}: expected to find ${JSON.stringify(expect)} in output`);
  }
  console.log(`  ok  ${label} (${html.length} bytes, screen=${game.state.screen})`);
}

render("title screen", "Begin Your Adventure");

game.beginCharacterCreation();
render("character creation", "Create Your Hero");

game.startCampaign(
  {
    name: "Aldric",
    raceId: "human",
    classId: "fighter",
    baseAbilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
  },
  [COMPANIONS[0], COMPANIONS[1], COMPANIONS[2]],
);
render("exploration screen", "The Tomb Entrance");

game.chooseExit("guardroom");

let guard = 0;
let combatRendered = false;
while (game.state.screen !== "victory" && game.state.screen !== "defeat") {
  if (guard++ > 5000) throw new Error("did not terminate");
  if (game.state.screen === "combat") {
    const combat = game.state.combat!;
    const actor = game.combatActor()!;
    if (!combatRendered && combat.awaitingInput) {
      render("combat screen", "choose an action");
      combatRendered = true;
    }
    const foes = enemiesOf(combat, actor).sort((a, b) => a.hp - b.hp);
    game.combatAction(actor.actions[0].id, foes[0]?.id);
  } else {
    const room = game.currentRoom();
    if (room.kind === "rest") game.rest();
    game.chooseExit(room.exits[0].to);
  }
}
render("end screen", game.state.screen === "victory" ? "Victory" : "Defeat");

console.log("All screens rendered successfully.");
