import { useGame } from "../useGame";

export function EndScreen() {
  const game = useGame();
  const won = game.state.screen === "victory";
  const { party, campaign } = game.state;

  return (
    <div className="screen-center">
      <div className={`title-card end-card ${won ? "end-win" : "end-lose"}`}>
        <p className="eyebrow">{won ? "Victory" : "Defeat"}</p>
        <h1 className="title-main">{won ? "The Tomb Falls Silent" : "The Tomb Claims You"}</h1>
        <p className="title-blurb">
          {won
            ? "Malgrith the Bone Tyrant is destroyed and his undead legions crumble to dust. " +
              "Your party climbs back into the daylight as heroes, pockets heavy with gold."
            : "Your party has fallen in the dark, and the Bone Tyrant adds your bones to his " +
              "throne. The tomb keeps its secrets — and its dead."}
        </p>

        <div className="end-summary">
          <h3>Final Party</h3>
          {party.map((m) => (
            <div key={m.id} className="end-row">
              <span>
                {m.name} — Level {m.level} {m.kind}
              </span>
              <span>{m.alive ? `${m.hp}/${m.maxHp} HP` : "Fallen"}</span>
            </div>
          ))}
          <div className="end-row end-gold">
            <span>Gold recovered</span>
            <span>{campaign.gold}</span>
          </div>
        </div>

        <button className="btn btn-primary btn-large" onClick={() => game.restartCampaign()}>
          Play Again
        </button>
      </div>
    </div>
  );
}
