// The bundled mini-campaign: "The Tomb of the Bone Tyrant".

import type { Room } from "./types";

export const CAMPAIGN_TITLE = "The Tomb of the Bone Tyrant";

export const START_ROOM = "entrance";

export const ROOMS: Record<string, Room> = {
  entrance: {
    id: "entrance",
    name: "The Tomb Entrance",
    kind: "story",
    description:
      "Cold air breathes from a cracked stone archway carved with grinning skulls. " +
      "Somewhere far below, Malgrith the Bone Tyrant stirs the dead. Your party lights " +
      "a torch and steps into the dark.",
    exits: [{ label: "Descend the worn stairs", to: "guardroom" }],
  },

  guardroom: {
    id: "guardroom",
    name: "The Guardroom",
    kind: "fight",
    description:
      "A squat chamber strewn with gnawed bones. Three goblins leap up from a dice game, " +
      "snatching rusty blades and shrieking the alarm.",
    encounter: ["goblin", "goblin", "goblin"],
    gold: 15,
    aftermath:
      "The goblins lie still. Among their loot you find a handful of coins and two " +
      "passages leading deeper.",
    exits: [{ label: "Press on through the broken doorway", to: "fork" }],
  },

  fork: {
    id: "fork",
    name: "The Sundered Hall",
    kind: "story",
    description:
      "A collapsed hall splits the way ahead. To the left, a low passage trails fresh " +
      "webbing. To the right, a corridor of niches packed with mouldering coffins.",
    exits: [
      { label: "Take the web-choked tunnel", to: "spider-warren" },
      { label: "Take the crypt corridor", to: "crypt-corridor" },
    ],
  },

  "spider-warren": {
    id: "spider-warren",
    name: "The Spider Warren",
    kind: "fight",
    description:
      "Thick webs sheathe every surface. A giant spider drops from the ceiling while two " +
      "web-wrapped skeletons tear themselves free to attack.",
    encounter: ["giant-spider", "skeleton", "skeleton"],
    gold: 45,
    aftermath:
      "Cutting through the last of the webs, you find the desiccated remains of a previous " +
      "adventurer — and the gold they never spent.",
    exits: [{ label: "Continue to the dim glow ahead", to: "shrine" }],
  },

  "crypt-corridor": {
    id: "crypt-corridor",
    name: "The Crypt Corridor",
    kind: "fight",
    description:
      "Coffin lids grind open along the corridor. Three skeletons clamber out, jaws " +
      "clacking, and shamble toward you.",
    encounter: ["skeleton", "skeleton", "skeleton"],
    gold: 30,
    aftermath:
      "The bones go quiet. A funerary offering of coins glitters in an open sarcophagus.",
    exits: [{ label: "Continue to the dim glow ahead", to: "shrine" }],
  },

  shrine: {
    id: "shrine",
    name: "The Forgotten Shrine",
    kind: "rest",
    description:
      "A serene shrine to a forgotten god of light, untouched by the tomb's corruption. " +
      "A still pool of clear water offers a moment of safety to rest and recover.",
    aftermath: "Rested and resolute, your party turns toward the deeper dark.",
    exits: [{ label: "Advance toward the sound of marching", to: "war-room" }],
  },

  "war-room": {
    id: "war-room",
    name: "The War Room",
    kind: "fight",
    description:
      "A hobgoblin captain barks orders at two snarling orcs. They were expecting you — " +
      "and they intend to make this the end of your delve.",
    encounter: ["hobgoblin", "orc", "orc"],
    gold: 60,
    aftermath:
      "The captain's command finally falters. Behind a barred door lies the tomb's vault.",
    exits: [{ label: "Force open the vault door", to: "vault" }],
  },

  vault: {
    id: "vault",
    name: "The Tyrant's Vault",
    kind: "treasure",
    description:
      "Heaped coins, old weapons, and a rack of red potions glittering in the torchlight. " +
      "You take what you can carry.",
    gold: 120,
    aftermath:
      "Pockets heavy and packs restocked, only one door remains — banded in black iron " +
      "and humming with cold power.",
    exits: [{ label: "Approach the black iron door", to: "antechamber" }],
  },

  antechamber: {
    id: "antechamber",
    name: "The Antechamber",
    kind: "story",
    description:
      "Green witch-light seeps under the door ahead. A voice like grinding tombstones " +
      "calls out: 'Come, little lives. I have graves enough for you all.' This is it.",
    exits: [{ label: "Throw open the doors and face the Tyrant", to: "throne" }],
  },

  throne: {
    id: "throne",
    name: "The Throne of Bone",
    kind: "boss",
    description:
      "Malgrith the Bone Tyrant rises from a throne of fused skeletons, two guardians " +
      "flanking him. The air itself turns to grave-cold. This is the final battle.",
    encounter: ["bone-tyrant", "skeleton", "skeleton", "hobgoblin"],
    gold: 250,
    aftermath: "Malgrith crumbles to ash. The tomb falls silent at last — you have won.",
    exits: [],
  },
};

export function getRoom(id: string): Room {
  const room = ROOMS[id];
  if (!room) throw new Error(`Unknown room: ${id}`);
  return room;
}
