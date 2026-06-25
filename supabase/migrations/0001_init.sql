-- =============================================================================
-- Asaan Intelligence — initial schema
-- Destination Pakistan WhatsApp concierge + lead-recovery MVP
--
-- Apply with the Supabase SQL editor, or:
--   supabase db push                  (Supabase CLI, linked project)
--   psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
--
-- Design notes:
--  * Enums model the fixed business vocabularies (segments, statuses) so the
--    concierge/recovery agents can branch on known values. Tune the segment
--    list here if Destination Pakistan adds a new line of business.
--  * Human-in-the-loop is enforced by status columns: nothing is "sent" until a
--    staff member approves. The AI only ever writes *draft* / *awaiting_approval*
--    rows; the send step flips status to approved/sent.
-- =============================================================================

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums (business vocabularies)
-- -----------------------------------------------------------------------------

-- Customer segments. The qualifier classifies every lead into exactly one of
-- these, then branches the conversation accordingly.
do $$ begin
  create type lead_segment as enum (
    'culture',       -- general culture & adventure tourists
    'trek',          -- serious trekkers / expedition climbers (K2, Batura, Snow Leopard)
    'photography',   -- photographers / content creators / filmmakers
    'faith',         -- spiritual / "reverts" journeys
    'corporate'      -- group / corporate bookings
  );
exception when duplicate_object then null; end $$;

-- Lead lifecycle. Drives both the concierge flow and recovery scoring.
do $$ begin
  create type lead_status as enum (
    'new',
    'qualifying',
    'quoted',
    'awaiting_approval',
    'sent',
    'booked',
    'dormant',
    'lost'
  );
exception when duplicate_object then null; end $$;

-- Where a lead originated.
do $$ begin
  create type lead_source as enum (
    'whatsapp',
    'instagram',
    'website',
    'email'
  );
exception when duplicate_object then null; end $$;

-- Who authored a conversation message.
do $$ begin
  create type conversation_role as enum (
    'customer',  -- inbound from the lead
    'agent',     -- outbound from the AI / system
    'staff'      -- inbound from a Destination Pakistan staff member (admin commands)
  );
exception when duplicate_object then null; end $$;

-- Quote lifecycle. AI drafts -> staff approves -> system sends.
do $$ begin
  create type quote_status as enum (
    'draft',
    'awaiting_approval',
    'approved',
    'rejected',
    'sent'
  );
exception when duplicate_object then null; end $$;

-- Follow-up segments (lead-recovery scoring buckets).
do $$ begin
  create type followup_type as enum (
    'hot',       -- gave dates + budget
    'warm',      -- asked price only
    'dormant',   -- no reply 7+ days
    'urgent'     -- wants to travel within 14 days
  );
exception when duplicate_object then null; end $$;

-- Follow-up lifecycle. AI drafts -> staff approves -> system sends.
do $$ begin
  create type followup_status as enum (
    'draft',
    'awaiting_approval',
    'approved',
    'sent',
    'skipped'
  );
exception when duplicate_object then null; end $$;

-- Staff roles.
do $$ begin
  create type staff_role as enum (
    'approver',
    'admin'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- packages — the seeded Destination Pakistan catalog (real products, USD)
-- -----------------------------------------------------------------------------
create table if not exists packages (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  segment         lead_segment not null,
  duration_days   integer not null check (duration_days > 0),
  base_price_usd  numeric(10, 2) not null check (base_price_usd >= 0),
  destinations    text[] not null default '{}',
  summary         text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Names are the natural human key for staff commands ("approve quote for ...").
create unique index if not exists packages_name_key on packages (name);
create index if not exists packages_segment_idx on packages (segment);

-- -----------------------------------------------------------------------------
-- staff — Destination Pakistan team members who approve and run admin commands
-- -----------------------------------------------------------------------------
create table if not exists staff (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  whatsapp_number  text not null,   -- store with the whatsapp: prefix, E.164
  role             staff_role not null default 'approver',
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create unique index if not exists staff_whatsapp_number_key on staff (whatsapp_number);

-- -----------------------------------------------------------------------------
-- leads — the core record. One per customer phone number.
-- -----------------------------------------------------------------------------
create table if not exists leads (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  source              lead_source not null default 'whatsapp',
  whatsapp_number     text not null,            -- with whatsapp: prefix, E.164
  name                text,
  nationality         text,
  city                text,

  segment             lead_segment,
  num_people          integer check (num_people is null or num_people > 0),
  start_date          date,
  end_date            date,
  budget_usd          numeric(10, 2) check (budget_usd is null or budget_usd >= 0),
  luxury_level        text,                      -- e.g. 'budget' | 'standard' | 'premium' | 'luxury'

  destinations        text[] not null default '{}',
  hotel_pref          text,
  transport_pref      text,
  dietary             text,
  visa_help           boolean not null default false,
  special_requests    text,

  status              lead_status not null default 'new',
  -- Scoring tags (hot/warm/dormant/high_value/urgent). A lead can carry several.
  lead_score          text[] not null default '{}',

  last_inbound_at     timestamptz,
  last_outbound_at    timestamptz,

  assigned_package_id uuid references packages (id) on delete set null
);

create unique index if not exists leads_whatsapp_number_key on leads (whatsapp_number);
create index if not exists leads_status_idx on leads (status);
create index if not exists leads_segment_idx on leads (segment);
create index if not exists leads_last_inbound_idx on leads (last_inbound_at);

-- -----------------------------------------------------------------------------
-- conversations — full message log (customer / agent / staff)
-- -----------------------------------------------------------------------------
create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads (id) on delete cascade,
  role        conversation_role not null,
  channel     text not null default 'whatsapp',
  body        text not null,
  twilio_sid  text,                 -- Twilio Message SID for traceability / dedupe
  created_at  timestamptz not null default now()
);

create index if not exists conversations_lead_id_idx on conversations (lead_id, created_at);
create index if not exists conversations_twilio_sid_idx on conversations (twilio_sid);

-- -----------------------------------------------------------------------------
-- quotes — AI-drafted quote + itinerary, gated behind staff approval
-- -----------------------------------------------------------------------------
create table if not exists quotes (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references leads (id) on delete cascade,
  package_id   uuid references packages (id) on delete set null,
  itinerary_md text,                       -- markdown day-by-day itinerary
  price_usd    numeric(10, 2) check (price_usd is null or price_usd >= 0),
  status       quote_status not null default 'draft',
  -- Set to a staff WhatsApp number / id when approved.
  approved_by  text,
  -- True when the price is outside the seeded catalog and needs human pricing.
  needs_human_pricing boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists quotes_lead_id_idx on quotes (lead_id);
create index if not exists quotes_status_idx on quotes (status);

-- -----------------------------------------------------------------------------
-- followups — AI-drafted re-engagement messages, gated behind staff approval
-- -----------------------------------------------------------------------------
create table if not exists followups (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads (id) on delete cascade,
  type          followup_type not null,
  draft_body    text not null,
  status        followup_status not null default 'draft',
  scheduled_for timestamptz,
  sent_at       timestamptz,
  approved_by   text,
  created_at    timestamptz not null default now()
);

create index if not exists followups_lead_id_idx on followups (lead_id);
create index if not exists followups_status_idx on followups (status);
create index if not exists followups_type_idx on followups (type);

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_set_updated_at on leads;
create trigger leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();

drop trigger if exists quotes_set_updated_at on quotes;
create trigger quotes_set_updated_at
  before update on quotes
  for each row execute function set_updated_at();
