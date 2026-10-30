import { useState } from 'react';
import { FOUND_BY_FORAGING, ITEMS, WATER_STAMINA, chestOdds, isConsumable } from '../game/items';
import ItemIcon from './ItemIcon';
import { Effects } from './Inventory';

const SKELETON_DROPS = ['coin', 'acorn', 'rock', 'gold', 'gem'];
const APOC_ONLY = ['bandage', 'canned', 'soup', 'medkit'];
const SURVIVAL_ITEMS = ['sword', 'barricade', 'hppack', 'soupcan', 'truffle'];

const range = (min, max) => (min === max ? `×${min}` : `×${min}–${max}`);

function Where({ id, mode }) {
  if (mode === 'survival') return null;
  const odds = chestOdds(id);
  return (
    <ul className="guide-where">
      {FOUND_BY_FORAGING[id] && <li>🌿 {FOUND_BY_FORAGING[id]}</li>}
      {SKELETON_DROPS.includes(id) && <li>💀 Dropped by skeletons</li>}
      {(id === 'barricade' || id === 'rock' || id === 'gem' || id === 'gold') && mode === 'waves' && <li>🌊 Dropped by monsters{id === 'barricade' ? ', and you start with 4' : ''}</li>}
      {odds && <li>🎁 Chests · {Math.round(odds.chance * 100)}% per roll · {range(odds.min, odds.max)}</li>}
    </ul>
  );
}

// ---------- the guide for each game ----------

const k = (t) => <kbd>{t}</kbd>;

function FreeRoamGuide() {
  return (
    <div className="guide-tips">
      <div><b>🌳 The game</b> Free Roam is an open, cozy world with day and night. Explore, fight monsters and skeletons, open chests, dive into dungeons and level up. Alone it never ends; in a room the host picks how a round is won (first to 10 player kills, or first to 15 monster kills).</div>
      <div><b>⚔️ Fighting</b> {k('Left click')} swings your sword. <b>Hold</b> it and let go for a dash attack. {k('F')} raises a shield (blocks everything for 3 seconds). {k('Right click')} throws the selected item; light things fly far, heavy ones thud close. Your first sword is grey and plain; better swords are greener, bluer and then golden, and the slash gets wider with your level.</div>
      <div><b>🗡️ Swords</b> Open the shop with {k('B')} and use the <b>Swords</b> tab for eight swords. Each has its own trick: <b>lucky crits, burning, chain lightning, life steal, a wide cleave</b> or <b>heavy knock-back</b>. Switch between the ones you own with {k('Tab')}. The <b>Attack speed</b> upgrade makes any of them swing faster.</div>
      <div><b>⭐ Levels</b> Every monster and player you defeat gives XP. Your base health is 100 and grows with levels and upgrades; the bar in the top-left shows how far you are from the next level. Defeated players drop up to 70% of their coins for anyone to grab.</div>
      <div><b>👹 Monster levels</b> Each monster has a level from 1 to 10 shown next to its health bar, in a colour that tells its rarity: <b style={{ color: '#5fd16a' }}>green</b> common, <b style={{ color: '#3fa7e8' }}>blue</b> uncommon, <b style={{ color: '#9b6cf0' }}>purple</b> rare, <b style={{ color: '#f0589a' }}>pink</b> epic, <b style={{ color: '#f2693a' }}>orange</b> mythic and <b style={{ color: '#d9a400' }}>gold ★ 10 ★</b> legendary. Higher levels are bigger, tougher and hit harder, but give much more XP. Levels rise as the days go by and at night.</div>
      <div><b>🌙 Night</b> After dark more monsters roam, and every so often a <b>swarm of 5</b> (bats and friends) rushes you. Each night a <b>night boss</b> rises with a red glow. Beat it before sunrise for coins, gems and gold, because <b>in daylight it catches fire and burns to ash, dropping nothing</b>. Hide in your house if it gets too hot.</div>
      <div><b>🏠 Your house</b> Walk through the front door to be teleported into your own room with a bed and a <b>storage chest</b> ({k('Space')}). Nobody can see you or hurt you in there. Step on the door mat to go back out. {k('H')} recalls you home (stand still 2.5s).</div>
      <div><b>🕳️ Dungeons</b> Out in the meadows are <b>crypts</b> (skeletons), <b>caves</b> (wild monsters) and <b>ruined houses</b>. Press {k('Space')} at the entrance. Monsters wake as you get close, a guardian waits in the last room, and <b>richer chests</b> (refilled every three days) are tucked in the corners. The farther from the middle of the world, the tougher they are. Leave through the glowing archway.</div>
      <div><b>🎁 Chests and fridges</b> Open one with {k('Space')} and the loot bursts out: walk over the pieces to collect them.</div>
      <div><b>💣 Sticky Grenade</b> Found in chests and sold in the shop's throwables. Select it and right click: it sticks to an enemy and explodes a few seconds later, with a red circle showing the blast. You can drop it like any item.</div>
      <div><b>🛒 Shop and supplies</b> Coins come from chests and defeated monsters. Press {k('B')} to buy upgrades, skills (a dash or spiral for left click, a shield or invisibility), supplies, throwables and more <b>chest space</b>. <b>HP Packs</b> ({k('Z')}) and <b>Soup Cans</b> ({k('X')}) live in two quick slots beside the hotbar.</div>
      <div><b>🎒 Backpack</b> Drag a stack onto another slot to rearrange it, or let go away from the slots to drop it (you choose how many). In the house chest, drag between the backpack and the chest the same way.</div>
      <div><b>💧 Stamina</b> Sprinting and dashing tire you. Face a lake or sea and press {k('Space')} for +{Math.round(WATER_STAMINA * 100)}% stamina, or eat and drink with {k('E')}.</div>
      <div><b>🌦 Weather</b> The sky changes every few hours and is the same for everyone in a room: clear, cloudy, rain or snow. The clock and weather sit at the top of the screen.</div>
      <div><b>💬 Chat</b> Press {k('Enter')} to chat. Everyone online can read it, even from another room (a 🌐 marks chat from other rooms). Messages show at the bottom left. Cheats are always on when you play alone, and in a room when the host turns on <i>Allow cheats?</i>: type <b>-help</b> for the commands.</div>
    </div>
  );
}

