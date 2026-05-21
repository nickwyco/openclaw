import { useEffect, useRef } from "react";
import { useGame } from "../useGame";

export function GameLog() {
  const game = useGame();
  const { log } = game.state;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [log.length]);

  return (
    <section className="panel log-panel">
      <h2 className="panel-title">Adventure Log</h2>
      <div className="log-scroll">
        {log.map((entry) => (
          <p key={entry.id} className={`log-line tone-${entry.tone}`}>
            {entry.text}
          </p>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
