-- Aetheria RPG — initial Supabase schema.
-- Apply with: supabase db push (after linking your own Supabase project).
-- Character progression is server-authoritative: browser clients cannot UPDATE
-- level or experience. Trusted game-server code must use a server-only key.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Aventureiro'
    check (char_length(display_name) between 2 and 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Aventureiro'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 3 and 24),
  class_key text not null check (class_key in ('warrior', 'archer', 'mage', 'dwarf')),
  level smallint not null default 1 check (level between 1 and 80),
  experience bigint not null default 0 check (experience >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists characters_name_lower_unique
  on public.characters (lower(name));

alter table public.profiles enable row level security;
alter table public.characters enable row level security;

drop policy if exists "Profiles are readable by their owner" on public.profiles;
create policy "Profiles are readable by their owner"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Owners can update their profile" on public.profiles;
create policy "Owners can update their profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Owners can read their characters" on public.characters;
create policy "Owners can read their characters"
  on public.characters for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can create level-one characters" on public.characters;
create policy "Owners can create level-one characters"
  on public.characters for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and level = 1
    and experience = 0
  );

drop policy if exists "Owners can delete their characters" on public.characters;
create policy "Owners can delete their characters"
  on public.characters for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

-- Explicit grants: no browser-side UPDATE of character progression.
revoke all on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;
revoke all on public.characters from anon, authenticated;
grant select, insert, delete on public.characters to authenticated;
