import { useState } from "react";
import type { CombatAction } from "../engine/types";
import { useGame } from "../useGame";
import { CombatantCard } from "./CombatantCard";

export function CombatView() {
  const game = useGame();
  const combat = game.state.combat;
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (!combat) return null;

  const actor = game.combatActor();
  const enemies = combat.combatants.filter((c) => c.side === "enemy");
  const heroTurn = combat.awaitingInput && actor?.isPlayerControlled;

  const pendingAction =
    pendingId && actor ? actor.actions.find((a) => a.id === pendingId) ?? null : null;
  const targets = pendingAction ? game.targetsFor(pendingAction) : [];

  function chooseAction(action: CombatAction) {
    if (action.target === "self" || action.target === "all-enemies") {
      game.combatAction(action.id);
      setPendingId(null);
    } else {
      setPendingId(action.id);
    }
  }

  function chooseTarget(targetId: string) {
    if (!pendingId) return;
    game.combatAction(pendingId, targetId);
    setPendingId(null);
  }

  return (
    <div className="combat">
      <div className="combat-header">
        <h2 className="section-title">Battle — Round {combat.round}</h2>
        <span className="turn-indicator">
          {actor ? `${actor.name}'s turn` : "Resolving…"}
        </span>
      </div>

      <h3 className="group-title">Enemies</h3>
      <div className="combatant-grid">
        {enemies.map((e) => {
          const selectable = !!pendingAction && targets.some((t) => t.id === e.id);
          return (
            <CombatantCard
              key={e.id}
              c={e}
              active={e.id === actor?.id}
              selectable={selectable}
              onSelect={selectable ? () => chooseTarget(e.id) : undefined}
            />
          );
        })}
      </div>

      <div className="action-bar">
        {!heroTurn && <p className="hint">The battle unfolds — your companions and foes act…</p>}

        {heroTurn && actor && !pendingAction && (
          <>
            <h3 className="group-title">{actor.name} — choose an action</h3>
            <div className="action-list">
              {actor.actions.map((action) => {
                const used = action.maxUses !== undefined;
                const left = actor.usesLeft[action.id] ?? 0;
                const disabled = used && left <= 0;
                return (
                  <button
                    key={action.id}
                    className="action-card"
                    disabled={disabled}
                    onClick={() => chooseAction(action)}
                  >
                    <span className="action-name">
                      {action.name}
                      {used && <span className="action-uses">{left} use{left === 1 ? "" : "s"} left</span>}
                    </span>
                    <span className="action-desc">{action.description}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {heroTurn && pendingAction && (
          <>
            <h3 className="group-title">
              {pendingAction.name} — choose a {pendingAction.target === "ally" ? "ally" : "target"}
            </h3>
            <div className="combatant-grid">
              {targets.map((t) => (
                <CombatantCard key={t.id} c={t} selectable onSelect={() => chooseTarget(t.id)} />
              ))}
            </div>
            {targets.length === 0 && <p className="hint">No valid targets.</p>}
            <button className="btn" onClick={() => setPendingId(null)}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
