/**
 * Hand-written row types mirroring supabase/migrations/0001_init.sql.
 *
 * Kept in sync manually for v1 (small schema). If the schema grows, switch to
 * `supabase gen types typescript` and replace this file.
 */

export type LeadSegment = 'culture' | 'trek' | 'photography' | 'faith' | 'corporate';

export type LeadStatus =
  | 'new'
  | 'qualifying'
  | 'qualified' // added in migration 0002 — required-to-quote minimum reached
  | 'quoted'
  | 'awaiting_approval'
  | 'sent'
  | 'booked'
  | 'dormant'
  | 'lost';

export type LeadSource = 'whatsapp' | 'instagram' | 'website' | 'email';

export type ConversationRole = 'customer' | 'agent' | 'staff';

export type QuoteStatus = 'draft' | 'awaiting_approval' | 'approved' | 'rejected' | 'sent';

export type FollowupType = 'hot' | 'warm' | 'dormant' | 'urgent';

export type FollowupStatus = 'draft' | 'awaiting_approval' | 'approved' | 'sent' | 'skipped';

export type StaffRole = 'approver' | 'admin';

/** Score tags can include the followup buckets plus value/urgency flags. */
export type LeadScoreTag = 'hot' | 'warm' | 'dormant' | 'urgent' | 'high_value';

export interface PackageRow {
  id: string;
  name: string;
  segment: LeadSegment;
  duration_days: number;
  base_price_usd: number;
  destinations: string[];
  summary: string | null;
  active: boolean;
  created_at: string;
}

export interface StaffRow {
  id: string;
  name: string;
  whatsapp_number: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
}

export interface LeadRow {
  id: string;
  created_at: string;
  updated_at: string;
  source: LeadSource;
  whatsapp_number: string;
  name: string | null;
  nationality: string | null;
  city: string | null;
  segment: LeadSegment | null;
  num_people: number | null;
  start_date: string | null;
  end_date: string | null;
  budget_usd: number | null;
  luxury_level: string | null;
  destinations: string[];
  hotel_pref: string | null;
  transport_pref: string | null;
  dietary: string | null;
  visa_help: boolean;
  special_requests: string | null;
  status: LeadStatus;
  lead_score: string[];
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  assigned_package_id: string | null;
}

export interface ConversationRow {
  id: string;
  lead_id: string | null;
  role: ConversationRole;
  channel: string;
  body: string;
  twilio_sid: string | null;
  created_at: string;
}

export interface QuoteRow {
  id: string;
  lead_id: string;
  package_id: string | null;
  itinerary_md: string | null;
  quote_message: string | null;
  price_usd: number | null;
  status: QuoteStatus;
  approved_by: string | null;
  needs_human_pricing: boolean;
  created_at: string;
  updated_at: string;
}

export interface FollowupRow {
  id: string;
  lead_id: string;
  type: FollowupType;
  draft_body: string;
  status: FollowupStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  approved_by: string | null;
  created_at: string;
}
