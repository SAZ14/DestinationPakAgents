# Chief of Staff Agent — Asaan Intelligence

An operations-brain WhatsApp agent for **Destination Pakistan**, a Lahore-based
inbound tour operator running multi-day trips across northern Pakistan (Hunza,
Skardu, Fairy Meadows, K2 Base Camp, Swat, Chitral) for foreign tourists.
Budgets/prices are **USD** ($1,500–$3,500 band). "Vendors" = the hotels, guides,
drivers and transporters they subcontract.

The owner texts natural-language questions/commands on WhatsApp; the agent reads
the business and answers. For write actions (anything that contacts a customer
or mutates a record) it **drafts and waits for confirmation** — it never sends on
its own.

> Multi-tenant by design. This repo ships the Destination Pakistan tenant plus a
> tiny second tenant used only to prove isolation in tests.

## How it works

```
inbound webhook
  → AUTH GATE          verify From ∈ tenant whitelist; unauthorized → empty 200 (silent drop)
  → instant TwiML ack  "On it — pulling that now 🔎"
  → background task:
      • pending action + confirmation body → CONFIRM lane (maybe queue_broadcast)
      • else Haiku classify → {lane, entities, time_window}
          lane=query        → read tools (auto)      → Sonnet synthesize → outbound
          lane=action       → segment + draft_broadcast (DRAFT only)     → outbound "SEND/EDIT"
          lane=intelligence → competitor_scan (Apify) → Sonnet synthesize → outbound
          lane=smalltalk    → short Sonnet reply
  → send the real answer as a SEPARATE outbound WhatsApp message
```

Non-negotiables baked in:

1. **Auth gate, fail-closed, silent.** `From` is checked against the tenant's
   owner/staff whitelist before anything else; unauthorized messages get an empty
   `200` and no reply.
2. **Two-message Twilio pattern.** Instant TwiML ack, then the real answer as a
   separate outbound message.
3. **Reads auto-run; writes never do.** Any read executes immediately. An action
   is drafted with a one-time token and only released when the owner replies
   `SEND <token>`. One token, one send.
4. **Tenant scoping is server-side only.** `tenant_id` is resolved from the
   inbound Twilio number and injected by the tool layer. The model never sees,
   sets, or references it, and never sees another tenant's rows.
5. **Parameterized tools first; raw SQL is a guarded read-only fallback.**

## Models

Haiku classifies intent, Sonnet orchestrates and drafts:

| Role | Model | Override |
|------|-------|----------|
| Classify | `claude-haiku-4-5` | `COS_CLASSIFIER_MODEL` |
| Orchestrate / draft | `claude-sonnet-4-6` | `COS_ORCHESTRATOR_MODEL` |

## Tools

Read (auto-execute, read-only, tenant-scoped, LIMIT-capped):

- `count_leads`, `list_leads`, `stale_quotes`, `segment_no_booking`,
  `trip_feedback_ranking`, `vendor_feedback_ranking`, `pipeline_summary`
- `run_sql_readonly(sql, purpose)` — **fallback only.** Validated in code: single
  statement, must match `^\s*SELECT`, no `;` mid-statement, no
  INSERT/UPDATE/DELETE/DDL/COPY/GRANT, forced `LIMIT ≤ 200`. Runs against a
  per-tenant SQLite view containing only that tenant's rows.

External:

- `competitor_scan(destination, handles?)` — Apify scrape (Instagram path);
  returns `[{competitor, package, price, duration, notes}]`, flags undercuts.

Action (draft-then-confirm):

- `draft_broadcast(lead_ids, angle, include_deposit_link=false)` →
  `{draft, segment_size, token}`. **Does not send.** Writes a `pending_actions` row.
- `queue_broadcast(token)` — **CONFIRM lane only**, never exposed to the
  orchestrator. Requires a valid, unexpired token matching `(tenant, sender)`.

## Layout

```
app/
  main.py                       FastAPI app + /wa/chief-of-staff webhook
  config.py                     tenants, whitelist, model + env settings
  auth.py                       fail-closed silent auth gate
  prompts.py                    runtime prompt strings (module constants)
  time_window.py                today|this_week|...|{from,to} normalization
  agent/runner.py               classify → orchestrate → tool-loop → reply + confirm lane
  adapters/
    anthropic_client.py         Haiku classify + Sonnet orchestrate (live) / deterministic (mock)
    twilio_client.py            send_whatsapp (live REST) / in-memory outbox (mock)
    apify_client.py             competitor scrape (live) / canned (mock)
    db.py                       tenant-scoped store + seed data + per-tenant SQLite view
  tools/chief_of_staff/         reads.py, actions.py, intelligence.py, sql_fallback.py, registry.py
migrations/0001_pending_actions.sql
tests/                          74 tests, fully offline
```

