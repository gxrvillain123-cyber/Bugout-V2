create table if not exists public.coding_problems (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null,
  problem_number integer not null default 0,
  title text not null default '',
  description text not null default '',
  difficulty text default 'Easy',
  example_input text,
  example_output text,
  generated_at timestamptz default now()
);

alter table public.coding_problems
add column if not exists batch_id text,
add column if not exists problem_number integer default 0,
add column if not exists title text default '',
add column if not exists description text default '',
add column if not exists difficulty text default 'Easy',
add column if not exists example_input text,
add column if not exists example_output text,
add column if not exists generated_at timestamptz default now();

alter table public.coding_problems
alter column problem_number set default 0,
alter column title set default '',
alter column description set default '';

create table if not exists public.problem_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  problem_id uuid not null,
  solution_code text,
  is_correct boolean default false,
  xp_awarded integer default 0,
  created_at timestamptz default now()
);

alter table public.problem_submissions
add column if not exists user_id uuid,
add column if not exists problem_id uuid,
add column if not exists solution_code text,
add column if not exists is_correct boolean default false,
add column if not exists xp_awarded integer default 0,
add column if not exists created_at timestamptz default now();

create unique index if not exists one_correct_arena_submission_per_user
on public.problem_submissions (user_id, problem_id)
where is_correct = true;

notify pgrst, 'reload schema';
