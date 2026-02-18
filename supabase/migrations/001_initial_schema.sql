-- Estate Auction Logger — Initial Schema
-- Run this in Supabase SQL Editor

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
create type estate_status as enum ('draft', 'logging', 'review', 'enriching', 'published', 'archived');
create type item_status as enum ('captured', 'confirmed', 'enriched', 'published');
create type session_status as enum ('active', 'paused', 'completed');
create type item_condition as enum ('excellent', 'good', 'fair', 'poor', 'unknown');
create type property_type as enum ('residential', 'commercial', 'storage', 'other');
create type image_type as enum ('actual', 'reference');
create type enrichment_confidence as enum ('high', 'medium', 'low');

-- ============================================================
-- ESTATES
-- ============================================================
create table estates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text not null,
  auction_date timestamptz not null,
  status estate_status not null default 'draft',
  property_type property_type,
  executor_name text,
  executor_contact text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_estates_user_id on estates(user_id);
create index idx_estates_status on estates(status);

-- ============================================================
-- LOGGING SESSIONS
-- ============================================================
create table logging_sessions (
  id uuid primary key default uuid_generate_v4(),
  estate_id uuid not null references estates(id) on delete cascade,
  status session_status not null default 'active',
  full_transcript text,
  item_count integer default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index idx_sessions_estate_id on logging_sessions(estate_id);

-- ============================================================
-- ITEMS
-- ============================================================
create table items (
  id uuid primary key default uuid_generate_v4(),
  estate_id uuid not null references estates(id) on delete cascade,
  session_id uuid references logging_sessions(id) on delete set null,
  name text not null,
  description text,
  category text not null default 'Miscellaneous',
  condition item_condition default 'unknown',
  location text,
  voice_transcript text,
  status item_status not null default 'captured',
  sort_order integer,
  created_at timestamptz not null default now()
);

create index idx_items_estate_id on items(estate_id);
create index idx_items_status on items(status);
create index idx_items_category on items(category);

-- Full-text search index for published page search
alter table items add column fts tsvector
  generated always as (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, ''))
  ) stored;
create index idx_items_fts on items using gin(fts);

-- ============================================================
-- ENRICHMENT RECORDS
-- ============================================================
create table enrichment_records (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null unique references items(id) on delete cascade,
  product_match text,
  manufacturer text,
  reference_images jsonb default '[]'::jsonb,
  last_sale_price numeric(10,2),
  estimated_value_low numeric(10,2),
  estimated_value_high numeric(10,2),
  recommended_start_bid numeric(10,2),
  enhanced_description text,
  notable_details text,
  source_urls jsonb default '[]'::jsonb,
  confidence enrichment_confidence,
  enriched_at timestamptz not null default now()
);

create index idx_enrichment_item_id on enrichment_records(item_id);

-- ============================================================
-- IMAGES
-- ============================================================
create table item_images (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references items(id) on delete cascade,
  url text not null,
  type image_type not null default 'actual',
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_images_item_id on item_images(item_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table estates enable row level security;
alter table logging_sessions enable row level security;
alter table items enable row level security;
alter table enrichment_records enable row level security;
alter table item_images enable row level security;

-- Estate owner policies
create policy "Users can view their own estates"
  on estates for select using (auth.uid() = user_id);
create policy "Users can insert their own estates"
  on estates for insert with check (auth.uid() = user_id);
create policy "Users can update their own estates"
  on estates for update using (auth.uid() = user_id);
create policy "Users can delete their own estates"
  on estates for delete using (auth.uid() = user_id);

-- Sessions: access through estate ownership
create policy "Users can manage sessions for their estates"
  on logging_sessions for all
  using (estate_id in (select id from estates where user_id = auth.uid()));

-- Items: access through estate ownership
create policy "Users can manage items for their estates"
  on items for all
  using (estate_id in (select id from estates where user_id = auth.uid()));

-- Enrichment: access through item → estate ownership
create policy "Users can manage enrichment for their items"
  on enrichment_records for all
  using (item_id in (
    select i.id from items i
    join estates e on i.estate_id = e.id
    where e.user_id = auth.uid()
  ));

-- Images: access through item → estate ownership
create policy "Users can manage images for their items"
  on item_images for all
  using (item_id in (
    select i.id from items i
    join estates e on i.estate_id = e.id
    where e.user_id = auth.uid()
  ));

-- ============================================================
-- PUBLIC ACCESS for published auction pages
-- ============================================================
create policy "Anyone can view published estates"
  on estates for select
  using (status = 'published');

create policy "Anyone can view items in published estates"
  on items for select
  using (estate_id in (select id from estates where status = 'published'));

create policy "Anyone can view enrichment for published items"
  on enrichment_records for select
  using (item_id in (
    select i.id from items i
    join estates e on i.estate_id = e.id
    where e.status = 'published'
  ));

create policy "Anyone can view images for published items"
  on item_images for select
  using (item_id in (
    select i.id from items i
    join estates e on i.estate_id = e.id
    where e.status = 'published'
  ));

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at on estates
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger estates_updated_at
  before update on estates
  for each row execute function update_updated_at();

-- View: estate with item counts
create or replace view estate_summary as
select
  e.*,
  coalesce(ic.total, 0) as item_count,
  coalesce(ic.enriched, 0) as enriched_count
from estates e
left join lateral (
  select
    count(*) as total,
    count(*) filter (where i.status = 'enriched' or i.status = 'published') as enriched
  from items i where i.estate_id = e.id
) ic on true;

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'item-images');

create policy "Anyone can view item images"
  on storage.objects for select
  using (bucket_id = 'item-images');

create policy "Users can delete their own images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'item-images');

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table items;
