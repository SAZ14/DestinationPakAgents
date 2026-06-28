-- Chief of Staff Agent — pending_actions store (TTL ~30 min).
--
-- Holds draft-then-confirm broadcasts between draft_broadcast (which writes a
-- row) and the confirm lane (which releases it via queue_broadcast). Tokens are
-- one-time: the row is deleted on release. tenant_id is enforced server-side and
-- never set by the model.

create table if not exists pending_actions (
    token                text primary key,
    tenant_id            text        not null,
    sender               text        not null,        -- whatsapp:+E164 of the owner/staff member
    draft                text        not null,        -- message copy with {{merge}} fields
    lead_ids             text[]      not null default '{}',
    angle                text        not null,        -- re-engage | price nudge | season urgency | deposit push
    include_deposit_link boolean     not null default false,
    created_at           timestamptz not null default now(),
    expires_at           timestamptz not null         -- created_at + interval '30 minutes'
);

create index if not exists pending_actions_tenant_sender_idx
    on pending_actions (tenant_id, sender, created_at desc);

create index if not exists pending_actions_expires_idx
    on pending_actions (expires_at);

-- Reap expired drafts. Run on a schedule (pg_cron) or opportunistically before
-- looking up a sender's latest pending action.
--   delete from pending_actions where expires_at < now();