function SurvivalGuide() {
  return (
    <div className="guide-tips">
      <div><b>☠️ The goal</b> Hold the camper RV through <b>10 waves</b> of zombies, and beat the Colossus bosses. If the RV's health bar runs out, the round is lost. Between waves you have a short time to build. Everyone in a room plays together, and when the round ends you all go back to the room.</div>
      <div><b>🚐 The RV</b> It shows its <b>level</b> ("RV Lv N") above its health bar. Upgrade it in the shop ({k('B')}) for more health and more room for helpers. Zombies chew through walls and the RV, so keep them away from it.</div>
      <div><b>🔫 Guns</b> {k('Right click')} fires. You start with the <b>Pistol</b> (12 rounds). Buy the <b>Shotgun</b> (5 pellets, short range, 6 shells: up close the pellets stack into huge damage, and every pellet one-shots a normal enemy), the <b>Rifle</b> (a fast, accurate stream, 60 rounds) and the <b>Plasma gun</b> (glowing bolts that go through two enemies in a line, 20 charges) in the shop. Switch with {k('Tab')} or by clicking the gun slot beside the hotbar. The bar above the hotbar is your <b>ammo</b>, and when it hits zero you <b>reload automatically</b> (you also top up after a couple of seconds without shooting). Bullets fly right over the RV.</div>
      <div><b>⚾ Melee</b> {k('Left click')} swings the bat; hold and release for a dash. {k('F')} raises a shield. The shop sells <b>swords</b> too, each with its own trick (crits, burning, chain lightning, life steal, a wide cleave, a heavy blow). Equip one in the shop, or go back to the bat.</div>
      <div><b>🧱 Walls</b> Select the <b>Barricade</b> and left-click to set a wooden wall down. <b>Hold and drag</b> along a straight line to lay a whole row at once (as many as you have boxes), then let go. {k('Q')} and {k('E')} turn the wall. {k('Space')} picks one back up. Walls break: use <b>Repair all</b> in the shop to plant the destroyed ones back.</div>
      <div><b>💣 Sticky Grenade</b> Select it and right click: it sticks to the first enemy it hits and explodes after a few seconds. A red circle shows the blast before it goes off, so stay out of it. Find it in fridges or buy one in the shop.</div>
      <div><b>🎒 The only items</b> Survival keeps things simple: the <b>Barricade</b>, the <b>Health Pack</b> ({k('Z')}, restores health) and the <b>Soup or Soda Can</b> ({k('X')}, restores stamina), plus your bat and guns. Fridges and zombies drop them. <b>If you are downed you keep every item and coin</b> and wake up at the RV after a few seconds.</div>
      <div><b>🧟 Zombie levels</b> Every zombie shows a level from 1 to 10 in a rarity colour: <b style={{ color: '#5fd16a' }}>green</b> is a common level 1, then lime, teal, blue, purple, pink and orange, up to <b style={{ color: '#d9a400' }}>gold ★ 10 ★</b>, a huge legendary. Higher levels are tougher and hit harder, and later waves roll higher levels. <b style={{ color: '#e63d3d' }}>Bosses glow red</b> with a ☠ BOSS ☠ label.</div>
      <div><b>⚡ Power-ups</b> Somewhere around the 10th kill of a wave, a glowing orb may drop where a zombie fell (not every wave). Walk over it to use it right away, for the whole team: <b>⏳ Slow-mo</b> makes every zombie crawl for 8 seconds, and <b>💣 Big Blast</b> destroys every ordinary zombie (bosses only lose a fifth of their health). Grab it before it fades.</div>
      <div><b>🛒 Buy ({k('B')})</b> Upgrades (RV, endurance, melee and throw damage, a bigger lantern), <b>guns</b>, and helpers. <b>Thrower and Sharpshooter</b> helpers stand <b>on top of the RV</b> and shoot down; <b>Guards</b> run out on the ground after nearby zombies and slash them. Upgrading the RV makes room for more helpers.</div>
      <div><b>💀 Scoreboard</b> The left side lists who has defeated the most monsters, with a 👑 for the leader. Your helpers' kills count as one line.</div>
      <div><b>🌦 Maps and weather</b> Each map has its own look and weather: Overgrown Town, Frostbite Pass, Rust Orchard, Dry Plains, Dead Hollow and the indoor Cargo Depot. Tick <i>Generate a new layout</i> for a different arrangement of trees, obstacles and objects each game, or leave it off to play the map as it is. <i>Random map</i> picks one of the maps for you.</div>
      <div><b>💬 Chat</b> {k('Enter')} chats with everyone online, and messages show at the bottom left. {k('H')} recalls you to the RV.</div>
    </div>
  );
}

