-- =============================================================================
-- 0003 — store the customer-facing quote message on the quote
--
-- Step 4 (quote agent) drafts TWO things: a day-by-day itinerary (itinerary_md,
-- already present) and a short, warm WhatsApp message a staff member approves
-- and forwards as-is. We persist that message so the exact text the staff member
-- reviewed is what reaches the customer on approval — not a regenerated one.
--
-- Safe + idempotent. Apply with the Supabase SQL editor, `supabase db push`, or:
--   psql "$DATABASE_URL" -f supabase/migrations/0003_quote_message.sql
-- =============================================================================

alter table quotes add column if not exists quote_message text;