## Mock mode (no credentials needed)

Every adapter degrades to a deterministic offline implementation when its
credentials are absent: a rule-based classifier/orchestrator, in-memory seed
data, canned competitor scrapes, and a logged-only outbox. With **no** env vars
set the whole agent runs and is fully exercisable — that's what the test suite
uses.

## Run

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

`GET /health` reports which adapters are live.

### WhatsApp-style demo page (for showing a client)

A self-contained, WhatsApp-styled chat page at **`app/static/demo.html`**:

- **Offline** — open the file in any browser and hit "▶ Replay scripted demo".
  It auto-plays a faithful conversation (the two-message ack pattern, reads,
  competitor undercut flags, and the draft→`SEND` confirm gate). No server, no
  credentials — perfect to email a client.
- **Live Q&A** — `uvicorn app.main:app` then open `http://localhost:8000/demo`.
  Type your own questions; the **Engine** button toggles **🤖 Claude (live)** —
  real Haiku (classify) + Sonnet (tool loop) when `ANTHROPIC_API_KEY` is set —
  and **⚡ Instant** (deterministic mock). Either way Apify/Twilio stay mocked, so
  a competitor query can't hang and nothing is actually sent. Append `?noauto`
  (`/demo?noauto`) to skip the scripted intro and start on a clean chat.

### Curl — simulate an owner message

`/simulate` runs the agent synchronously and returns the reply as JSON (same auth
gate as the webhook; handy for demos). `From` must be a whitelisted owner number
and `To` the tenant's Twilio number.

```bash
curl -s http://localhost:8000/simulate \
  --data-urlencode 'To=whatsapp:+14155238886' \
  --data-urlencode 'From=whatsapp:+923001112233' \
  --data-urlencode 'Body=how many leads do we have by status?'
# {"reply":"**18** leads by status:\n• quoted: 6\n• booked: 3\n• new: 3 ..."}
```

The real Twilio webhook is `POST /wa/chief-of-staff` with the same form fields;
it returns the TwiML ack and sends the answer as a second message.

```bash
curl -s http://localhost:8000/wa/chief-of-staff \
  --data-urlencode 'To=whatsapp:+14155238886' \
  --data-urlencode 'From=whatsapp:+923001112233' \
  --data-urlencode 'Body=draft a re-engage follow-up to Hunza leads who did not book'
# → TwiML ack; the draft + "Reply SEND <token>..." arrives as a separate WhatsApp message.
```

An unauthorized `From` (or unknown `To`) returns an empty `200` with no body.

## Environment variables

See `.env.example`. Unset = mock. Key ones:

| Var | Purpose |
|-----|---------|
| `ANTHROPIC_API_KEY` | enables live Haiku/Sonnet (needs the `anthropic` SDK installed) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | enables live outbound WhatsApp |
| `DP_TWILIO_NUMBER` | the tenant's WhatsApp line (resolves `tenant_id`) |
| `DP_OWNER_NUMBERS` | comma-separated owner/staff whitelist (fail-closed) |
| `APIFY_TOKEN` | enables live competitor scraping |
| `COS_PENDING_TTL_MINUTES` | draft token TTL (default 30) |
| `COS_ASAANPAY_ENABLED` | flip on once deposit-link generation is wired |

## Tests

```bash
python -m pytest -q     # 74 tests, ~0.4s, no network
```

## Open dependency — Asaanpay deposit links

The deposit-push follow-up needs the Asaanpay payment-link generation step to
resolve `{{asaanpay_deposit_link}}` per lead. Until it's wired
(`COS_ASAANPAY_ENABLED=false`), `draft_broadcast` forces `include_deposit_link`
off and the agent tells the owner the follow-up has no pay link yet. Wiring it
also unblocks the Concierge deposit CTA.

## Migrations

`migrations/0001_pending_actions.sql` creates the `pending_actions` table
(TTL ~30 min). The other tables (`leads`, `conversations`, `quotes`, `bookings`,
`trips`, `vendors`, `vendor_feedback`, `reviews`, `competitors`) are assumed to
exist in the shared Supabase ledger; `db.py` mirrors their shape for offline use.