function WavesGuide() {
  return (
    <div className="guide-tips">
      <div><b>🌊 The goal</b> Survive 10 waves around the house. Left click sets a barricade box down (hold and drag for a row, {k('Q')} / {k('E')} turn it) and {k('Space')} picks one up. {k('H')} recalls you to the base (stand still 2.5s).</div>
      <div><b>♥ Drops</b> Monsters drop hearts that heal you, coins and throwable items. Right click throws without limit, but each throw drains the throw meter.</div>
      <div><b>👹 Monster levels</b> Each monster has a level from 1 to 10, shown as a coloured number (green common up to gold legendary). Higher levels are bigger and tougher, and show up in later waves. Bosses glow red.</div>
      <div><b>🪙 Buy ({k('B')})</b> Spend coins on base health, endurance, melee damage, throw damage and a bigger lantern. Hire a <b>Thrower, Guard or Sharpshooter</b> to help; upgrading the base makes room for more.</div>
      <div><b>💬 Chat</b> {k('Enter')} chats with everyone online. {k('Tab')} switches weapon where you have more than one.</div>
    </div>
  );
}

const KEYS = {
  free: [
    ['W A S D / arrows', 'Move'], ['Shift', 'Sprint'], ['Left click', 'Swing sword (hold to dash)'], ['Right click', 'Throw'], ['F', 'Shield'], ['C', 'Invisibility'],
    ['Space', 'Interact, open chests, enter doors'], ['1–9 / wheel', 'Choose a slot'], ['E', 'Eat / drink'], ['Z / X', 'HP Pack / Soup Can'], ['Tab', 'Switch sword'], ['B', 'Buy (shop)'],
    ['H', 'Go home'], ['M', 'Map'], ['Enter', 'Chat'], ['P', 'Pause'], ['G', 'This guide'],
  ],
  survival: [
    ['W A S D / arrows', 'Move'], ['Shift', 'Sprint'], ['Left click', 'Bat (hold to dash)'], ['Right click', 'Shoot'], ['Tab / R', 'Switch gun'], ['F', 'Shield'],
    ['Left click', 'Place a wall (hold and drag for a row)'], ['Q / E', 'Turn the wall'], ['Space', 'Pick up / interact'], ['Z / X', 'Health Pack / Soup Can'], ['H', 'Back to the RV'], ['B', 'Buy'], ['M', 'Map'], ['Enter', 'Chat'], ['P', 'Pause'], ['G', 'This guide'],
  ],
  waves: [
    ['W A S D / arrows', 'Move'], ['Shift', 'Sprint'], ['Left click', 'Swing sword (hold to dash)'], ['Right click', 'Throw'], ['F', 'Shield'], ['Left click', 'Place a barricade (drag for a row)'], ['Q / E', 'Turn it'],
    ['Space', 'Pick up / interact'], ['H', 'Back to the base'], ['B', 'Buy'], ['M', 'Map'], ['Enter', 'Chat'], ['P', 'Pause'], ['G', 'This guide'],
  ],
};

