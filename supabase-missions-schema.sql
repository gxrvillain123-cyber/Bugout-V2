-- BUGOUT Missions setup
-- Run this once in the Supabase SQL Editor after supabase-admin-schema.sql.

create extension if not exists pgcrypto;

alter table public.profiles
add column if not exists role text not null default 'user';

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = uid
      and role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text,
  brief text,
  description text,
  category text default 'General',
  difficulty text default 'Intermediate',
  mission_type text default 'solo',
  status text default 'active',
  starts_at timestamptz default now(),
  ends_at timestamptz default (now() + interval '2 days'),
  reward_xp integer default 250,
  max_team_size integer default 4,
  rules text[] default '{}',
  deliverables text[] default '{}',
  judging_criteria jsonb default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.missions
add column if not exists title text,
add column if not exists slug text,
add column if not exists brief text,
add column if not exists description text,
add column if not exists category text default 'General',
add column if not exists difficulty text default 'Intermediate',
add column if not exists mission_type text default 'solo',
add column if not exists status text default 'active',
add column if not exists starts_at timestamptz default now(),
add column if not exists ends_at timestamptz default (now() + interval '2 days'),
add column if not exists reward_xp integer default 250,
add column if not exists max_team_size integer default 4,
add column if not exists rules text[] default '{}',
add column if not exists deliverables text[] default '{}',
add column if not exists judging_criteria jsonb default '[]'::jsonb,
add column if not exists created_by uuid,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

