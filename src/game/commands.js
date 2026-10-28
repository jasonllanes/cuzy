import { ITEMS } from './items';
import { MAX_LEVEL } from './upgrades';
import { WEAPONS, weaponById } from './weapons';
import { WEATHER } from './weather';
import { MAX_CHAR_LEVEL, hp100 } from './stats';

// Chat commands for when cheats are allowed (always in a solo game, and in a room when the host turned them on).
// Type them in the chat box (Enter) starting with a dash.

export const COMMANDS = [
  { name: 'gold', usage: '-gold 9999', desc: 'Give yourself coins' },
  { name: 'level', usage: '-level 1-50', desc: 'Set your character level' },
  { name: 'upgrades', usage: '-upgrades 1-9', desc: 'Set every shop upgrade to this level' },
  { name: 'xp', usage: '-xp 500', desc: 'Give yourself experience' },
  { name: 'heal', usage: '-heal', desc: 'Full health and stamina' },
  { name: 'hp', usage: '-hp 50', desc: 'Set your HP' },
  { name: 'god', usage: '-god', desc: 'Toggle invincibility' },
  { name: 'give', usage: '-give gem 5', desc: 'Put items in your backpack (-give list)' },
  { name: 'sword', usage: '-sword ember', desc: 'Unlock and equip a sword (-sword all)' },
  { name: 'time', usage: '-time 12', desc: 'Set the hour of the day (0-24)' },
  { name: 'weather', usage: '-weather rain', desc: 'clear, cloudy, rain, snow or auto' },
  { name: 'tp', usage: '-tp 40 -20', desc: 'Teleport to a tile' },
  { name: 'clear', usage: '-clear', desc: 'Clear the chat' },
  { name: 'help', usage: '-help', desc: 'Show this list' },
];

const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v))));

// Runs one command for the game. Returns what to tell the player.
export function runCommand(game, text) {
  const [raw, ...args] = text.trim().slice(1).split(/\s+/);
  const cmd = (raw || '').toLowerCase();
  const c = game.combat;
  switch (cmd) {
    case 'help':
      return COMMANDS.map((x) => `${x.usage}  ${x.desc}`).join('\n');
    case 'gold': {
      const n = int(args[0] ?? 100, 1, 99999);
      if (!Number.isFinite(n)) return 'Usage: -gold 9999';
      game.giveCoins(n);
      return `🪙 +${n} coins`;
    }
    case 'level': {
      const n = int(args[0], 1, MAX_CHAR_LEVEL);
      if (!Number.isFinite(n)) return `Usage: -level 1-${MAX_CHAR_LEVEL}`;
      game.setLevel(n);
      return `⭐ You are now level ${n} (${hp100(c.maxHp)} max HP).`;
    }
    case 'xp': {
      const n = int(args[0] ?? 100, 1, 999999);
      if (!Number.isFinite(n)) return 'Usage: -xp 500';
      game.addXp(n);
      return `✨ +${n} XP`;
    }
    case 'upgrades': {
      const n = int(args[0], 1, 9);
      if (!Number.isFinite(n)) return 'Usage: -upgrades 1-9';
      for (const k of Object.keys(game.upgrades)) if (k !== 'house') game.upgrades[k] = n - 1;
      c.refreshMaxHp(true);
      game.save();
      return `⬆ Every upgrade is now level ${n - 1}${n - 1 > MAX_LEVEL ? ' (past the shop maximum)' : ''}.`;
    }
    case 'heal':
      c.hp = c.maxHp;
      game.stamina = 1;
      game.exhausted = false;
      return '❤️ Fully healed.';
    case 'hp': {
      const n = Number(args[0]);
      if (!Number.isFinite(n)) return 'Usage: -hp 50';
      c.hp = Math.min(c.maxHp, Math.max(1, n) / (100 / 6));
      return `❤️ ${hp100(c.hp)} HP`;
    }
    case 'god':
      c.god = !c.god;
      return c.god ? '🛡️ God mode on. Nothing can hurt you.' : '🛡️ God mode off.';
    case 'give': {
      const id = (args[0] || '').toLowerCase();
      if (!id || id === 'list') return `Items: ${Object.keys(ITEMS).join(', ')}`;
      if (!ITEMS[id]) return `No item called "${id}". Try -give list`;
      const qty = int(args[1] ?? 1, 1, 999);
      return game.cheatGive(id, qty);
    }
    case 'sword': {
      if (game.wave) return 'Swords are only for Free Roam.';
      const id = (args[0] || '').toLowerCase();
      if (id === 'all') {
        for (const w of WEAPONS) game.weapons.owned[w.id] = true;
        game.save();
        return '⚔️ Every sword unlocked.';
      }
      const w = WEAPONS.find((x) => x.id === id || x.name.toLowerCase().startsWith(id));
      if (!id || !w) return `Swords: ${WEAPONS.map((x) => x.id).join(', ')}, all`;
      game.weapons.owned[w.id] = true;
      game.weapons.equipped = w.id;
      game.save();
      return `⚔️ ${weaponById(w.id).name} equipped.`;
    }
    case 'time': {
      const h = Number(args[0]);
      if (!Number.isFinite(h)) return 'Usage: -time 12';
      game.setHour(((h % 24) + 24) % 24);
      return `🕐 It is now ${Math.floor(h % 24)}:00 (just for you in a room).`;
    }
    case 'weather': {
      const k = (args[0] || '').toLowerCase();
      if (k !== 'auto' && !WEATHER[k]) return 'Usage: -weather clear | cloudy | rain | snow | auto';
      game.weatherForce = k === 'auto' ? null : k;
      game.weatherT = 0;
      return k === 'auto' ? '🌦 The weather is back to normal.' : `🌦 ${WEATHER[k].name} (just for you).`;
    }
    case 'tp': {
      const x = Number(args[0]);
      const y = Number(args[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return 'Usage: -tp 40 -20 (tile numbers, see the HUD)';
      game.teleportTo(x * 16 + 8, y * 16 + 12);
      return `📍 Teleported to ${x}, ${y}`;
    }
    default:
      return `Unknown command "-${cmd}". Type -help for the list.`;
  }
}
