import { effectiveAc } from "../engine/rules";
import type { Combatant } from "../engine/types";

interface Props {
  c: Combatant;
  active?: boolean;
  selectable?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}

export function CombatantCard({ c, active, selectable, onSelect, compact }: Props) {
  const ratio = c.maxHp > 0 ? c.hp / c.maxHp : 0;
  const hpColor = ratio > 0.5 ? "hp-good" : ratio > 0.25 ? "hp-warn" : "hp-bad";

  const classes = [
    "combatant",
    c.side === "party" ? "is-party" : "is-enemy",
    !c.alive ? "is-down" : "",
    active ? "is-active" : "",
    selectable ? "is-selectable" : "",
    compact ? "is-compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      onClick={selectable ? onSelect : undefined}
      role={selectable ? "button" : undefined}
    >
      <div className="combatant-head">
        <span className="combatant-name">{c.name}</span>
        <span className="combatant-ac" title="Armour Class">
          AC {effectiveAc(c)}
        </span>
      </div>
      <div className="combatant-sub">
        {c.side === "party" ? `Level ${c.level} ${c.kind}` : c.kind}
      </div>
      <div className="hpbar">
        <div className={`hpbar-fill ${hpColor}`} style={{ width: `${Math.max(0, ratio) * 100}%` }} />
        <span className="hpbar-text">
          {c.alive ? `${c.hp} / ${c.maxHp} HP` : c.side === "party" ? "Down" : "Slain"}
        </span>
      </div>
      {c.buffs.length > 0 && (
        <div className="buffs">
          {c.buffs.map((b) => (
            <span key={b.id} className="buff-chip" title={b.description}>
              {b.name} ({b.remaining})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
