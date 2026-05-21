import { CAMPAIGN_TITLE } from "../engine/campaign";
import { useGame } from "../useGame";

export function TitleScreen() {
  const game = useGame();
  return (
    <div className="screen-center">
      <div className="title-card">
        <p className="eyebrow">Dungeons &amp; Dragons Simulator</p>
        <h1 className="title-main">{CAMPAIGN_TITLE}</h1>
        <p className="title-blurb">
          Forge a hero, gather a party of adventurers, and descend into a tomb crawling
          with goblins, undead, and the necromancer who rules them all. Roll the dice,
          trust your steel, and see if you survive to face the Bone Tyrant.
        </p>
        <ul className="title-features">
          <li>5e-style ability scores, classes, and ancestries</li>
          <li>Turn-based combat with attacks, spells, and saving throws</li>
          <li>A branching dungeon, treasure, leveling up, and a final boss</li>
        </ul>
        <button className="btn btn-primary btn-large" onClick={() => game.beginCharacterCreation()}>
          Begin Your Adventure
        </button>
      </div>
    </div>
  );
}
