# Cuzy

A cozy pixel-art top-down game: Free Roam, vs AI, Wave Defense and a zombie Survival mode.
React + Vite, drawn on a 2D canvas.

```bash
npm install
npm run dev       # play locally (also serves the multiplayer rooms for friends on your Wi-Fi)
npm run deploy    # builds, then publishes dist/ to the gh-pages branch (GitHub Pages)
```

On GitHub: **Settings → Pages → Deploy from a branch → `gh-pages` / root**.

GitHub Pages only hosts static files, so online rooms there run on Supabase (below). `npm run deploy` reads your local
`.env` while building, so keep the Supabase values in it.

## Supabase: cloud saves and online rooms

With `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (copy `.env.example`), Cuzy uses Supabase for two things:

- **Cloud saves.** Your profile and saved games stay in `localStorage` and are also uploaded, so they come back
  on the next visit. Each browser is an anonymous Supabase user (turn on **Authentication → Providers → Anonymous
  sign-ins**); saves follow that browser, not a person. Sign-in with an account would be the next step.
- **Multiplayer rooms.** The lobby list is the `rooms` table, and everything inside a room travels over Supabase
  Realtime. The room host's browser does the referee's job (scores, winner, start, settings); if the host leaves,
  the longest-serving player takes over. This works on GitHub Pages, no room server needed.

Setup: run `supabase/schema.sql` once in the Supabase SQL Editor (it is safe to run again), then restart `npm run dev`.

Without those variables the game falls back to `localStorage` and the local room server that `npm run dev` runs
(friends on the same Wi-Fi can join it). The rooms table is open to anyone holding the public key, which is fine
for playing with friends; tighten the policies before anything more serious.

Art credits: Sunnyside World, Super Retro World Character Pack (Gif, Noiracide, Romi), the ENEMY pack
and the Apocalypse pack. See `public/assets/retro/LICENCE.txt` and check each pack's licence
before making the repository public.


## Credits

Cuzy uses art by these creators. Please visit their pages and support them (the same list is on the in-game About page).

- **Super Retro World: Character Pack**: Gif (@gif_not_jif), Noiracide (@Noiracide) and Romi (@DessRomaric): https://gif-superretroworld.itch.io/character-pack
- **Sunnyside World**: Daniel Diggle: https://danieldiggle.itch.io/sunnyside
- **Tiny Farm RPG: Asset Pack [16x16]** (free version): Emanuelle (emanuelledev): https://emanuelledev.itch.io/farm-rpg
- **Modern tiles (free)**, characters and interiors: LimeZu (author not fully confirmed for this exact free pack): https://limezu.itch.io
- **Post-Apocalypse Pixel Art Asset Pack**: TheLazyStone (free for non-commercial use): https://thelazystone.itch.io/post-apocalyptic-pixel-art-asset-pack
- **Basic monster and undead sprites**: Frostwindz (named in the pack's license; exact page not found): https://frostwindz.itch.io
- **Free Pixel Art Weapon Icons**: medievalmore: https://medievalmore.itch.io/free-weapon-icons
- Fonts: Pixelify Sans (Stefie Justprince) and Nunito (Vernon Adams, Jacques Le Bailly, Manvel Shmavonyan), via Google Fonts.

The art belongs to its creators and is used under their free licenses; if you fork this project, check each pack's license before sharing the files.
