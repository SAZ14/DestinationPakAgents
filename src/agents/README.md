# Agents

Claude-backed agents. Each agent is a pure function: it takes a lead + context,
calls Claude, and returns a structured result. Persistence and transport live in
`services/` and `webhooks/` — agents never touch Twilio or write to the DB
directly, so they stay easy to test and reuse.

## Qualifier (`qualifier.ts`) — Step 3

A warm, premium travel concierge for **Destination Pakistan**. It conversationally
qualifies inbound WhatsApp leads.

### What it does

Given `{ lead, recentMessages, inboundMessage }`, `qualifyLead(...)` asks Claude to:

- **extract trip fields** (name, nationality, dates, group size, budget, destinations, …),
- **classify** the lead into exactly one segment — `culture | trek | photography | faith | corporate`,
- **decide** whether the required-to-quote minimum is met,
- **write** the next warm reply (1–3 natural questions, no walls of text).

It returns:

```ts
{
  reply: string,                       // the WhatsApp message to send
  extractedFields: LeadQualificationPatch, // snake_case, maps to lead columns
  segment?: LeadSegment,
  status: 'qualifying' | 'qualified',
  requiredFieldsComplete: boolean,
  confidence: number                   // 0..1
}
```

`status` is derived from `requiredFieldsComplete` (single source of truth):
incomplete → `qualifying`, complete → `qualified`.

### What it does NOT do

- ❌ confirm bookings or promise availability
- ❌ quote prices or invent package prices
- ❌ generate itineraries
- ❌ route to staff / approvals
- ❌ write to the database or call Twilio (the webhook does that)

When the minimum is met, the reply tells the traveler the team now has enough to
**prepare a draft itinerary and quote for internal review** — nothing is quoted.

### Required-to-quote minimum

`dates or month` · `number of people` · `destinations or trip type` · `rough budget` · `segment`.

If a month is given without exact dates, dates stay `null` and the month is noted
in the reply / `special_requests` — never fabricated.

### Robustness

Claude is asked for a single JSON object and parsed **defensively** (tolerates code
fences and stray prose). On any model or parse failure, `qualifyLead` logs the error
server-side and returns a safe fallback question — it **never throws**, so the webhook
never crashes.

### Model

Env-driven via `ANTHROPIC_MODEL` (default `claude-opus-4-8`) and `ANTHROPIC_API_KEY`.
Change the model without touching code.

### How to test (Twilio Sandbox)

Follow **"Step 3: Qualifier Agent Test"** in the project root `README.md`. In short:
run `npm run dev`, expose with ngrok, point the Twilio Sandbox webhook at
`/webhooks/twilio/whatsapp`, then message the sandbox and watch the lead fields +
status evolve in Supabase across turns.

### What Step 4 adds

Step 4 consumes `qualified` leads: matches the best seeded package(s), has Claude
**draft** a quote + day-by-day itinerary, saves it `awaiting_approval`, and notifies a
staff approver on WhatsApp. Nothing sends to the customer until a human approves.
The qualifier is untouched by that work.
