-- BUGOUT OS V3 schema
-- Additive schema for the unified Learn / Practice / Build / Career product model.
-- Run in Supabase SQL Editor after the existing arena, missions, admin, and teacher schemas.

create extension if not exists vector;

create table if not exists public.student_growth_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  branch text,
  semester text,
  interests text[] not null default '{}',
  goals text[] not null default '{}',
  strengths text[] not null default '{}',
  weak_areas text[] not null default '{}',
  preferred_learning_style text not null default 'adaptive',
  target_role text,
  target_exam text,
  weekly_hours integer not null default 6,
  global_level integer not null default 1,
  learning_xp integer not null default 0,
  practice_xp integer not null default 0,
  build_xp integer not null default 0,
  career_xp integer not null default 0,
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  profile_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.os_memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pillar text not null check (pillar in ('learn','practice','build','career','community')),
  capability text not null,
  topic text,
  memory_type text not null,
  content text not null,
  confidence integer not null default 50 check (confidence between 0 and 100),
  importance integer not null default 5 check (importance between 1 and 10),
  embedding vector(1536),
  source_table text,
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.os_xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pillar text not null check (pillar in ('learn','practice','build','career','community')),
  amount integer not null,
  reason text not null,
  source_table text,
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.os_learning_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  topic text not null,
  mode text not null default 'Teacher',
  mastery integer not null default 0 check (mastery between 0 and 100),
  confidence integer not null default 0 check (confidence between 0 and 100),
  weak_signals text[] not null default '{}',
  strong_signals text[] not null default '{}',
  lesson_ref uuid,
  next_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.os_practice_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_type text not null default 'coding',
  topic text,
  difficulty text,
  score integer not null default 0 check (score between 0 and 100),
  runtime_ms integer,
  complexity text,
  analyzer_report jsonb not null default '{}'::jsonb,
  routed_to_teacher boolean not null default false,
  source_submission_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.os_project_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid,
  title text not null,
  status text not null default 'planned',
  role text,
  stack text[] not null default '{}',
  deliverables jsonb not null default '[]'::jsonb,
  grading_json jsonb not null default '{}'::jsonb,
  collaboration_json jsonb not null default '{}'::jsonb,
  portfolio_ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.os_career_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null check (asset_type in ('resume','portfolio','certificate','interview_plan','cover_letter')),
  title text not null,
  content text,
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  source_refs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.os_interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text,
  interview_type text not null default 'technical',
  readiness_before integer not null default 0 check (readiness_before between 0 and 100),
  readiness_after integer not null default 0 check (readiness_after between 0 and 100),
  transcript text,
  rubric_json jsonb not null default '{}'::jsonb,
  next_drills jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.os_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  pillar text not null,
  title text not null,
  description text,
  level integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  earned_at timestamptz not null default now(),
  unique (user_id, achievement_key)
);

create table if not exists public.os_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  pillar text,
  source_table text,
  source_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists student_growth_profiles_updated_idx on public.student_growth_profiles (updated_at desc);
create index if not exists os_memory_items_user_pillar_idx on public.os_memory_items (user_id, pillar, created_at desc);
create index if not exists os_memory_items_embedding_idx on public.os_memory_items using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists os_xp_ledger_user_created_idx on public.os_xp_ledger (user_id, created_at desc);
create index if not exists os_learning_records_user_created_idx on public.os_learning_records (user_id, created_at desc);
create index if not exists os_practice_records_user_created_idx on public.os_practice_records (user_id, created_at desc);
create index if not exists os_project_records_user_status_idx on public.os_project_records (user_id, status);
create index if not exists os_career_assets_user_type_idx on public.os_career_assets (user_id, asset_type, updated_at desc);
create index if not exists os_events_user_created_idx on public.os_events (user_id, created_at desc);

alter table public.student_growth_profiles enable row level security;
alter table public.os_memory_items enable row level security;
alter table public.os_xp_ledger enable row level security;
alter table public.os_learning_records enable row level security;
alter table public.os_practice_records enable row level security;
alter table public.os_project_records enable row level security;
alter table public.os_career_assets enable row level security;
alter table public.os_interview_sessions enable row level security;
alter table public.os_achievements enable row level security;
alter table public.os_events enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'student_growth_profiles',
    'os_memory_items',
    'os_xp_ledger',
    'os_learning_records',
    'os_practice_records',
    'os_project_records',
    'os_career_assets',
    'os_interview_sessions',
    'os_achievements'
  ] loop
    execute format('drop policy if exists "Users manage own %I" on public.%I', t, t);
    execute format('create policy "Users manage own %I" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;

drop policy if exists "Users read own os events" on public.os_events;
create policy "Users read own os events"
on public.os_events for select
using (auth.uid() = user_id or user_id is null);

drop policy if exists "Users create own os events" on public.os_events;
create policy "Users create own os events"
on public.os_events for insert
with check (auth.uid() = user_id or user_id is null);

create or replace function public.match_os_memory_items(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int default 12
)
returns table (
  id uuid,
  pillar text,
  capability text,
  topic text,
  memory_type text,
  content text,
  importance integer,
  similarity float
)
language sql
stable
as $$
  select
    m.id,
    m.pillar,
    m.capability,
    m.topic,
    m.memory_type,
    m.content,
    m.importance,
    1 - (m.embedding <=> query_embedding) as similarity
  from public.os_memory_items m
  where m.user_id = match_user_id
    and m.embedding is not null
  order by (m.embedding <=> query_embedding), m.importance desc
  limit match_count;
$$;

notify pgrst, 'reload schema';
