-- BUGOUT Mentor OS V2 schema
-- Run once in the Supabase SQL Editor.
-- This replaces the old AI Teacher Pro lesson/quiz model with adaptive
-- diagnostics, durable learner memory, skill graphs, events, and boss battles.

create extension if not exists vector;

create table if not exists public.teacher_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weak_topics text[] not null default '{}',
  strong_topics text[] not null default '{}',
  misconceptions text[] not null default '{}',
  repeated_mistakes text[] not null default '{}',
  skipped_concepts text[] not null default '{}',
  preferred_teaching_style text not null default 'visual + direct',
  learning_speed text not null default 'normal',
  study_streak integer not null default 0,
  xp integer not null default 0,
  confidence_trend jsonb not null default '[]'::jsonb,
  attention_pattern jsonb not null default '{}'::jsonb,
  learning_dna jsonb not null default '{}'::jsonb,
  memory_graph jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.teacher_memory add column if not exists misconceptions text[] not null default '{}';
alter table public.teacher_memory add column if not exists repeated_mistakes text[] not null default '{}';
alter table public.teacher_memory add column if not exists skipped_concepts text[] not null default '{}';
alter table public.teacher_memory add column if not exists xp integer not null default 0;
alter table public.teacher_memory add column if not exists confidence_trend jsonb not null default '[]'::jsonb;
alter table public.teacher_memory add column if not exists attention_pattern jsonb not null default '{}'::jsonb;
alter table public.teacher_memory add column if not exists learning_dna jsonb not null default '{}'::jsonb;
alter table public.teacher_memory add column if not exists memory_graph jsonb not null default '[]'::jsonb;

create table if not exists public.teacher_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  topic text not null,
  session_type text not null default 'lesson',
  content text,
  mastery integer not null default 0 check (mastery >= 0 and mastery <= 100),
  confidence integer not null default 0 check (confidence >= 0 and confidence <= 100),
  diagnostic_json jsonb not null default '{}'::jsonb,
  roadmap_json jsonb not null default '[]'::jsonb,
  memory_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.teacher_sessions add column if not exists mastery integer not null default 0;
alter table public.teacher_sessions add column if not exists confidence integer not null default 0;
alter table public.teacher_sessions add column if not exists diagnostic_json jsonb not null default '{}'::jsonb;
alter table public.teacher_sessions add column if not exists roadmap_json jsonb not null default '[]'::jsonb;
alter table public.teacher_sessions add column if not exists memory_snapshot jsonb not null default '{}'::jsonb;

create table if not exists public.teacher_skill_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  node_key text not null,
  title text not null,
  mastery integer not null default 0 check (mastery >= 0 and mastery <= 100),
  confidence integer not null default 0 check (confidence >= 0 and confidence <= 100),
  difficulty text not null default 'Foundation',
  revision_need text not null default 'Medium',
  status text not null default 'active',
  evidence jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, topic, node_key)
);

create table if not exists public.teacher_learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.teacher_sessions(id) on delete set null,
  topic text,
  event_type text not null,
  signal text,
  score integer,
  confidence integer,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_boss_battles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  score integer not null default 0,
  rating text,
  time_limit_seconds integer not null default 90,
  answers jsonb not null default '[]'::jsonb,
  memory_delta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  file_name text not null,
  file_type text,
  storage_path text,
  status text not null default 'uploaded',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.teacher_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  page_number integer,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists public.teacher_memory_vectors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_type text not null,
  topic text,
  content text not null,
  importance integer not null default 5 check (importance >= 1 and importance <= 10),
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Compatibility table for older saved rows. The V2 app writes teacher_sessions,
-- but keeping this table prevents older clients from breaking during rollout.
create table if not exists public.teacher_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null,
  level text not null default 'Adaptive',
  mode text not null default 'Mentor OS',
  topic text not null,
  score integer not null default 0 check (score >= 0 and score <= 100),
  lesson_json jsonb not null default '{}'::jsonb,
  quiz_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, language, topic)
);

create index if not exists teacher_sessions_user_created_idx
on public.teacher_sessions (user_id, created_at desc);

create index if not exists teacher_skill_nodes_user_topic_idx
on public.teacher_skill_nodes (user_id, topic);

create index if not exists teacher_learning_events_user_created_idx
on public.teacher_learning_events (user_id, created_at desc);

create index if not exists teacher_document_chunks_embedding_idx
on public.teacher_document_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create index if not exists teacher_memory_vectors_embedding_idx
on public.teacher_memory_vectors using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

alter table public.teacher_memory enable row level security;
alter table public.teacher_sessions enable row level security;
alter table public.teacher_skill_nodes enable row level security;
alter table public.teacher_learning_events enable row level security;
alter table public.teacher_boss_battles enable row level security;
alter table public.teacher_documents enable row level security;
alter table public.teacher_document_chunks enable row level security;
alter table public.teacher_memory_vectors enable row level security;
alter table public.teacher_progress enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'teacher_memory',
    'teacher_sessions',
    'teacher_skill_nodes',
    'teacher_learning_events',
    'teacher_boss_battles',
    'teacher_documents',
    'teacher_document_chunks',
    'teacher_memory_vectors',
    'teacher_progress'
  ] loop
    execute format('drop policy if exists "Users manage own %I" on public.%I', t, t);
    execute format('create policy "Users manage own %I" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;

create or replace function public.match_teacher_document_chunks(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int default 8
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  page_number integer,
  similarity float
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.page_number,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.teacher_document_chunks c
  where c.user_id = match_user_id
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_teacher_memory_vectors(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int default 12
)
returns table (
  id uuid,
  memory_type text,
  topic text,
  content text,
  importance integer,
  similarity float
)
language sql
stable
as $$
  select
    m.id,
    m.memory_type,
    m.topic,
    m.content,
    m.importance,
    1 - (m.embedding <=> query_embedding) as similarity
  from public.teacher_memory_vectors m
  where m.user_id = match_user_id
    and m.embedding is not null
  order by (m.embedding <=> query_embedding), m.importance desc
  limit match_count;
$$;

notify pgrst, 'reload schema';
