import { useSyncExternalStore } from "react";
import { game } from "./engine/game";

/** Subscribe a component to the game store; returns the singleton controller. */
export function useGame() {
  useSyncExternalStore(game.subscribe, game.getSnapshot, game.getSnapshot);
  return game;
}
