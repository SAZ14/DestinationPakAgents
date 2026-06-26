-- =============================================================================
-- 0002 — add 'qualified' to the lead_status enum
--
-- Step 3 (qualifier agent) needs a clear stopping point: once the
-- required-to-quote minimum fields exist, the lead moves to 'qualified'.
-- Step 4 then picks up 'qualified' leads to draft a quote.
--
-- Safe + idempotent. ADD VALUE IF NOT EXISTS does not rewrite existing rows.
-- Apply with the Supabase SQL editor, `supabase db push`, or:
--   psql "$DATABASE_URL" -f supabase/migrations/0002_lead_status_qualified.sql
-- =============================================================================

alter type lead_status add value if not exists 'qualified' after 'qualifying';
