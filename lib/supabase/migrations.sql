-- Polya — Supabase schema
-- Run this in Supabase SQL editor when ready to migrate from JSON

-- ── Materials ────────────────────────────────────────────────────────────────
create table if not exists materials (
  id            text primary key,
  name          text not null,
  slug          text not null unique,
  type          text not null check (type in ('pbr','matcap','gradient','wireframe','toon','custom_shader')),
  enabled       boolean not null default true,
  config        jsonb not null default '{}',
  thumbnail_url text,
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Models ────────────────────────────────────────────────────────────────────
create table if not exists models (
  id            text primary key,
  name          text not null,
  slug          text not null unique,
  glb_url       text not null,
  thumbnail_url text,
  categories    text[] not null default '{}',
  author        text,
  enabled       boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── Presets ──────────────────────────────────────────────────────────────────
create table if not exists presets (
  id            text primary key default gen_random_uuid()::text,
  name          text not null,
  material_id   text references materials(id) on delete cascade,
  model_id      text references models(id)    on delete set null,
  params        jsonb not null default '{}',
  thumbnail_url text,
  created_at    timestamptz not null default now()
);

-- ── RLS policies (enable when auth is set up) ────────────────────────────────
-- alter table materials enable row level security;
-- alter table models    enable row level security;
-- alter table presets   enable row level security;

-- Public read
-- create policy "public_read_materials" on materials for select using (enabled = true);
-- create policy "public_read_models"    on models    for select using (enabled = true);

-- Authenticated write (admin only)
-- create policy "auth_write_materials" on materials for all using (auth.role() = 'authenticated');
-- create policy "auth_write_models"    on models    for all using (auth.role() = 'authenticated');

-- ── Trigger: updated_at ───────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger materials_updated_at
  before update on materials
  for each row execute procedure set_updated_at();