create table if not exists public.mission_tasks (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  title text not null,
  description text,
  xp_reward integer default 0,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table public.mission_tasks
add column if not exists mission_id uuid,
add column if not exists title text,
add column if not exists description text,
add column if not exists xp_reward integer default 0,
add column if not exists sort_order integer default 0,
add column if not exists created_at timestamptz default now();

create table if not exists public.mission_participants (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  user_id uuid not null,
  status text default 'active',
  role text default 'participant',
  xp_earned integer default 0,
  joined_at timestamptz default now()
);

alter table public.mission_participants
add column if not exists mission_id uuid,
add column if not exists user_id uuid,
add column if not exists status text default 'active',
add column if not exists role text default 'participant',
add column if not exists xp_earned integer default 0,
add column if not exists joined_at timestamptz default now();

create table if not exists public.mission_teams (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  name text not null,
  tagline text,
  created_by uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.mission_teams
add column if not exists mission_id uuid,
add column if not exists name text,
add column if not exists tagline text,
add column if not exists created_by uuid,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

create table if not exists public.mission_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.mission_teams(id) on delete cascade,
  user_id uuid not null,
  role text default 'Member',
  joined_at timestamptz default now()
);

alter table public.mission_team_members
add column if not exists team_id uuid,
add column if not exists user_id uuid,
add column if not exists role text default 'Member',
add column if not exists joined_at timestamptz default now();

create table if not exists public.mission_task_progress (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  task_id uuid not null references public.mission_tasks(id) on delete cascade,
  user_id uuid not null,
  xp_awarded integer default 0,
  completed_at timestamptz default now()
);

alter table public.mission_task_progress
add column if not exists mission_id uuid,
add column if not exists task_id uuid,
add column if not exists user_id uuid,
add column if not exists xp_awarded integer default 0,
add column if not exists completed_at timestamptz default now();

create table if not exists public.mission_submissions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  participant_id uuid references public.mission_participants(id) on delete set null,
  team_id uuid references public.mission_teams(id) on delete set null,
  submitter_user_id uuid not null,
  title text not null,
  summary text not null,
  live_url text,
  repo_url text,
  demo_url text,
  screenshots text[] default '{}',
  status text default 'submitted',
  ai_judgement jsonb,
  scores jsonb,
  score_total numeric,
  xp_awarded integer default 0,
  certificate_id text,
  featured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.mission_submissions
add column if not exists mission_id uuid,
add column if not exists participant_id uuid,
add column if not exists team_id uuid,
add column if not exists submitter_user_id uuid,
add column if not exists title text,
add column if not exists summary text,
add column if not exists live_url text,
add column if not exists repo_url text,
add column if not exists demo_url text,
add column if not exists screenshots text[] default '{}',
add column if not exists status text default 'submitted',
add column if not exists ai_judgement jsonb,
add column if not exists scores jsonb,
add column if not exists score_total numeric,
add column if not exists xp_awarded integer default 0,
add column if not exists certificate_id text,
add column if not exists featured boolean default false,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

create table if not exists public.mission_votes (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  submission_id uuid not null references public.mission_submissions(id) on delete cascade,
  user_id uuid not null,
  value integer default 1,
  created_at timestamptz default now()
);

alter table public.mission_votes
add column if not exists mission_id uuid,
add column if not exists submission_id uuid,
add column if not exists user_id uuid,
add column if not exists value integer default 1,
add column if not exists created_at timestamptz default now();

create table if not exists public.mission_certificates (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  submission_id uuid not null references public.mission_submissions(id) on delete cascade,
  user_id uuid not null,
  team_id uuid references public.mission_teams(id) on delete set null,
  certificate_id text not null,
  recipient_name text not null,
  mission_title text not null,
  score_total numeric,
  rank integer,
  issued_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);

alter table public.mission_certificates
add column if not exists mission_id uuid,
add column if not exists submission_id uuid,
add column if not exists user_id uuid,
add column if not exists team_id uuid,
add column if not exists certificate_id text,
add column if not exists recipient_name text,
add column if not exists mission_title text,
add column if not exists score_total numeric,
add column if not exists rank integer,
add column if not exists issued_at timestamptz default now(),
add column if not exists metadata jsonb default '{}'::jsonb;

create unique index if not exists missions_slug_unique_idx on public.missions(slug);
create index if not exists missions_status_dates_idx on public.missions(status, starts_at, ends_at);
create index if not exists mission_tasks_mission_sort_idx on public.mission_tasks(mission_id, sort_order);
create unique index if not exists mission_participants_unique_idx on public.mission_participants(mission_id, user_id);
create unique index if not exists mission_teams_name_unique_idx on public.mission_teams(mission_id, lower(name));
create unique index if not exists mission_team_members_unique_idx on public.mission_team_members(team_id, user_id);
create unique index if not exists mission_task_progress_unique_idx on public.mission_task_progress(task_id, user_id);
create unique index if not exists mission_submissions_solo_unique_idx on public.mission_submissions(mission_id, submitter_user_id) where team_id is null;
create unique index if not exists mission_submissions_team_unique_idx on public.mission_submissions(mission_id, team_id) where team_id is not null;
create index if not exists mission_submissions_score_idx on public.mission_submissions(mission_id, score_total desc nulls last);
create unique index if not exists mission_votes_unique_idx on public.mission_votes(submission_id, user_id);
create unique index if not exists mission_certificates_submission_unique_idx on public.mission_certificates(submission_id);
create unique index if not exists mission_certificates_certificate_unique_idx on public.mission_certificates(certificate_id);

grant usage on schema public to anon, authenticated;
grant select on public.missions, public.mission_tasks, public.mission_participants, public.mission_teams, public.mission_team_members, public.mission_task_progress, public.mission_submissions, public.mission_votes, public.mission_certificates to anon, authenticated;
grant insert, update, delete on public.missions, public.mission_tasks, public.mission_participants, public.mission_teams, public.mission_team_members, public.mission_task_progress, public.mission_submissions, public.mission_votes, public.mission_certificates to authenticated;

drop trigger if exists set_missions_updated_at on public.missions;
create trigger set_missions_updated_at
before update on public.missions
for each row execute function public.set_updated_at();

drop trigger if exists set_mission_teams_updated_at on public.mission_teams;
create trigger set_mission_teams_updated_at
before update on public.mission_teams
for each row execute function public.set_updated_at();

drop trigger if exists set_mission_submissions_updated_at on public.mission_submissions;
create trigger set_mission_submissions_updated_at
before update on public.mission_submissions
for each row execute function public.set_updated_at();

alter table public.missions enable row level security;
alter table public.mission_tasks enable row level security;
alter table public.mission_participants enable row level security;
alter table public.mission_teams enable row level security;
alter table public.mission_team_members enable row level security;
alter table public.mission_task_progress enable row level security;
alter table public.mission_submissions enable row level security;
alter table public.mission_votes enable row level security;
alter table public.mission_certificates enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'missions' and policyname = 'Anyone can read missions') then
    create policy "Anyone can read missions" on public.missions for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'missions' and policyname = 'Admins can create missions') then
    create policy "Admins can create missions" on public.missions for insert to authenticated with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'missions' and policyname = 'Admins can update missions') then
    create policy "Admins can update missions" on public.missions for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'missions' and policyname = 'Admins can delete missions') then
    create policy "Admins can delete missions" on public.missions for delete to authenticated using (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_tasks' and policyname = 'Anyone can read mission tasks') then
    create policy "Anyone can read mission tasks" on public.mission_tasks for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_tasks' and policyname = 'Admins can manage mission tasks') then
    create policy "Admins can manage mission tasks" on public.mission_tasks for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_participants' and policyname = 'Anyone can read mission participants') then
    create policy "Anyone can read mission participants" on public.mission_participants for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_participants' and policyname = 'Users can join missions') then
    create policy "Users can join missions" on public.mission_participants for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_participants' and policyname = 'Users can update own mission participant') then
    create policy "Users can update own mission participant" on public.mission_participants for update to authenticated using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_participants' and policyname = 'Users can leave missions') then
    create policy "Users can leave missions" on public.mission_participants for delete to authenticated using (auth.uid() = user_id or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_teams' and policyname = 'Anyone can read mission teams') then
    create policy "Anyone can read mission teams" on public.mission_teams for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_teams' and policyname = 'Users can create mission teams') then
    create policy "Users can create mission teams" on public.mission_teams for insert to authenticated with check (auth.uid() = created_by);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_teams' and policyname = 'Team owners can update mission teams') then
    create policy "Team owners can update mission teams" on public.mission_teams for update to authenticated using (auth.uid() = created_by or public.is_admin()) with check (auth.uid() = created_by or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_teams' and policyname = 'Team owners can delete mission teams') then
    create policy "Team owners can delete mission teams" on public.mission_teams for delete to authenticated using (auth.uid() = created_by or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_team_members' and policyname = 'Anyone can read mission team members') then
    create policy "Anyone can read mission team members" on public.mission_team_members for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_team_members' and policyname = 'Users can join mission teams') then
    create policy "Users can join mission teams" on public.mission_team_members for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_team_members' and policyname = 'Users can leave mission teams') then
    create policy "Users can leave mission teams" on public.mission_team_members for delete to authenticated using (auth.uid() = user_id or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_task_progress' and policyname = 'Anyone can read mission task progress') then
    create policy "Anyone can read mission task progress" on public.mission_task_progress for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_task_progress' and policyname = 'Users can complete mission tasks') then
    create policy "Users can complete mission tasks" on public.mission_task_progress for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_task_progress' and policyname = 'Users can uncheck mission tasks') then
    create policy "Users can uncheck mission tasks" on public.mission_task_progress for delete to authenticated using (auth.uid() = user_id or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_submissions' and policyname = 'Anyone can read mission submissions') then
    create policy "Anyone can read mission submissions" on public.mission_submissions for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_submissions' and policyname = 'Users can create mission submissions') then
    create policy "Users can create mission submissions" on public.mission_submissions for insert to authenticated with check (auth.uid() = submitter_user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_submissions' and policyname = 'Submitters can update mission submissions') then
    create policy "Submitters can update mission submissions" on public.mission_submissions for update to authenticated using (auth.uid() = submitter_user_id or public.is_admin()) with check (auth.uid() = submitter_user_id or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_submissions' and policyname = 'Submitters can delete mission submissions') then
    create policy "Submitters can delete mission submissions" on public.mission_submissions for delete to authenticated using (auth.uid() = submitter_user_id or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_votes' and policyname = 'Anyone can read mission votes') then
    create policy "Anyone can read mission votes" on public.mission_votes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_votes' and policyname = 'Users can vote mission submissions') then
    create policy "Users can vote mission submissions" on public.mission_votes for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_votes' and policyname = 'Users can remove mission votes') then
    create policy "Users can remove mission votes" on public.mission_votes for delete to authenticated using (auth.uid() = user_id or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_certificates' and policyname = 'Anyone can read mission certificates') then
    create policy "Anyone can read mission certificates" on public.mission_certificates for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_certificates' and policyname = 'Submitters can create mission certificates') then
    create policy "Submitters can create mission certificates" on public.mission_certificates for insert to authenticated with check (auth.uid() = user_id or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mission_certificates' and policyname = 'Submitters can update mission certificates') then
    create policy "Submitters can update mission certificates" on public.mission_certificates for update to authenticated using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
  end if;
end $$;

notify pgrst, 'reload schema';
