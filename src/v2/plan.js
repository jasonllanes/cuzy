// What was found in AssetPackV2 and what Free Roam V2 could be made from it. (The same text lives in src/v2/DESIGN.md.)

export const PACK_SCAN = {
  name: 'Modern Exteriors by LimeZu',
  license: 'Free to use, edit and publish in open source projects; credit LimeZu (https://limezu.itch.io/modernexteriors); the files themselves may not be resold or redistributed.',
  sizes: 'The same art three times over: 16x16 (the one the game uses, the same tile size as V1), 32x32 and 48x48. Plus 188 RPG Maker MV tilesets.',
  parts: [
    ['6,224 single sprites', 'in 24 themes: terrains, city, props, buildings, vehicles, camping, hospital, school, police, fire, garden, graveyard, subway, beach, military, houses...'],
    ['~540 animated sheets', 'street lamps, fires, doors, fountains, boats, fish, pigeons, seagulls, ghosts, candles, helicopters, tanks'],
    ['28 autotile blocks', 'grass, dirt, sand, water, roads, floors, walls (64x64 blocks of 4x4 tiles)'],
    ['11 character sheets', 'Scout x6, Postman x3, Skeleton, Swimmers: 16x32 frames, 6-frame idle and walk loops in 4 directions'],
    ['25 outfit and accessory add-ons', 'firefighter, soldier, general, postman, worker helmet, pumpkin head, ghost bodies (made for a character generator the pack does not include)'],
  ],
  gaps: [
    'No monsters except skeletons and ghosts: Survival zombies and the existing monsters carry over.',
    'No farm animals: pigeons, seagulls and fish are the only creatures.',
    'Buildings come ready-made (houses, hospital, school, police station, fire station, hotel, mall) or as modular pieces; no building interiors beyond a few examples.',
  ],
};

export const V2_PLAN = {
  title: 'Free Roam V2: Cuzy City',
  pitch: 'The same game as Free Roam, moved from a cozy meadow to a small modern town: explore, scavenge, fight, level up and win rooms against friends, but between houses, shops, parks and rooftops.',
  rules: 'Nothing about the rules changes: the same movement, stamina, sword and throwing combat, shop, levels and XP, kill streaks, teams, AI players, rooms, cheats, day and night, weather. Only the world and what lives in it is new.',
  mapping: [
    ['Meadow, lakes, forests', 'A street grid with pavements and districts (suburbs, downtown, park, beachfront, camp, graveyard, military base, worksite), cut up with the same biome blobs as the Patchwork map'],
    ['Your house, with a chest', 'A house or flat from the Additional Houses, Villas and Condo sets; the room inside and the chest at home stay'],
    ['Chests and fridges', 'Dumpsters, bins, vending machines, mail boxes and military crates burst open with loot'],
    ['Foraged berries and mushrooms', 'Fruit from market stalls, flowers from the park, snacks from vending machines'],
    ['Cows and chickens to ride', 'Cars, scooters and boats to ride (the animal\'s stamina becomes fuel); a helicopter pad takes the place of Teleport Home'],
    ['Skeleton camps, crypts, caves', 'Graveyard camps, subway tunnels, military bunkers and the haunted house as the dungeons'],
    ['Trees to chop', 'Street trees and hedges, planters and park benches to smash'],
    ['Lakes and shores', 'The sea, the pool and the beach set, with the same wading and drowning rules'],
    ['Heroes (retro pixel pack)', 'The same heroes, plus Scouts and Postmen with proper walk loops, and outfits as unlockable looks'],
    ['Swords and guns shop', 'A mall: sword shop, gun shop and the new Sell tab'],
  ],
  zones: [
    ['Suburbs', 'houses, gardens, mailboxes', 'friendly, good loot in house chests'],
    ['Downtown', 'police, fire station, hotel, mall, gas station', 'busy, cars, the shop, more fights'],
    ['Park and camp', 'fountain, hedges, tents, campfire', 'safe place to recover, forage'],
    ['Seafront', 'beach, pool, boats', 'water, beach balls, boat rides'],
    ['Graveyard and haunted hill', 'tombs, haunted house, ghosts', 'night monsters, skeleton camps'],
    ['Military base', 'tanks, hangar, radio tower, crates', 'the hardest enemies and the best loot'],
  ],
  heroes: ['Scout 1 to 6 and Postman 1 to 3 (real walk animations)', 'All 32 retro heroes still work (see the scale test in the room)'],
  tech: [
    'Same 16 px grid, so movement, collision, chunks and the biome and Wang tile code can be reused.',
    'Props are drawn from per-theme atlases and depth sorted by their feet; collision is a strip along the foot of each sprite (trees: just the trunk).',
    'Ground uses the plain asphalt, pavement and grass tiles; roads and curbs can use the autotile blocks.',
  ],
  next: [
    'Online rooms for V2 (the room server and the Supabase rooms already carry a map name in the seed).',
    'Rideable cars and a helicopter pad, building interiors for the shops and the hospital.',
    'Saved progress per map, the sword and gun shop, kill streaks and AI players, as in V1.',
    'Touch controls.',
  ],
};
