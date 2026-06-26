/**
 * In-memory demo store.
 *
 * The demo runs the REAL concierge + quote agents (and the real knowledge base)
 * but swaps Supabase/Twilio for an in-memory map and a browser UI. This lets us
 * show the owner a working end-to-end flow with ONLY an Anthropic API key — no
 * database, no Twilio sandbox, no tunnel.
 *
 * Sessions are keyed by a browser-generated id and live only for the process
 * lifetime. Nothing is persisted.
 */

import type { ConversationRow, LeadRow, PackageRow } from '../services/supabase/types';
import type { LeadQualificationPatch } from '../services/supabase/leads';
import type { QuoteDraft } from '../agents/quote';
import { PACKAGES } from '../seed/packages';

export type DemoQuoteStatus = 'awaiting_approval' | 'sent' | 'rejected';

export interface DemoQuote extends QuoteDraft {
  status: DemoQuoteStatus;
}

export interface DemoSession {
  id: string;
  lead: LeadRow;
  messages: ConversationRow[];
  quote: DemoQuote | null;
  createdAt: string;
}

const sessions = new Map<string, DemoSession>();

/** The seeded catalog as PackageRow[] (stable fake ids), built once. */
export const DEMO_PACKAGES: PackageRow[] = PACKAGES.map((p, i) => ({
  id: `pkg_${i + 1}`,
  name: p.name,
  segment: p.segment,
  duration_days: p.durationDays,
  base_price_usd: p.basePriceUsd,
  destinations: p.destinations,
  summary: p.summary ?? null,
  active: true,
  created_at: new Date().toISOString(),
}));

/** A blank lead, same shape the real code uses. */
function emptyLead(): LeadRow {
  const now = new Date().toISOString();
  return {
    id: `lead_${Math.random().toString(36).slice(2, 10)}`,
    created_at: now,
    updated_at: now,
    source: 'whatsapp',
    whatsapp_number: '+10000000000',
    name: null,
    nationality: null,
    city: null,
    segment: null,
    num_people: null,
    start_date: null,
    end_date: null,
    budget_usd: null,
    luxury_level: null,
    destinations: [],
    hotel_pref: null,
    transport_pref: null,
    dietary: null,
    visa_help: false,
    special_requests: null,
    status: 'new',
    lead_score: [],
    last_inbound_at: null,
    last_outbound_at: null,
    assigned_package_id: null,
  };
}

/** Get an existing session or create a fresh one. */
export function getOrCreateSession(id: string): DemoSession {
  let s = sessions.get(id);
  if (!s) {
    s = { id, lead: emptyLead(), messages: [], quote: null, createdAt: new Date().toISOString() };
    sessions.set(id, s);
  }
  return s;
}

/** Reset a session back to a blank slate. */
export function resetSession(id: string): DemoSession {
  const s: DemoSession = {
    id,
    lead: emptyLead(),
    messages: [],
    quote: null,
    createdAt: new Date().toISOString(),
  };
  sessions.set(id, s);
  return s;
}

/** Append a message to a session's history. */
export function addMessage(
  session: DemoSession,
  role: ConversationRow['role'],
  body: string,
): void {
  session.messages.push({
    id: `msg_${session.messages.length + 1}`,
    lead_id: session.lead.id,
    role,
    channel: 'whatsapp',
    body,
    twilio_sid: null,
    created_at: new Date().toISOString(),
  });
}

/**
 * Merge qualifier output into the lead — mirrors updateLeadQualification:
 * never overwrites a known value with null/empty; status is always applied.
 */
export function applyPatch(lead: LeadRow, patch: LeadQualificationPatch): void {
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'status') {
      if (value) lead.status = value as LeadRow['status'];
      continue;
    }
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lead as any)[key] = value;
  }
  lead.updated_at = new Date().toISOString();
}
