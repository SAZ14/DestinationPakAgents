# Asaan Intelligence

A WhatsApp-based AI travel concierge **+ lead-recovery** system for **Destination Pakistan**
([destinationpakistan.travel](https://destinationpakistan.travel)) — a 10-year-old inbound
tour operator in Gulberg, Lahore selling premium multi-day trips (priced in USD) to foreign tourists.

The MVP does exactly two jobs, in priority order:

1. **Never miss a lead** — instantly answer and qualify inbound WhatsApp leads 24/7, then
   prepare a quote + draft itinerary and route it to a human for approval.
2. **Recover dead leads** — automatically segment leads and send staff-approved follow-ups to
   people who asked for a price and vanished.

> **Hard rule — human-in-the-loop is non-negotiable.** The AI never confirms a booking by
> itself. It *drafts* quotes, itineraries, and follow-ups; a human at Destination Pakistan
> *approves* them from inside WhatsApp before anything is sent or committed. The AI never quotes
> a price outside the seeded catalog without flagging it for human pricing.

## Tech stack

| Concern        | Choice |
| -------------- | ------ |
| Backend        | Node.js + TypeScript, Express (webhooks) |
| Database       | Supabase (Postgres) via `@supabase/supabase-js`, with SQL migrations |
| WhatsApp       | Twilio WhatsApp API (Sandbox first; production sender is an env change) |
| LLM            | Anthropic Claude (Messages API, `@anthropic-ai/sdk`), model in an env var |
| Config         | `.env` only — no hardcoded secrets or phone numbers |
| Admin UI       | **None** — staff approve and run admin commands by texting the bot |

## Build order (each step is independently testable)

1. **Project setup** — repo, TypeScript, env, migrations, seed. ← *you are here*
2. **Twilio webhook + echo** — receive inbound WhatsApp, log it, send a test reply.
3. **Qualifier agent** — conversational field collection + segment classification + lead persistence.
4. **Quote/itinerary drafting + approval routing** — package matching, Claude-drafted quote,
   staff notification, approval flow, customer send.
5. **Lead scoring + recovery follow-ups** — cron, scoring, drafted follow-ups, staff approval, send.
6. **Staff command parser** — the WhatsApp admin commands.

## Repository layout

```
src/
  config/        env loading + validation (config/env.ts)
  services/
    supabase/    Postgres client + row types
    twilio/      WhatsApp send/receive (Step 2)
    anthropic/   Claude client (Step 3)
  agents/        Claude-backed agents: qualifier, quote, recovery, commands (Steps 3-6)
  webhooks/      Twilio inbound webhook handlers (Step 2)
  jobs/          scheduled jobs — lead recovery (Step 5)
  seed/          Destination Pakistan catalog (real packages)
  scripts/       one-off scripts (seed.ts)
  server.ts      HTTP entrypoint
supabase/
  migrations/    SQL migrations (0001_init.sql)
```

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`. Minimum for Step 1 (DB + seed):

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — from your Supabase project settings → API.

For later steps you'll also need `TWILIO_*`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
(default `claude-opus-4-8`), and `STAFF_APPROVER_NUMBERS`.

### 3. Apply the database schema

Run the migration against your Supabase Postgres. Easiest paths:

- **Supabase SQL editor** — paste the contents of
  `supabase/migrations/0001_init.sql` and run it; **or**
- **psql** — `psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql`; **or**
- **Supabase CLI** (linked project) — `supabase db push`.

### 4. Seed the catalog (and staff approvers)

```bash
npm run seed
```

This upserts the 14 real packages into `packages` and, if `STAFF_APPROVER_NUMBERS`
is set, upserts those numbers into `staff`. It is idempotent — safe to re-run.

### 5. Run the server (health check)

```bash
npm run dev      # ts-node-dev, auto-reload
# or
npm run build && npm start
```

Then:

```bash
curl http://localhost:3000/health
# { "ok": true, "service": "asaan-intelligence", ... }
```

## How to verify Step 1

- `npm run typecheck` passes.
- The migration applies cleanly (tables `leads`, `conversations`, `quotes`, `packages`,
  `followups`, `staff` exist).
- `npm run seed` reports `✓ Seeded 14 packages.`
- In Supabase, `select count(*) from packages;` returns `14`.
- `curl /health` returns `ok: true`.

## Conventions

- **Secrets** live only in `.env`; `.env` is git-ignored. `.env.example` documents every key.
- **Sandbox first.** Twilio is wired against the Sandbox; moving to a production sender is just
  changing `TWILIO_WHATSAPP_FROM`.
- **Destination-Pakistan-specific logic** (the catalog, segments, tone) is commented where it
  lives so it's easy to tune — start with `src/seed/packages.ts`.
