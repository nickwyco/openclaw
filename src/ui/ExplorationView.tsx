import { useGame } from "../useGame";

export function ExplorationView() {
  const game = useGame();
  const room = game.currentRoom();
  const { campaign, party } = game.state;
  const cleared = campaign.cleared[room.id];
  const anyWounded = party.some((m) => m.alive && m.hp < m.maxHp);

  return (
    <div className="explore">
      <h2 className="section-title">{room.name}</h2>
      <p className="narrative">{room.description}</p>

      {cleared && room.aftermath && <p className="narrative narrative-after">{room.aftermath}</p>}

      <div className="explore-actions">
        {room.kind === "rest" && (
          <button className="btn btn-good" onClick={() => game.rest()}>
            Rest at the shrine (heal the party fully)
          </button>
        )}

        {campaign.potions > 0 && (
          <button className="btn" disabled={!anyWounded} onClick={() => game.usePotion()}>
            Use Healing Potion ({campaign.potions} left)
          </button>
        )}
      </div>

      <div className="exits">
        <h3 className="exits-title">Where to next?</h3>
        {room.exits.map((exit) => (
          <button
            key={exit.to}
            className="btn btn-primary exit-btn"
            onClick={() => game.chooseExit(exit.to)}
          >
            {exit.label}
          </button>
        ))}
        {room.exits.length === 0 && <p className="hint">There is nowhere left to go.</p>}
      </div>
    </div>
  );
}
