# Free Roam V2: Cuzy City

> **Update:** Free Roam V2 is no longer a separate game. The standalone `V2Game` / `V2Menu` / `engine.js` described below were removed; V2 is the real engine
> with a `~v2` seed (`src/game/v2world.js`). The Training Room V2 and map editor in this folder remain. Treat the game sections below as the original plan.

A design note written after scanning `AssetPackV2` (kept out of git). The same text is shown in the Training Room V2, "V2 plan" tab
(`src/v2/plan.js`). Open the room from the main menu ("Training room V2") or at `#/training-v2`.

## What the pack is

**Modern Exteriors by LimeZu** (https://limezu.itch.io/modernexteriors). Free to use and edit in open source projects, **credit
required**, files may not be resold or redistributed. It is in `public/assets` only as the packed atlases below, and credited in
`src/game/credits.js`.

- Three sizes of the same art: 16x16 (the one used, same tile as V1), 32x32 and 48x48, plus 188 RPG Maker MV tilesets.
- 6,224 single sprites in 24 themes: terrains, city terrains, city props, generic and modular buildings, vehicles, camping, hotel and
  hospital, school, swimming pool, police, office, garden, fire station, graveyard, subway, beach, post office, military base,
  additional houses (Victorian, modern, country, Japanese, terraced, haunted), villas, worksite, shops, garage sales.
- About 540 animated sheets (street lamps, fires, doors, fountains, boats, fish, pigeons, seagulls, ghosts, candles, helicopters, tanks).
- 28 autotile blocks (grass, dirt, sand, water, roads, floors, walls).
- 11 character sheets: Scout x6, Postman x3, Skeleton, Swimmers (16x32 frames, 6-frame idle and walk loops, 4 directions).
- 25 outfit and accessory add-ons made for a character generator that the pack does not include.
- Missing: monsters other than skeletons and ghosts, farm animals, and most building interiors.

## The game

The same rules as Free Roam (movement, stamina, melee and throwing, shop and Sell tab, levels, kill streaks, teams, AI players,
rooms, day and night, weather), in a small modern town instead of a meadow.

| Free Roam | V2 |
| --- | --- |
| Meadow, lakes, forests | Street grid with pavements, split into districts by the same biome blobs as the Patchwork map |
| Your house and chest | A house or flat from the Additional Houses, Villas and Condo sets |
| Chests, fridges | Dumpsters, bins, vending machines, mail boxes, military crates |
| Berries, mushrooms | Market fruit, park flowers, vending snacks |
| Cow and chicken to ride | Cars, scooters, boats; a helicopter pad instead of Teleport Home |
| Skeleton camps, crypts, caves | Graveyard camps, subway tunnels, military bunkers, the haunted house |
| Trees to chop | Street trees, hedges, planters, benches |
| Lakes | The sea, pool and beach set |
| Heroes | The retro heroes plus Scouts and Postmen |
| Sword and gun shop | A mall |

Districts: Suburbs, Downtown, Park and camp, Seafront, Graveyard and haunted hill, Military base.

## How it is built

- `scripts/build-v2-assets.py` packs the pack into `public/assets/v2/` (one atlas per theme, loaded on demand).
- `src/v2/assets.js` loads atlases, `chars.js` draws the characters, `world.js` builds the yard (ground, markings, props, collision),
  `TrainingV2.jsx` is the room.
- Everything stands on the same 16 px grid as V1. Props are depth sorted by their feet and block with a strip along the foot of the
  sprite (trees: only the trunk), editable per prop in the room.

## Where it stands

Free Roam V2 is playable solo from the main menu ("Free Roam V2"): the current 32 heroes, seven maps (Downtown, Sunny Suburbs,
Seaside Promenade, Green Park and Camp, Haunted Hill, Army Base, Patchwork City) plus a random map and "generate a new layout", a
preview of the whole map, and the map editor (drag props around, drag new ones out of the whole pack, paint the ground; press T in
the game to edit the map you are playing). The game has exploring, bins and crates to open, monsters by district and by night,
sword and throwing, HP and stamina lists, XP and levels, a shop and day and night. The editor also opens as the Training Room
(`#/training-v2`).

Code: `src/v2/maps.js` (districts and maps), `ground.js`, `engine.js` (the game), `V2Game.jsx`, `V2Menu.jsx`, `MapEditor.jsx`,
`Palette.jsx`, `MapPreviewV2.jsx`, `custom.js` (saved edits per map).

## Next

Online rooms for V2, rideable cars and a helicopter pad, building interiors, saved progress, the sword and gun shop, AI players and
touch controls.
