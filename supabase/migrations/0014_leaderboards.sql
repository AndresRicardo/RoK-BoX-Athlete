-- FASE 16: Tableros de líderes
--
-- Los datos de PRs y benchmarks siguen siendo privados en sus tablas de
-- origen. Estas funciones solo devuelven el mejor resultado de cada atleta
-- junto con las columnas públicas necesarias para el tablero.

create index if not exists prs_leaderboard_idx
  on public.prs(movement, type, user_id, value_numeric);

create index if not exists benchmarks_leaderboard_idx
  on public.benchmarks(name, type, scaling, user_id, result_value);

drop function if exists public.get_pr_leaderboard(text, text, text, integer);
create or replace function public.get_pr_leaderboard(
  p_scope text default 'global',
  p_movement text default null,
  p_type text default null,
  p_limit integer default 10
)
returns table (
  movement text,
  type text,
  rank bigint,
  athlete_id uuid,
  display_name text,
  full_name text,
  avatar_url text,
  value_numeric numeric,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with visible_prs as (
    select p.*
    from public.prs p
    where coalesce(p_scope, 'global') in ('global', 'following')
      and (
        coalesce(p_scope, 'global') = 'global'
        or p.user_id = auth.uid()
        or exists (
          select 1
          from public.follows f
          where f.follower_id = auth.uid()
            and f.followed_id = p.user_id
        )
      )
      and (p_movement is null or p.movement = p_movement)
      and (p_type is null or p.type = p_type)
  ),
  best_prs as (
    select distinct on (p.user_id, p.movement, p.type)
      p.user_id,
      p.movement,
      p.type,
      p.value_numeric
    from visible_prs p
    order by
      p.user_id,
      p.movement,
      p.type,
      case when p.type = 'benchmark' then p.value_numeric end asc nulls last,
      case when p.type <> 'benchmark' then p.value_numeric end desc nulls last,
      p.achieved_at desc,
      p.created_at desc,
      p.id
  ),
  ranked_prs as (
    select
      p.*,
      rank() over (
        partition by p.movement, p.type
        order by
          case when p.type = 'benchmark' then p.value_numeric end asc nulls last,
          case when p.type <> 'benchmark' then p.value_numeric end desc nulls last
      ) as rank_position,
      count(*) over (partition by p.movement, p.type) as category_count
    from best_prs p
  )
  select
    p.movement,
    p.type,
    p.rank_position as rank,
    d.id as athlete_id,
    d.display_name,
    d.full_name,
    d.avatar_url,
    p.value_numeric,
    p.category_count as total_count
  from ranked_prs p
  join public.athlete_directory d on d.id = p.user_id
  where p.rank_position <= least(greatest(coalesce(p_limit, 10), 1), 100)
  order by p.movement, p.type, p.rank_position, d.full_name, d.display_name;
$$;

drop function if exists public.get_benchmark_leaderboard(text, text, text, text, text, integer);
create or replace function public.get_benchmark_leaderboard(
  p_scope text default 'global',
  p_name text default null,
  p_type text default null,
  p_scaling text default null,
  p_result_unit text default null,
  p_limit integer default 10
)
returns table (
  name text,
  type text,
  scaling text,
  result_unit text,
  rank bigint,
  athlete_id uuid,
  display_name text,
  full_name text,
  avatar_url text,
  result_value numeric,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with visible_benchmarks as (
    select b.*
    from public.benchmarks b
    where coalesce(p_scope, 'global') in ('global', 'following')
      and (
        coalesce(p_scope, 'global') = 'global'
        or b.user_id = auth.uid()
        or exists (
          select 1
          from public.follows f
          where f.follower_id = auth.uid()
            and f.followed_id = b.user_id
        )
      )
      and (p_name is null or b.name = p_name)
      and (p_type is null or b.type = p_type)
      and (p_scaling is null or b.scaling = p_scaling)
      and (p_result_unit is null or b.result_unit = p_result_unit)
  ),
  best_benchmarks as (
    select distinct on (b.user_id, b.name, b.type, b.scaling, b.result_unit)
      b.user_id,
      b.name,
      b.type,
      b.scaling,
      b.result_unit,
      b.result_value
    from visible_benchmarks b
    order by
      b.user_id,
      b.name,
      b.type,
      b.scaling,
      b.result_unit,
      case when b.result_unit = 'time_seconds' then b.result_value end asc nulls last,
      case when b.result_unit <> 'time_seconds' then b.result_value end desc nulls last,
      b.performed_at desc,
      b.created_at desc,
      b.id
  ),
  ranked_benchmarks as (
    select
      b.*,
      rank() over (
        partition by b.name, b.type, b.scaling, b.result_unit
        order by
          case when b.result_unit = 'time_seconds' then b.result_value end asc nulls last,
          case when b.result_unit <> 'time_seconds' then b.result_value end desc nulls last
      ) as rank_position,
      count(*) over (partition by b.name, b.type, b.scaling, b.result_unit) as category_count
    from best_benchmarks b
  )
  select
    b.name,
    b.type,
    b.scaling,
    b.result_unit,
    b.rank_position as rank,
    d.id as athlete_id,
    d.display_name,
    d.full_name,
    d.avatar_url,
    b.result_value,
    b.category_count as total_count
  from ranked_benchmarks b
  join public.athlete_directory d on d.id = b.user_id
  where b.rank_position <= least(greatest(coalesce(p_limit, 10), 1), 100)
  order by b.name, b.type, b.scaling, b.result_unit, b.rank_position, d.full_name, d.display_name;
$$;

revoke all on function public.get_pr_leaderboard(text, text, text, integer) from public;
grant execute on function public.get_pr_leaderboard(text, text, text, integer) to authenticated;

revoke all on function public.get_benchmark_leaderboard(text, text, text, text, text, integer) from public;
grant execute on function public.get_benchmark_leaderboard(text, text, text, text, text, integer) to authenticated;
