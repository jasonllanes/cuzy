// Who made the art, fonts and tools Cuzy uses. Shown on the About page and in the README.
// `checked` says how the name was confirmed: 'page' = found the creator's page online, 'file' = from the license file
// that ships with the pack (page not found online), 'guess' = the pack is part of a well-known series, not confirmed.

export const CREDITS = [
  {
    pack: 'Super Retro World: Character Pack',
    authors: 'Gif (@gif_not_jif), Noiracide (@Noiracide) and Romi (@DessRomaric)',
    link: 'https://gif-superretroworld.itch.io/character-pack',
    used: 'All the playable heroes, in Free Roam and in Survival.',
    license: 'Free to use with credit. Please mention the authors.',
    checked: 'page',
  },
  {
    pack: 'Sunnyside World',
    authors: 'Daniel Diggle',
    link: 'https://danieldiggle.itch.io/sunnyside',
    used: 'Skeletons, mushrooms, item icons (acorns, jars, eggs, milk, ore…) and the layered townsfolk.',
    license: 'Free pack by Daniel Diggle (pay what you want).',
    checked: 'page',
  },
  {
    pack: 'Tiny Farm RPG: Asset Pack [16x16] (free version)',
    authors: 'Emanuelle (emanuelledev)',
    link: 'https://emanuelledev.itch.io/farm-rpg',
    used: 'The cottage, maple trees, chests, crops, stepping stones, the grass tileset, chickens, cows, and the house furniture.',
    license: 'Free version, pay what you want.',
    checked: 'page',
  },
  {
    pack: 'Modern tiles (free): characters and interiors',
    authors: 'LimeZu',
    link: 'https://limezu.itch.io',
    used: 'The modern heroes, and the sofa, bookshelf, rugs, windows and paintings inside your house.',
    license: 'Free version: personal and non-commercial projects only.',
    checked: 'guess',
    note: "The pack's license file does not name its author. It looks like part of LimeZu's Modern Interiors / Modern Exteriors series, but I could not confirm this exact free pack online.",
  },
  {
    pack: 'Post-Apocalypse Pixel Art Asset Pack',
    authors: 'TheLazyStone',
    link: 'https://thelazystone.itch.io/post-apocalyptic-pixel-art-asset-pack',
    used: 'Survival mode: the survivor and pistol, zombies, wrecked buses and cars, containers, fences, walls, trees, ground tiles and every prop.',
    license: 'Free for non-commercial use. Commercial use requires paying the author. No redistribution.',
    checked: 'file',
  },
  {
    pack: 'Basic monster and undead sprites',
    authors: 'Frostwindz',
    link: 'https://frostwindz.itch.io',
    used: 'The monsters of Free Roam and Wave Defense (jellies, slaads, ogres, trolls, the cyclops, bats, eyes…).',
    license: 'Frostwindz Asset License Agreement: no redistribution or resale of the files themselves.',
    checked: 'file',
    note: 'The author is named in the license agreement that came with the pack. I could not find the exact pack page online.',
  },
  {
    pack: 'Free Pixel Art Weapon Icons (32 Free Weapon Icons)',
    authors: 'medievalmore',
    link: 'https://medievalmore.itch.io/free-weapon-icons',
    used: 'The eight swords in the Free Roam shop.',
    license: 'Free pack, pay what you want.',
    checked: 'page',
  },
];

// (added after the packs above)
CREDITS.push({
  pack: 'Tidal Isles, Emerald Isles, Crystal Lakes, Mossy Marsh, Magma Fields, Sunny Shores, Cracked Roads and Mountain Paths tilesets (mixed together in the Patchwork Lands)',
  authors: 'Generated with Pixellab (pixellab.ai) for this project',
  link: 'https://www.pixellab.ai',
  used: 'The water and ground tiles of the Tidal Isles, Emerald Isles, Crystal Lakes, Mossy Marsh, Magma Fields, Sunny Shores, Cracked Roads and Mountain Paths maps.',
  license: 'AI-generated pixel art made for Cuzy.',
  checked: 'file',
});

export const TOOLS = [
  { name: 'Pixelify Sans', by: 'Stefie Justprince', link: 'https://fonts.google.com/specimen/Pixelify+Sans', what: 'the pixel font' },
  { name: 'Nunito', by: 'Vernon Adams, Jacques Le Bailly and Manvel Shmavonyan', link: 'https://fonts.google.com/specimen/Nunito', what: 'the text font' },
  { name: 'React', by: 'Meta and contributors', link: 'https://react.dev', what: 'the interface' },
  { name: 'Vite', by: 'Evan You and contributors', link: 'https://vite.dev', what: 'the build tool' },
  { name: 'Supabase', by: 'the Supabase team', link: 'https://supabase.com', what: 'cloud saves and online rooms' },
];
