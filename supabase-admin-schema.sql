-- BUGOUT admin role setup
-- Run this once in the Supabase SQL Editor, then replace the email below
-- with the account that should be promoted to admin.

alter table public.profiles
add column if not exists role text not null default 'user';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_role_check
    check (role in ('user', 'admin'));
  end if;
end $$;

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

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.role <> 'user'
       and auth.uid() is not null
       and not public.is_admin(auth.uid()) then
      raise exception 'Only admins can create admin profiles';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role
       and auth.uid() is not null
       and not public.is_admin(auth.uid()) then
      raise exception 'Only admins can change profile roles';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation
before insert or update on public.profiles
for each row
execute function public.prevent_profile_role_escalation();

-- Promote your account. Replace the email before running.
update public.profiles p
set role = 'admin'
from auth.users u
where p.user_id = u.id
  and lower(u.email) = lower('YOUR_EMAIL_HERE');

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bugs'
      and policyname = 'Admins can update any bug'
  ) then
    create policy "Admins can update any bug"
    on public.bugs
    for update
    using (public.is_admin())
    with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bugs'
      and policyname = 'Admins can delete any bug'
  ) then
    create policy "Admins can delete any bug"
    on public.bugs
    for delete
    using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'solutions'
      and policyname = 'Admins can update any solution'
  ) then
    create policy "Admins can update any solution"
    on public.solutions
    for update
    using (public.is_admin())
    with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'solutions'
      and policyname = 'Admins can delete any solution'
  ) then
    create policy "Admins can delete any solution"
    on public.solutions
    for delete
    using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bookmarks'
      and policyname = 'Admins can delete bug bookmarks'
  ) then
    create policy "Admins can delete bug bookmarks"
    on public.bookmarks
    for delete
    using (public.is_admin());
  end if;
end $$;

notify pgrst, 'reload schema';
