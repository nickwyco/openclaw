import { useMemo, useState } from "react";
import { CLASSES, getClass } from "../engine/classes";
import {
  COMPANIONS,
  STANDARD_ARRAY,
  assignByPriority,
  rollAbilityScores,
} from "../engine/character";
import { RACES, getRace } from "../engine/races";
import { abilityMod, signed } from "../engine/rules";
import { ABILITY_LABELS, ABILITY_ORDER } from "../engine/types";
import { useGame } from "../useGame";

type Method = "array" | "roll";

export function CharacterCreation() {
  const game = useGame();
  const [name, setName] = useState("");
  const [raceId, setRaceId] = useState(RACES[0].id);
  const [classId, setClassId] = useState(CLASSES[0].id);
  const [method, setMethod] = useState<Method>("array");
  const [rolled, setRolled] = useState<number[]>(() => rollAbilityScores());
  const [companions, setCompanions] = useState<string[]>([]);

  const cls = getClass(classId);
  const race = getRace(raceId);
  const pool = method === "array" ? STANDARD_ARRAY : rolled;

  const baseAbilities = useMemo(
    () => assignByPriority(pool, cls.priority),
    [pool, cls.priority],
  );

  const finalAbilities = useMemo(() => {
    const result = { ...baseAbilities };
    for (const ability of ABILITY_ORDER) {
      result[ability] += race.bonuses[ability] ?? 0;
    }
    return result;
  }, [baseAbilities, race]);

  function toggleCompanion(cName: string) {
    setCompanions((prev) => {
      if (prev.includes(cName)) return prev.filter((n) => n !== cName);
      if (prev.length >= 3) return prev;
      return [...prev, cName];
    });
  }

  const canStart = name.trim().length > 0 && companions.length === 3;

  function start() {
    if (!canStart) return;
    const templates = COMPANIONS.filter((c) => companions.includes(c.name));
    game.startCampaign({ name, raceId, classId, baseAbilities }, templates);
  }

  return (
    <div className="screen-scroll">
      <div className="create">
        <h1 className="section-title">Create Your Hero</h1>

        <section className="create-block">
          <h2>Name</h2>
          <input
            className="text-input"
            placeholder="Enter your hero's name"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
          />
        </section>

        <section className="create-block">
          <h2>Ancestry</h2>
          <div className="option-grid">
            {RACES.map((r) => (
              <button
                key={r.id}
                className={`option-card ${raceId === r.id ? "is-chosen" : ""}`}
                onClick={() => setRaceId(r.id)}
              >
                <span className="option-name">{r.name}</span>
                <span className="option-desc">{r.description}</span>
                <span className="option-trait">
                  {r.traitName}: {r.traitText}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="create-block">
          <h2>Class</h2>
          <div className="option-grid">
            {CLASSES.map((c) => (
              <button
                key={c.id}
                className={`option-card ${classId === c.id ? "is-chosen" : ""}`}
                onClick={() => setClassId(c.id)}
              >
                <span className="option-name">{c.name}</span>
                <span className="option-desc">{c.description}</span>
                <span className="option-trait">
                  d{c.hitDie} Hit Die · {c.acText}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="create-block">
          <h2>Ability Scores</h2>
          <div className="method-row">
            <button
              className={`btn ${method === "array" ? "btn-primary" : ""}`}
              onClick={() => setMethod("array")}
            >
              Standard Array
            </button>
            <button
              className={`btn ${method === "roll" ? "btn-primary" : ""}`}
              onClick={() => setMethod("roll")}
            >
              Roll 4d6
            </button>
            {method === "roll" && (
              <button className="btn" onClick={() => setRolled(rollAbilityScores())}>
                Reroll
              </button>
            )}
          </div>
          <p className="hint">
            Scores are assigned automatically to suit a {cls.name}. Racial bonuses are
            included below.
          </p>
          <div className="ability-grid">
            {ABILITY_ORDER.map((ability) => {
              const score = finalAbilities[ability];
              const bonus = race.bonuses[ability] ?? 0;
              return (
                <div key={ability} className="ability-cell">
                  <span className="ability-label">{ABILITY_LABELS[ability]}</span>
                  <span className="ability-score">{score}</span>
                  <span className="ability-mod">{signed(abilityMod(score))}</span>
                  {bonus > 0 && <span className="ability-bonus">racial +{bonus}</span>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="create-block">
          <h2>Recruit Three Companions</h2>
          <p className="hint">
            Companions fight alongside you, controlled by the game. Chosen {companions.length}/3.
          </p>
          <div className="option-grid">
            {COMPANIONS.map((c) => (
              <button
                key={c.name}
                className={`option-card ${companions.includes(c.name) ? "is-chosen" : ""}`}
                onClick={() => toggleCompanion(c.name)}
              >
                <span className="option-name">{c.name}</span>
                <span className="option-trait">
                  {getRace(c.raceId).name} {getClass(c.classId).name}
                </span>
                <span className="option-desc">{c.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        <button
          className="btn btn-primary btn-large"
          disabled={!canStart}
          onClick={start}
        >
          {canStart ? "Begin the Delve" : "Name your hero and pick three companions"}
        </button>
      </div>
    </div>
  );
}
