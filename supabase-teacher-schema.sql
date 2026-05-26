-- BUGOUT AI Teacher Pro schema
-- Run once in the Supabase SQL Editor.

create extension if not exists vector;

create table if not exists public.teacher_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null,
  level text not null default 'Beginner',
  mode text not null default 'Step-by-Step Mode',
  topic text not null,
  score integer not null default 0 check (score >= 0 and score <= 100),
  lesson_json jsonb not null default '{}'::jsonb,
  quiz_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, language, topic)
);

create table if not exists public.teacher_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weak_topics text[] not null default '{}',
  strong_topics text[] not null default '{}',
  preferred_teaching_style text not null default 'friendly mentor',
  learning_speed text not null default 'normal',
  study_streak integer not null default 0,
  confidence jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.teacher_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  topic text,
  mode text,
  exam_mode text,
  session_type text not null default 'lesson',
  content text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.teacher_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  attachments jsonb not null default '[]'::jsonb,
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

create index if not exists teacher_document_chunks_embedding_idx
on public.teacher_document_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create table if not exists public.teacher_quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  topic text not null,
  difficulty text not null default 'Medium',
  questions jsonb not null default '[]'::jsonb,
  score integer,
  time_limit_seconds integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.teacher_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  title text not null,
  description text,
  xp integer not null default 0,
  earned_at timestamptz not null default now(),
  unique (user_id, code)
);

create table if not exists public.teacher_whiteboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'AI Teacher Whiteboard',
  canvas_data jsonb not null default '{}'::jsonb,
  image_url text,
  is_collaborative boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_classrooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text,
  live_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_classroom_members (
  classroom_id uuid not null references public.teacher_classrooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('teacher','student')),
  joined_at timestamptz not null default now(),
  primary key (classroom_id, user_id)
);

alter table public.teacher_progress enable row level security;
alter table public.teacher_memory enable row level security;
alter table public.teacher_sessions enable row level security;
alter table public.teacher_messages enable row level security;
alter table public.teacher_documents enable row level security;
alter table public.teacher_document_chunks enable row level security;
alter table public.teacher_quizzes enable row level security;
alter table public.teacher_achievements enable row level security;
alter table public.teacher_whiteboards enable row level security;
alter table public.teacher_classrooms enable row level security;
alter table public.teacher_classroom_members enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'teacher_progress',
    'teacher_memory',
    'teacher_sessions',
    'teacher_messages',
    'teacher_documents',
    'teacher_document_chunks',
    'teacher_quizzes',
    'teacher_achievements',
    'teacher_whiteboards'
  ] loop
    execute format('drop policy if exists "Users manage own %I" on public.%I', t, t);
    execute format('create policy "Users manage own %I" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;

drop policy if exists "Classroom owners can manage classrooms" on public.teacher_classrooms;
create policy "Classroom owners can manage classrooms"
on public.teacher_classrooms
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Classroom members can read classrooms" on public.teacher_classrooms;
create policy "Classroom members can read classrooms"
on public.teacher_classrooms
for select
using (
  auth.uid() = owner_id
  or exists (
    select 1 from public.teacher_classroom_members m
    where m.classroom_id = teacher_classrooms.id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "Classroom members manage own membership" on public.teacher_classroom_members;
create policy "Classroom members manage own membership"
on public.teacher_classroom_members
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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

notify pgrst, 'reload schema';
