# Asaan Intelligence

A WhatsApp-based AI travel concierge **+ lead-recovery** system for **Destination Pakistan**
([destinationpakistan.travel](https://destinationpakistan.travel)) — a 10-year-old inbound
tour operator in Gulberg, Lahore selling premium multi-day trips (priced in USD) to foreign tourists.

The MVP does these jobs, in priority order:

1. **Be the always-on concierge** — answer *any* customer question 24/7 (company,
   deals, packages & starting prices, safety, visas, and in-depth knowledge of every
   destination), in a warm, premium voice.
2. **Never miss a lead** — qualify inbound WhatsApp leads as it chats, then prepare a
   quote + draft itinerary and route it to a human for approval.
3. **Recover dead leads** — automatically segment leads and send staff-approved follow-ups to
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

## 🎬 Owner Demo (run this first — no Twilio, no Supabase)

A self-contained, browser-based demo that runs the **real concierge + quote
agents** against the **real knowledge base**, with in-memory state. The only
thing you need is an Anthropic API key — no database, no Twilio sandbox, no tunnel.

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env     # the only required key
npm run demo
# → open http://localhost:4000
```

You get a split screen:

- **Left — the customer's WhatsApp.** Ask anything ("Is Pakistan safe?", "Tell me
  about Hunza", "Do you offer photography trips? Any deals?") or start planning a trip.
- **Right — the Staff Ops Console.** Watch the lead record fill in live as the
  concierge qualifies the customer. When the lead is fully qualified, a **quote +
  itinerary is auto-drafted** and appears here for approval. Click **Approve & send**
  and the quote is delivered into the customer chat — the full human-in-the-loop loop.

Try the one-click sample prompts at the bottom of the chat. The pricing guardrail
is live too: if the customer's budget is below the matched package, the quote is
flagged **needs human pricing** and Approve is blocked until a human sets the price.

> This demo reuses `src/agents/qualifier.ts` and `src/agents/quote.ts` unchanged —
> it's the same brain that runs in the real WhatsApp pipeline, just with the
> database/Twilio swapped for an in-memory store and a web UI.

### Zero-install standalone file (for sharing / presenting)

`src/demo/standalone/Destination-Pakistan-Concierge-Demo.html` is a single,
self-contained HTML file — **no server, no `npm`, works offline.** Just open it
in any browser. It has two modes:

- **▶ Watch demo** — auto-plays a recorded walkthrough of a real run (safety
  question → Hunza/Skardu → photographer discount → visa → full qualification →
  drafted quote → approved & sent). Perfect for presenting with zero setup.
- **🔴 Go live & type** — paste an Anthropic API key and chat with the **real**
  concierge yourself, right in the browser (it calls the Anthropic API directly
  using the same prompts + knowledge base as the server). The key stays in your
  browser and is sent only to Anthropic.

It's a build artifact generated from the live agents; the browser-side engine
template is `src/demo/standalone/engine.template.js`.

## Build order (each step is independently testable)

1. **Project setup** — repo, TypeScript, env, migrations, seed. ✅
2. **Twilio webhook + echo** — receive inbound WhatsApp, log it, send a test reply. ✅
3. **Qualifier agent** — conversational field collection + segment classification + lead persistence. ✅
4. **Quote/itinerary drafting + approval routing** — package matching, Claude-drafted quote,
   staff notification, approval flow, customer send. ✅ ← *you are here*
5. **Lead scoring + recovery follow-ups** — cron, scoring, drafted follow-ups, staff approval, send.
6. **Staff command parser** — the broader WhatsApp admin commands (approve/reject landed in Step 4).

## Repository layout

```
src/
  config/        env loading + validation (config/env.ts)
  services/
    supabase/    Postgres client + row types
    twilio/      WhatsApp send/receive (Step 2)
    anthropic/   Claude client (Step 3)
  agents/        Claude-backed agents: concierge/qualifier, quote, recovery, commands (Steps 3-6)
  knowledge/     Destination Pakistan knowledge base the concierge answers from
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

## Step 2: Twilio Sandbox Echo Test

Proves the full loop: **inbound WhatsApp → webhook → find/create lead → log inbound →
send test reply → log outbound**. No Claude yet — the reply is a fixed test message.

### One-time prerequisites

- Step 1 done: migration applied, `npm run seed` run, Supabase env set.
- A [Twilio account](https://www.twilio.com/console) with the **WhatsApp Sandbox**
  enabled (Console → Messaging → Try it out → Send a WhatsApp message).
- A tunnel to expose your local server: [ngrok](https://ngrok.com) or Cloudflare Tunnel.

### Configure environment

Add your Twilio credentials to `.env` (all from the Twilio Console):

```
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # sandbox sender (default)
```

For the sandbox echo, leave `SKIP_TWILIO_SIGNATURE_VALIDATION=true` (the default).
To validate signatures later, set it to `false` **and** set `PUBLIC_WEBHOOK_BASE_URL`
to the exact tunnel URL Twilio calls — otherwise requests are rejected as 403.

### Steps

1. **Start the dev server:**
   ```bash
   npm run dev
   ```
2. **Expose it** (in a second terminal):
   ```bash
   ngrok http 3000          # or: cloudflared tunnel --url http://localhost:3000
   ```
   Copy the public HTTPS URL, e.g. `https://abcd-1234.ngrok-free.app`.
3. **Point the Twilio Sandbox at the webhook.** In the Twilio Console →
   Messaging → Try it out → WhatsApp Sandbox → **Sandbox settings**, set
   **"When a message comes in"** to:
   ```
   https://YOUR_PUBLIC_URL/webhooks/twilio/whatsapp
   ```
   Method: **HTTP POST**. Save.
4. **Join the sandbox** from your personal WhatsApp — send the `join <code>`
   message Twilio shows you.
5. **Send a test message** (e.g. "Hi, is Pakistan safe?").

### Confirm

1. **WhatsApp** receives:
   > Thanks for messaging Destination Pakistan. This is Asaan Intelligence test
   > mode — we received your message and a travel concierge will qualify your trip shortly.
2. **Supabase `leads`** has a row for your number
   (`select * from leads order by created_at desc limit 1;`).
3. **Supabase `conversations`** has two rows for that `lead_id`: a `customer`
   row (your message) and an `agent` row (the reply), each with a `twilio_sid`.

## Step 3: Qualifier Agent Test

Replaces the fixed echo with a **Claude-powered lead qualifier**. The bot now
conversationally collects trip details, classifies the segment, persists lead
fields, and moves the lead `new → qualifying → qualified`. **No quotes or
itineraries are generated** — when the minimum is met it says the team has enough
to prepare a draft for internal review.

### Prerequisites

- Steps 1–2 working (migration applied, seed run, Twilio Sandbox echo proven).
- **Apply migration `0002`** (adds the `qualified` status):
  paste `supabase/migrations/0002_lead_status_qualified.sql` into the Supabase SQL
  editor, or `supabase db push`, or `psql "$DATABASE_URL" -f ...0002...sql`.
- Set Anthropic env in `.env`:
  ```
  ANTHROPIC_API_KEY=sk-ant-...
  ANTHROPIC_MODEL=claude-opus-4-8      # configurable
  ```

### Run + expose (same as Step 2)

```bash
npm run dev
ngrok http 3000     # point the Twilio Sandbox webhook at /webhooks/twilio/whatsapp
```

### Test scenarios

Send these from your WhatsApp (each new number is a fresh lead):

1. **Basic culture lead** — *"Hi, I want to visit Hunza in July."*
   → Bot asks for group size and dates/budget naturally. `status=qualifying`,
   `segment=culture`.
2. **Trek lead** — *"We are 3 people interested in K2 Base Camp next summer."*
   → `segment=trek`, `num_people=3`. Bot asks dates, budget, experience level,
   and nationality if missing.
3. **Photography lead** — *"I am a filmmaker from France looking for a 12-day trip
   in northern Pakistan."*
   → `segment=photography`, `nationality` detected (France/French). Bot asks
   preferred dates, group size, destinations, and budget.
4. **Qualified lead** — *"We are 4 people from Malaysia. We want Hunza and Skardu
   for 10 days in July, budget around $1800 per person."*
   → Required fields complete → `status=qualified`. Bot says the team has enough
   to prepare a draft itinerary and quote for review. **No quote is generated.**

### What to inspect in Supabase

- **`leads`** for your number — watch fields fill in across turns: `segment`,
  `num_people`, `start_date`/`end_date` (or null if only a month was given),
  `budget_usd`, `destinations`, `nationality`, and `status`
  (`qualifying` → `qualified`).
- **`conversations`** — alternating `customer` / `agent` rows building the history
  the qualifier reads each turn.

### Notes

- If only a **month** is given, `start_date`/`end_date` stay null and the month is
  noted in `special_requests` — dates are never fabricated.
- If Claude is unreachable or returns unparseable output, the bot sends a safe
  fallback question and the webhook still succeeds (the inbound message is logged).

## Concierge knowledge (answers any question, 24/7)

The concierge isn't just a qualifier — it answers **any** Destination Pakistan
question (company, deals, packages & starting prices, safety, visas, best seasons,
and in-depth destination knowledge) while qualifying the lead in the background.

It answers from two sources, injected into the agent on **every** message:

1. **`src/knowledge/destinationPakistan.ts`** — an editable knowledge base:
   company profile, how booking works, safety/visa info, an FAQ, a **`DEALS`
   section staff edit to advertise promotions**, and **in-depth guides** for every
   destination (Hunza, Skardu, Fairy Meadows, Chitral, Naran, Swat, Kashmir,
   Islamabad, Lahore, and the treks incl. K2 Base Camp).
2. **The live package catalog** — loaded from the database each message, so the
   bot always knows current packages and their starting "from" prices.

**Pricing guardrail stays intact:** it may share catalog *"from"* starting prices
as indicative, but never gives a final/total price, never invents a price, and
never confirms a booking or availability — the final quote always goes through
human approval (Step 4).

> **To add a deal or new info:** edit `src/knowledge/destinationPakistan.ts`
> (e.g. the `DEALS` constant) and restart the server — no code changes elsewhere.
> To add a new package + price, add it to `src/seed/packages.ts` and run
> `npm run seed`; the concierge picks it up automatically.

### Quick test

- *"Is Pakistan safe for tourists?"* → factual reassurance from the knowledge base.
- *"Tell me about Hunza."* → an in-depth, accurate answer (Rakaposhi, Attabad Lake,
  Baltit Fort, best season…).
- *"Do you have any deals / what trips do you offer for Hunza and how much?"* →
  lists relevant catalog packages with their starting "from" prices, no final quote.

## Step 4: Quote + Itinerary Drafting + Staff Approval

Closes the concierge loop. The moment the qualifier marks a lead **`qualified`**,
the bot automatically:

1. **Matches** the best seeded package (segment → destination overlap → duration;
   pure logic, never an invented product or price).
2. **Drafts** — Claude writes a tailored day-by-day **itinerary** (markdown) and a
   short, warm WhatsApp **quote message**. The price is always the catalog price.
3. **Persists** a row in `quotes` as `awaiting_approval` and flips the lead to
   `awaiting_approval`.
4. **Notifies staff** — every number in `STAFF_APPROVER_NUMBERS` gets a WhatsApp
   summary: lead, trip, price (or ⚠️ *needs human pricing*), and a match note.

**Nothing reaches the customer until a human approves.** Staff approve by texting
the bot from an approver number:

| Staff message      | Effect |
| ------------------ | ------ |
| `APPROVE`          | Approve & send the *single* pending quote |
| `APPROVE <name>`   | Approve the pending quote for the named lead |
| `REJECT [name]`    | Reject the quote; lead stays `qualified` |
| `HELP`             | List commands |

On approval the customer receives the staff-reviewed quote message **and** the
itinerary; the quote → `sent`, the lead → `sent`.

> **Pricing guard.** If the lead's budget is below the matched package, the quote
> is flagged `needs_human_pricing`, **no price is shown to the customer**, and
> `APPROVE` is blocked until a human sets the real price.

### Prerequisites

- Steps 1–3 working.
- **Apply migration `0003`** (adds `quotes.quote_message`):
  paste `supabase/migrations/0003_quote_message.sql` into the Supabase SQL editor,
  or `supabase db push`, or `psql "$DATABASE_URL" -f ...0003...sql`.
- Set **`STAFF_APPROVER_NUMBERS`** in `.env` (E.164, with `whatsapp:` prefix) and
  join the Twilio Sandbox from each of those phones so the bot can message them.

### Test

1. From a **customer** phone, qualify a lead fully, e.g.
   *"We are 4 people from Malaysia, Hunza and Skardu for 10 days in July, budget
   about $1800 per person."*
2. The customer gets the qualifier's "we have enough to prepare a draft" reply.
   In Supabase, a `quotes` row appears (`status=awaiting_approval`) and the lead
   is `awaiting_approval`.
3. The **staff** phone receives the new-quote notification. Reply `APPROVE`.
4. The **customer** phone receives the quote message + itinerary; the `quotes`
   row is `sent` and the lead is `sent`.

### Notes

- Staff vs. customer is decided purely by `STAFF_APPROVER_NUMBERS` — staff
  messages never create leads or hit the qualifier.
- Quote drafting is **best-effort and idempotent**: it runs once per lead (guarded
  by an existing pending quote) and a failure never blocks the customer reply.

## Conventions

- **Secrets** live only in `.env`; `.env` is git-ignored. `.env.example` documents every key.
- **Sandbox first.** Twilio is wired against the Sandbox; moving to a production sender is just
  changing `TWILIO_WHATSAPP_FROM`.
- **Destination-Pakistan-specific logic** (the catalog, segments, tone) is commented where it
  lives so it's easy to tune — start with `src/seed/packages.ts`.
