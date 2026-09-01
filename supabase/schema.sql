create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dedupe_key text not null default gen_random_uuid()::text,
  phone text,
  email text,
  company text,
  source text not null default 'manual',
  source_url text,
  source_detail text,
  status text not null default 'novo' check (status in ('novo','contatado','qualificado','proposta','convertido','perdido')),
  score integer not null default 0 check (score between 0 and 100),
  interest text,
  notes text,
  consent_at timestamptz,
  consent_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_owner_created_idx on public.leads(owner_id, created_at desc);
create index if not exists leads_owner_status_idx on public.leads(owner_id, status);
create index if not exists leads_owner_email_idx on public.leads(owner_id, lower(email));
create index if not exists leads_owner_phone_idx on public.leads(owner_id, phone);
create unique index if not exists leads_owner_dedupe_idx on public.leads(owner_id, dedupe_key);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads for each row execute function public.set_updated_at();

alter table public.leads enable row level security;
drop policy if exists leads_select_own on public.leads;
drop policy if exists leads_insert_own on public.leads;
drop policy if exists leads_update_own on public.leads;
drop policy if exists leads_delete_own on public.leads;
create policy leads_select_own on public.leads for select using (auth.uid() = owner_id);
create policy leads_insert_own on public.leads for insert with check (auth.uid() = owner_id);
create policy leads_update_own on public.leads for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy leads_delete_own on public.leads for delete using (auth.uid() = owner_id);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null default 'nota',
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists activities_owner_idx on public.activities(owner_id, created_at desc);
create index if not exists activities_lead_idx on public.activities(lead_id, created_at desc);
alter table public.activities enable row level security;
drop policy if exists activities_select_own on public.activities;
drop policy if exists activities_insert_own on public.activities;
drop policy if exists activities_update_own on public.activities;
drop policy if exists activities_delete_own on public.activities;
create policy activities_select_own on public.activities for select using (auth.uid() = owner_id);
create policy activities_insert_own on public.activities for insert with check (auth.uid() = owner_id and exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid()));
create policy activities_update_own on public.activities for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy activities_delete_own on public.activities for delete using (auth.uid() = owner_id);
