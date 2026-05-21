import { useGame } from "./useGame";
import { CharacterCreation } from "./ui/CharacterCreation";
import { CombatView } from "./ui/CombatView";
import { EndScreen } from "./ui/EndScreen";
import { ExplorationView } from "./ui/ExplorationView";
import { GameLog } from "./ui/GameLog";
import { PartyPanel } from "./ui/PartyPanel";
import { TitleScreen } from "./ui/TitleScreen";
import { CAMPAIGN_TITLE } from "./engine/campaign";

export function App() {
  const game = useGame();
  const { screen, campaign } = game.state;

  if (screen === "title") return <TitleScreen />;
  if (screen === "create") return <CharacterCreation />;
  if (screen === "victory" || screen === "defeat") return <EndScreen />;

  const room = game.currentRoom();

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-title">
          <h1>{CAMPAIGN_TITLE}</h1>
          <span className="topbar-room">{room.name}</span>
        </div>
        <div className="topbar-stats">
          <span className="coin">{campaign.gold} gold</span>
          <span className="potion">{campaign.potions} potion{campaign.potions === 1 ? "" : "s"}</span>
        </div>
      </header>

      <div className="layout">
        <main className="main">
          {screen === "combat" ? <CombatView /> : <ExplorationView />}
        </main>
        <aside className="side">
          <PartyPanel />
          <GameLog />
        </aside>
      </div>
    </div>
  );
}
