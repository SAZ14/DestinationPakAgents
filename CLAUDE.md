# CLAUDE.md — repo conventions

Asaan Intelligence agents for Destination Pakistan. This file is the convention
reference for anyone (human or agent) working in this repo.

## Stack

Python 3.12 · FastAPI on Railway (multi-tenant) · Supabase (Postgres + pgvector +
append-only event ledger) · Twilio for WhatsApp · Apify for competitor scraping ·
Anthropic API with **Haiku-classify + Sonnet-orchestrate** routing.

The code targets 3.12 but is written to run on 3.11+ (the CI/test image).

## Architecture conventions

- **Adapter pattern with offline mocks.** Every external dependency (Anthropic,
  Twilio, Apify, the DB) lives behind an adapter in `app/adapters/` that has a
  *live* path and a deterministic *mock* path. An adapter goes live only when its
  credentials are present; otherwise it mocks. This keeps the whole system
  runnable and testable with zero infrastructure — the test suite never networks.
  When you add a dependency, add it as an adapter with a mock, not an inline call.

- **Tenant scoping is server-side only.** `tenant_id` is resolved from the inbound
  Twilio number (`app/config.py:tenant_for_number`) and injected by the tool layer
  (`ToolContext.tenant_id`). The model never sees, sets, or references it. Never
  add a tool parameter that takes a tenant id, and never let a query read rows
  outside `ctx.tenant_id`.

- **Reads auto-run; writes are draft-then-confirm.** Read tools execute
  immediately. Any tool that contacts a customer or mutates a record must DRAFT
  and return a one-time token; release happens only in the confirm lane via
  `queue_broadcast`, which is deliberately absent from the orchestrator's tool
  registry. Don't expose a release/send tool to the model.

- **Parameterized tools are the primary path.** `run_sql_readonly` is a guarded,
  read-only fallback (validate in code, force `LIMIT ≤ 200`, per-tenant SQLite
  view). Prefer adding a parameterized read tool over widening the SQL path.

- **Prompts are module constants** in `app/prompts.py`. Keep runtime prompt
  strings there, not inline.

## Model IDs

Use the configured models; don't hardcode elsewhere:

- classify → `claude-haiku-4-5` (`COS_CLASSIFIER_MODEL`)
- orchestrate / draft → `claude-sonnet-4-6` (`COS_ORCHESTRATOR_MODEL`)

The live tool loop is a standard Messages API tool-use loop
(`adapters/anthropic_client.py:LiveAnthropic.orchestrate`): call → on
`stop_reason == "tool_use"` execute via `registry.execute` → feed `tool_result`
back → repeat (bounded).

## Tests

```bash
python -m pytest -q
```

Tests force fully-mocked settings (`tests/conftest.py:MOCK_SETTINGS`) so they are
hermetic regardless of ambient credentials. Seed data is anchored to a fixed
`BASE_TODAY` (`app/adapters/db.py`) so time-window logic is deterministic; pass
`today=BASE_TODAY` to `Agent.handle` in time-sensitive tests.

## Adding a read tool

1. Implement `fn(ctx, **params) -> dict` in `app/tools/chief_of_staff/reads.py`,
   reading only via `ctx.db.select(table, ctx.tenant_id, predicate)`.
2. Register its JSON schema in `registry.ORCHESTRATOR_TOOLS` and add it to
   `registry.DISPATCH`.
3. Add a formatting branch in `anthropic_client.format_tool_result` (for the mock
   reply) and a unit test in `tests/test_reads.py`.

## Conventions

- Keep replies WhatsApp-short: lead with the number, then 1–3 lines of "so what",
  bold only the key figure, at most one next-step suggestion.
- Budgets/prices are USD.
- Never fabricate a number, vendor, or trip — every figure comes from a tool
  result in the current turn.
