import { CREDITS, TOOLS } from '../game/credits';

const CHECKED = {
  page: '✔ author confirmed from their page',
  file: '✔ author named in the license file that came with the pack',
  guess: '⚠ author not fully confirmed',
};

// What Cuzy is, how to play it, and who made the art: the main menu's About page and the in-game menu's About both show this.
export default function AboutContent() {
  return (
    <>
      <h2 className="page-title">📖 About Cuzy</h2>
      <p>
        Cuzy is a cozy pixel-art game you can play alone or with friends: wander a map, forage and open chests, ride a chicken, explore crypts,
        caves and ruined houses, fight rivals or monsters, defend a house through wave after wave, or survive the zombie apocalypse.
      </p>
      <h3 className="shop-h">🎮 Controls</h3>
      <p className="hint">
        <b>WASD</b> move · <b>Shift</b> sprint · <b>Left click</b> attack (hold for a weapon's big move) · <b>Space</b> dash · <b>Right click</b> throw / shoot · <b>F</b> use, open, enter ·
        <b> 1-9</b> select · <b>E</b> eat · <b>B</b> shop · <b>Tab</b> switch weapon · <b>M</b> map · <b>Enter</b> chat · <b>P</b> pause · <b>G</b> guide
      </p>

      <h3 className="shop-h">🎨 Credits</h3>
      <p className="hint">Cuzy would not look like this without the artists below. Please visit their pages and support their work.</p>
      <ul className="credits">
        {CREDITS.map((c) => (
          <li key={c.pack} className="credit">
            <b>{c.pack}</b>
            <span className="credit-by">by {c.authors}</span>
            <span>{c.used}</span>
            <a href={c.link} target="_blank" rel="noopener noreferrer">{c.link.replace('https://', '')}</a>
            <small className="credit-lic">{c.license}</small>
            <small className={`credit-check ${c.checked}`}>{CHECKED[c.checked]}</small>
            {c.note && <small className="credit-note">{c.note}</small>}
          </li>
        ))}
      </ul>
      <h3 className="shop-h">🛠 Made with</h3>
      <ul className="credits tools">
        {TOOLS.map((t) => (
          <li key={t.name}><a href={t.link} target="_blank" rel="noopener noreferrer">{t.name}</a> by {t.by}: {t.what}</li>
        ))}
        <li>All sound effects are made in the browser as the game runs, so there are no audio files to credit.</li>
      </ul>
      <p className="hint">The art belongs to its creators and is used under their free licenses. Cuzy is a free, non-commercial project.</p>
    </>
  );
}
