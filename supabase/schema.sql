-- Cuzy's cloud storage. Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- It is safe to run again. Also turn on Authentication -> Providers -> "Anonymous sign-ins": that is how each
-- browser gets private saved games (rooms below do not need sign-in).

-- ---------- saved games and profile ----------

create table if not exists public.kv (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  key        text        not null,   -- 'cuzi-profile' or 'cuzi-save:<world seed>'
  value      jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.kv enable row level security;

drop policy if exists "kv: read own rows" on public.kv;
drop policy if exists "kv: insert own rows" on public.kv;
drop policy if exists "kv: update own rows" on public.kv;
drop policy if exists "kv: delete own rows" on public.kv;
create policy "kv: read own rows"   on public.kv for select using (auth.uid() = user_id);
create policy "kv: insert own rows" on public.kv for insert with check (auth.uid() = user_id);
create policy "kv: update own rows" on public.kv for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "kv: delete own rows" on public.kv for delete using (auth.uid() = user_id);

-- ---------- multiplayer rooms (the lobby list) ----------
-- Only the list of open rooms lives here. Everything that happens inside a room (positions, hits, scores)
-- travels over Realtime channels named cuzy-room-<code>, which need no table.
-- A room is a row the host keeps fresh every 15 seconds; rows nobody has touched for a minute are not shown.

create table if not exists public.rooms (
  code            text primary key,
  name            text        not null,
  seed            text        not null,
  max             int         not null default 4,
  pvp             boolean     not null default true,
  mode            text        not null default 'free',      -- free | waves | survival
  difficulty      text        not null default 'medium',
  win_by          text        not null default 'duel',      -- duel | monsters
  target          int         not null default 10,
  allow_late      boolean     not null default true,
  allow_throw     boolean     not null default true,
  allow_melee     boolean     not null default true,
  streak_monsters boolean     not null default false,
  teams           int         not null default 0,           -- 0 = free for all, otherwise 2-4 teams
  started         boolean     not null default false,
  host_id         text        not null,
  host_name       text        not null default 'Friend',
  count           int         not null default 1,
  t0              bigint      not null default 0,           -- when the round clock started (ms since 1970)
  start_hour      real        not null default 8,
  updated_at      timestamptz not null default now()
);

-- for rooms tables created before teams existed
alter table public.rooms add column if not exists teams int not null default 0;

alter table public.rooms enable row level security;

-- Anyone holding the game's public key can list, open, tweak and close rooms. That is fine for a friends-and-family
-- game; tighten it (for example with sign-in) before running anything more serious.
drop policy if exists "rooms: open to the game" on public.rooms;
create policy "rooms: open to the game" on public.rooms for all to anon, authenticated using (true) with check (true);
