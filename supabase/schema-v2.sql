-- ============================================================
-- Gabby AI — Schema v2
-- Developer identity, roles, memories, audit logs
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING)
-- ============================================================

-- ── Extensions ────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ── user_roles ────────────────────────────────────────────
create table if not exists public.user_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'user'
                check (role in ('user','admin','owner')),
  granted_by  uuid references auth.users(id),
  granted_at  timestamptz not null default now()
);
alter table public.user_roles enable row level security;

drop policy if exists "roles: owner read all"  on public.user_roles;
drop policy if exists "roles: own read"         on public.user_roles;
create policy "roles: own read" on public.user_roles
  for select using (auth.uid() = user_id);
create policy "roles: owner read all" on public.user_roles
  for select using (
    exists (
      select 1 from public.user_roles r2
      where r2.user_id = auth.uid() and r2.role = 'owner'
    )
  );

-- ── developer_profiles ────────────────────────────────────
create table if not exists public.developer_profiles (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid unique not null references auth.users(id) on delete cascade,
  developer_id    uuid unique not null default uuid_generate_v4(),
  full_name       text not null,
  role            text not null default 'owner',
  access_level    text not null default 'super_admin',
  app_name        text not null default 'Gabby AI',
  is_verified     boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.developer_profiles enable row level security;

drop policy if exists "devprofile: owner read" on public.developer_profiles;
create policy "devprofile: owner read" on public.developer_profiles
  for select using (
    auth.uid() = user_id or
    exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'owner')
  );

-- ── memories ──────────────────────────────────────────────
create table if not exists public.memories (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  content         text not null,
  category        text not null default 'general'
                    check (category in ('general','preference','project','identity','system','developer')),
  importance      integer not null default 1 check (importance between 1 and 5),
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists memories_user_id_idx       on public.memories(user_id);
create index if not exists memories_category_idx      on public.memories(category);
create index if not exists memories_importance_idx    on public.memories(importance desc);
create index if not exists memories_content_trgm_idx  on public.memories using gin (content gin_trgm_ops);

alter table public.memories enable row level security;
drop policy if exists "memories: own all" on public.memories;
create policy "memories: own all" on public.memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── audit_logs ────────────────────────────────────────────
create table if not exists public.audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete set null,
  action      text not null,
  resource    text,
  details     jsonb default '{}',
  ip_address  text,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_user_id_idx   on public.audit_logs(user_id);
create index if not exists audit_logs_action_idx    on public.audit_logs(action);
create index if not exists audit_logs_created_idx   on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;
drop policy if exists "audit: owner read all" on public.audit_logs;
create policy "audit: owner read all" on public.audit_logs
  for select using (
    exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'owner')
  );

-- ── app_identity ──────────────────────────────────────────
-- Stores the permanent identity of Gabby AI itself
create table if not exists public.app_identity (
  id            uuid primary key default uuid_generate_v4(),
  app_name      text not null default 'Gabby AI',
  creator_name  text not null default 'Ola Gabriel',
  creator_role  text not null default 'Original Creator & Lead Developer',
  version       text not null default '1.0.0',
  description   text not null default 'An intelligent AI assistant built by Ola Gabriel.',
  system_prompt text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Only one row ever
insert into public.app_identity (app_name, creator_name, creator_role, description, system_prompt)
values (
  'Gabby AI',
  'Ola Gabriel',
  'Original Creator & Lead Developer',
  'An intelligent AI assistant built by Ola Gabriel.',
  'You are Gabby AI, an intelligent assistant created by Ola Gabriel. Your purpose is to be helpful, accurate, and honest. You were built with care by Ola Gabriel (Original Creator & Lead Developer). Always identify yourself as Gabby AI, not by the name of any underlying AI model or provider. The person using you right now is the authenticated user — treat them with respect.'
) on conflict do nothing;

alter table public.app_identity enable row level security;
drop policy if exists "appid: all read" on public.app_identity;
create policy "appid: all read" on public.app_identity for select using (true);
drop policy if exists "appid: owner update" on public.app_identity;
create policy "appid: owner update" on public.app_identity
  for update using (
    exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'owner')
  );

-- ── Update trigger for memories ───────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists memories_updated_at on public.memories;
create trigger memories_updated_at
  before update on public.memories
  for each row execute procedure public.set_updated_at();

drop trigger if exists developer_profiles_updated_at on public.developer_profiles;
create trigger developer_profiles_updated_at
  before update on public.developer_profiles
  for each row execute procedure public.set_updated_at();
