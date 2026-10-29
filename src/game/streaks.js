// Kill streaks and multi-kills between heroes: works out what to announce when someone goes down.
// Keys are whatever identifies a hero to the caller ('me', a bot id, a player id).

const MULTI_WINDOW = 4.5; // seconds between kills that still count as one multi-kill
const MULTI = ['', '', 'Double Kill', 'Triple Kill', 'Quadra Kill', 'Penta Kill', 'Hexa Kill'];
const MULTI_MAX = 'Monster Kill';
const SPREE = { 3: 'Killing Spree', 5: 'Rampage', 7: 'Dominating', 9: 'Unstoppable', 11: 'Godlike', 13: 'Legendary' };

export class Streaks {
  constructor(onAnnounce) {
    this.onAnnounce = onAnnounce;
    this.reset();
  }

  reset() {
    this.stats = new Map(); // key -> { streak, multi, last }
    this.total = 0; // kills so far this round
  }

  stat(key) {
    let s = this.stats.get(key);
    if (!s) this.stats.set(key, (s = { streak: 0, multi: 0, last: -99 }));
    return s;
  }

  // someone went down without scoring (killed by a monster, say): their streak is over
  died(key) {
    const s = this.stat(key);
    s.streak = 0;
    s.multi = 0;
  }

  // `killer` and `victim` are keys; `names` the display names; `mine` is true when you did it
  // `firstOverride`: the room's own word on whether this is the first takedown of the round (a player who joined late has not seen the earlier ones)
  kill(killer, victim, names, mine = false, now = performance.now() / 1000, firstOverride = undefined) {
    const k = this.stat(killer);
    const v = this.stat(victim);
    const victimStreak = v.streak;
    v.streak = 0;
    v.multi = 0;

    k.streak++;
    k.multi = now - k.last <= MULTI_WINDOW ? k.multi + 1 : 1;
    k.last = now;
    const first = firstOverride ?? this.total === 0;
    this.total++;

    let title = null;
    let tier = 1;
    if (k.multi >= 2) {
      title = MULTI[k.multi] || MULTI_MAX;
      tier = Math.min(3, k.multi - 1);
    } else if (SPREE[k.streak]) {
      title = SPREE[k.streak];
      tier = k.streak >= 9 ? 3 : 2;
    } else if (first) {
      title = 'First Blood';
    } else if (victimStreak >= 3) {
      title = 'Shutdown';
      tier = 2;
    }
    if (!title) return;

    const bits = [`${names.killer} took down ${names.victim}`];
    if (k.streak >= 2 && title !== SPREE[k.streak]) bits.push(`${k.streak} kill streak`);
    if (victimStreak >= 3 && title !== 'Shutdown') bits.push(`ended a ${victimStreak} streak`);
    this.onAnnounce({ title, sub: bits.join(' · '), tier, mine, who: names.killer });
  }
}
