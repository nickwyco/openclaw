import { xpForNextLevel } from "../engine/rules";
import { useGame } from "../useGame";
import { CombatantCard } from "./CombatantCard";

export function PartyPanel() {
  const game = useGame();
  const { party, combat } = game.state;
  const activeId = combat ? game.combatActor()?.id : undefined;

  return (
    <section className="panel party-panel">
      <h2 className="panel-title">Your Party</h2>
      <div className="party-list">
        {party.map((member) => {
          const next = xpForNextLevel(member.level);
          return (
            <div key={member.id} className="party-member">
              <CombatantCard c={member} active={member.id === activeId} compact />
              <div className="xp-line">
                XP {member.xp}
                {next !== null ? ` / ${next}` : " (max)"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
