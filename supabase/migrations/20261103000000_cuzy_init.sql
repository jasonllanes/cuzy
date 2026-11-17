-- Cuzy's cloud storage. Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- It is safe to run again. The same SQL lives in supabase/migrations/ for the Supabase CLI (`supabase db push`);
-- keep the two in step.
--
-- Dashboard switches the game relies on (Authentication):
--   * Sign In / Providers -> Google: ON, with your Google client ID and secret
--       (Google accounts keep their name, character and saved games in the kv table below; guests keep them in the browser only)
--   * Sign In / Providers -> "Allow manual linking": ON   (only so a browser that used an older, anonymous version keeps its
--       saves when it signs in with Google; "Allow anonymous sign-ins" is no longer needed)
--   * URL Configuration: Site URL and Redirect URLs include the game's address, e.g.
--       https://jasonllanes.github.io/cuzy/   and   http://localhost:5173/
-- No extra tables are needed for Google: the kv rows belong to auth.uid().
-- (Rooms below do not need sign-in.)

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

-- ---------- player feedback (bugs, features, suggestions) ----------
-- Anyone can SEND feedback; nobody can read it with the public key. The developer reads it through the functions below,
-- which need a secret read key: run   insert into public.feedback_admin (k) values ('your-secret-key');   once, and keep the key private.

create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text        not null check (kind in ('feature', 'bug', 'suggestion')),
  details     text        not null check (char_length(details) between 1 and 2000),
  player      text,
  context     jsonb,
  screenshot  text        check (screenshot is null or char_length(screenshot) < 400000), -- a small compressed JPEG (data URL)
  status      text        not null default 'open'                                          -- open | done
);

alter table public.feedback enable row level security;
drop policy if exists "feedback: anyone can send" on public.feedback;
create policy "feedback: anyone can send" on public.feedback for insert to anon, authenticated with check (status = 'open');

create table if not exists public.feedback_admin (k text primary key);
alter table public.feedback_admin enable row level security; -- (no policies: only the functions below can look inside)

create or replace function public.feedback_list(p_key text, p_status text default 'open')
returns table (id bigint, created_at timestamptz, kind text, details text, player text, context jsonb, has_shot boolean, status text)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from feedback_admin a where a.k = p_key) then raise exception 'wrong key'; end if;
  return query select f.id, f.created_at, f.kind, f.details, f.player, f.context, f.screenshot is not null, f.status
    from feedback f where p_status = 'all' or f.status = p_status order by f.created_at;
end $$;

create or replace function public.feedback_shot(p_key text, p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from feedback_admin a where a.k = p_key) then raise exception 'wrong key'; end if;
  return (select f.screenshot from feedback f where f.id = p_id);
end $$;

create or replace function public.feedback_mark(p_key text, p_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from feedback_admin a where a.k = p_key) then raise exception 'wrong key'; end if;
  update feedback set status = p_status where id = p_id;
end $$;

grant execute on function public.feedback_list(text, text), public.feedback_shot(text, bigint), public.feedback_mark(text, bigint, text) to anon, authenticated;

-- ---------- leaderboards ----------
-- One row per finished run. category looks like 'surv:10:hard' (a Survival run of 10 waves on Hard: the time to clear it, lowest wins)
-- or 'endless:hard' (Endless Survival on Hard: the seconds survived, highest wins). Anyone may read the boards and add a score.

create table if not exists public.leaderboard (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  category    text        not null check (char_length(category) between 3 and 40),
  name        text        not null check (char_length(name) between 1 and 24),
  score       integer     not null check (score >= 0 and score < 10000000),
  detail      jsonb
);
create index if not exists leaderboard_category_score on public.leaderboard (category, score);

alter table public.leaderboard enable row level security;
drop policy if exists "leaderboard: anyone can read" on public.leaderboard;
drop policy if exists "leaderboard: anyone can add" on public.leaderboard;
create policy "leaderboard: anyone can read" on public.leaderboard for select to anon, authenticated using (true);
create policy "leaderboard: anyone can add" on public.leaderboard for insert to anon, authenticated with check (true);
