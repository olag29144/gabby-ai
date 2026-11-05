-- ============================================================
-- Nova AI — Supabase Schema
-- ============================================================
-- Run this in Supabase SQL Editor or via the API.
-- Uses Supabase Auth (auth.users) as the identity source.
-- RLS is enabled on all tables so users can only access their own data.
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";   -- for fast text search

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Public profile data, mirrors auth.users
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  display_name text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── user_preferences ─────────────────────────────────────────────────────────
create table if not exists public.user_preferences (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  theme         text not null default 'dark' check (theme in ('dark','light','system')),
  default_model text not null default 'groq/qwen/qwen3.8-27b',
  sidebar_open  boolean not null default true,
  updated_at    timestamptz not null default now()
);

-- ── conversations ─────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null default 'New conversation',
  model       text not null default 'groq/qwen/qwen3.8-27b',
  pinned      boolean not null default false,
  is_notebook boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists conversations_user_id_idx on public.conversations(user_id);
create index if not exists conversations_updated_at_idx on public.conversations(updated_at desc);

-- ── messages ──────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null default '',
  status          text not null default 'done' check (status in ('sending','streaming','done','error')),
  error           text,
  attachments     jsonb not null default '[]',
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on public.messages(conversation_id);
create index if not exists messages_created_at_idx on public.messages(created_at);
-- Full-text search across message content
create index if not exists messages_content_trgm_idx on public.messages using gin (content gin_trgm_ops);

-- ── Auto-update conversations.updated_at when a message is inserted ───────────
create or replace function public.update_conversation_timestamp()
returns trigger language plpgsql as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_inserted on public.messages;
create trigger on_message_inserted
  after insert on public.messages
  for each row execute procedure public.update_conversation_timestamp();

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.user_preferences  enable row level security;
alter table public.conversations      enable row level security;
alter table public.messages           enable row level security;

-- profiles: users can read/update their own profile
drop policy if exists "profiles: own read"   on public.profiles;
drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

-- user_preferences: users can read/write their own prefs
drop policy if exists "prefs: own all" on public.user_preferences;
create policy "prefs: own all" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- conversations: users can CRUD their own
drop policy if exists "conversations: own all" on public.conversations;
create policy "conversations: own all" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- messages: users can CRUD their own
drop policy if exists "messages: own all" on public.messages;
create policy "messages: own all" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Helpful views ─────────────────────────────────────────────────────────────
-- conversations with message count and last message snippet
create or replace view public.conversations_with_stats as
select
  c.*,
  count(m.id)::int                                      as message_count,
  max(m.created_at)                                     as last_message_at,
  (select content from public.messages
   where conversation_id = c.id
   order by created_at desc limit 1)                    as last_message_preview
from public.conversations c
left join public.messages m on m.conversation_id = c.id
group by c.id;
