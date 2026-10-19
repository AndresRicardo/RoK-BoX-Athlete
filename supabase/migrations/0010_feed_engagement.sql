-- FASE 13: Engagement del feed - likes y comentarios
-- Ejecutar en Supabase Studio SQL Editor
--
--   1) feed_likes: un like por usuario por evento
--   2) feed_comments: comentarios con borrado por autor o dueño del evento
--
-- Visibilidad: solo puedes likear/comentar eventos que puedes ver
-- (tuyos o de quienes sigues). Los contadores son lectura publica
-- para autenticados, igual que el grafo de follows.

-- ============================================================
-- 1) FEED_LIKES
-- ============================================================

create table if not exists public.feed_likes (
  event_id uuid not null references public.feed_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists feed_likes_user_idx on public.feed_likes(user_id);

alter table public.feed_likes enable row level security;

drop policy if exists "Authenticated read feed_likes" on public.feed_likes;
create policy "Authenticated read feed_likes"
  on public.feed_likes for select
  using (auth.role() = 'authenticated');

drop policy if exists "Users insert own feed_likes" on public.feed_likes;
create policy "Users insert own feed_likes"
  on public.feed_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.feed_events e
      where e.id = event_id
        and (
          e.user_id = auth.uid()
          or exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid() and f.followed_id = e.user_id
          )
        )
    )
  );

drop policy if exists "Users delete own feed_likes" on public.feed_likes;
create policy "Users delete own feed_likes"
  on public.feed_likes for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 2) FEED_COMMENTS
-- ============================================================

create table if not exists public.feed_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.feed_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists feed_comments_event_idx
  on public.feed_comments(event_id, created_at);

alter table public.feed_comments enable row level security;

drop policy if exists "Authenticated read feed_comments" on public.feed_comments;
create policy "Authenticated read feed_comments"
  on public.feed_comments for select
  using (auth.role() = 'authenticated');

drop policy if exists "Users insert own feed_comments" on public.feed_comments;
create policy "Users insert own feed_comments"
  on public.feed_comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.feed_events e
      where e.id = event_id
        and (
          e.user_id = auth.uid()
          or exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid() and f.followed_id = e.user_id
          )
        )
    )
  );

-- Borra el autor del comentario o el dueño del evento (moderacion estilo IG)
drop policy if exists "Delete own or on own events feed_comments" on public.feed_comments;
create policy "Delete own or on own events feed_comments"
  on public.feed_comments for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.feed_events e
      where e.id = event_id and e.user_id = auth.uid()
    )
  );
