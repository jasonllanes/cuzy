# Cuzy

A cozy pixel-art top-down game: Free Roam, vs AI, Wave Defense and a zombie Survival mode.
React + Vite, drawn on a 2D canvas.

```bash
npm install
npm run dev       # play locally (also serves the multiplayer rooms for friends on your Wi-Fi)
npm run deploy    # builds, then publishes dist/ to the gh-pages branch (GitHub Pages)
```

On GitHub: **Settings → Pages → Deploy from a branch → `gh-pages` / root**.

GitHub Pages only hosts static files, so the deployed site runs solo modes; multiplayer rooms need
`npm run dev` (or `npm run preview`) running on a machine your friends can reach.

Art credits: Sunnyside World, Super Retro World Character Pack (Gif, Noiracide, Romi), the ENEMY pack
and the Apocalypse pack. See `public/assets/retro/LICENCE.txt` and check each pack's licence
before making the repository public.