const TITLES = { free: '🌳 Free Roam guide', survival: '☠️ Survival guide', waves: '🌊 Wave Defense guide' };

export default function Guide({ onClose, mode = 'free' }) {
  const [tab, setTab] = useState('play');
  const worth = (def) => (def.heal || 0) + (def.energy || 0) * 2;
  const pool = Object.entries(ITEMS).filter(([id]) => id !== 'coin' && (mode === 'survival' ? SURVIVAL_ITEMS.includes(id) : !APOC_ONLY.includes(id)));
  const rows = pool.sort((a, b) => Number(isConsumable(b[1])) - Number(isConsumable(a[1])) || worth(b[1]) - worth(a[1]));
  const tabs = [['play', 'How to play'], ['keys', 'Controls'], ['items', mode === 'survival' ? 'Items' : 'All items']];

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel guide">
        <header className="inv-head">
          <h2>{TITLES[mode] || TITLES.free}</h2>
          <button className="btn small-btn" onClick={onClose} aria-label="Close guide">✕</button>
        </header>

        <div className="guide-tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`guide-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'play' && (mode === 'survival' ? <SurvivalGuide /> : mode === 'waves' ? <WavesGuide /> : <FreeRoamGuide />)}

        {tab === 'keys' && (
          <div className="guide-tips guide-keys">
            {(KEYS[mode] || KEYS.free).map(([key, what]) => (
              <div key={key}><kbd>{key}</kbd> {what}</div>
            ))}
            <div className="hint">On a phone the on-screen buttons do the same jobs; move them in Settings, then Edit button layout.</div>
          </div>
        )}

        {tab === 'items' && (
          <div className="guide-list">
            {rows.map(([id, def]) => (
              <div className="guide-row" key={id}>
                <div className="guide-icon"><ItemIcon id={id} scale={4} /></div>
                <div className="guide-info">
                  <h3>{def.name}</h3>
                  <p>{def.desc}</p>
                  <Effects def={def} />
                </div>
                <Where id={id} mode={mode} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
