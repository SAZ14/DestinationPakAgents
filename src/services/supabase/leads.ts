/**
 * Lead persistence helpers.
 *
 * Numbers are stored *normalized* (E.164, no `whatsapp:` prefix). Callers should
 * strip the prefix (see services/twilio/client.ts -> stripWhatsAppPrefix) before
 * passing a number here.
 */

import { getSupabase } from './client';
import type { LeadRow, LeadSegment, LeadStatus } from './types';

/**
 * The subset of lead columns the qualifier may write. Snake_case so values map
 * straight onto the table. All optional; callers should only pass fields they
 * actually want to set (we never overwrite with null — see updateLeadQualification).
 */
export interface LeadQualificationPatch {
  name?: string | null;
  nationality?: string | null;
  city?: string | null;
  segment?: LeadSegment | null;
  num_people?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  budget_usd?: number | null;
  luxury_level?: string | null;
  destinations?: string[] | null;
  hotel_pref?: string | null;
  transport_pref?: string | null;
  dietary?: string | null;
  visa_help?: boolean | null;
  special_requests?: string | null;
  status?: LeadStatus;
}

/** Find a lead by its normalized WhatsApp number. Returns null if none. */
export async function findLeadByWhatsAppNumber(number: string): Promise<LeadRow | null> {
  const { data, error } = await getSupabase()
    .from('leads')
    .select('*')
    .eq('whatsapp_number', number)
    .maybeSingle();

  if (error) throw new Error(`findLeadByWhatsAppNumber failed: ${error.message}`);
  return (data as LeadRow | null) ?? null;
}

/** Create a brand-new WhatsApp lead in `new` status with inbound activity set. */
export async function createLeadFromWhatsApp(input: {
  number: string;
  profileName?: string | null;
}): Promise<LeadRow> {
  const { data, error } = await getSupabase()
    .from('leads')
    .insert({
      source: 'whatsapp',
      whatsapp_number: input.number,
      name: input.profileName ?? null,
      status: 'new',
      last_inbound_at: new Date().toISOString(),
      // lead_score (tags) defaults to '{}' in the schema.
    })
    .select('*')
    .single();

  if (error) throw new Error(`createLeadFromWhatsApp failed: ${error.message}`);
  return data as LeadRow;
}

/**
 * Record inbound activity on an existing lead.
 *
 * Always bumps `last_inbound_at`. Sets `name` only if the lead currently has no
 * name (we never overwrite a captured name with a WhatsApp profile name).
 */
export async function updateLeadInboundActivity(
  leadId: string,
  profileName?: string | null,
): Promise<void> {
  const supabase = getSupabase();

  const patch: Record<string, unknown> = {
    last_inbound_at: new Date().toISOString(),
  };

  if (profileName && profileName.trim() !== '') {
    // Only fill the name if it's currently empty.
    const { data: existing, error: readErr } = await supabase
      .from('leads')
      .select('name')
      .eq('id', leadId)
      .single();
    if (readErr) throw new Error(`updateLeadInboundActivity read failed: ${readErr.message}`);
    if (!existing?.name) patch.name = profileName.trim();
  }

  const { error } = await supabase.from('leads').update(patch).eq('id', leadId);
  if (error) throw new Error(`updateLeadInboundActivity failed: ${error.message}`);
}

/** Fetch a single lead by id. Returns null if not found. */
export async function getLeadById(leadId: string): Promise<LeadRow | null> {
  const { data, error } = await getSupabase()
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle();
  if (error) throw new Error(`getLeadById failed: ${error.message}`);
  return (data as LeadRow | null) ?? null;
}

/**
 * Apply qualifier output to a lead.
 *
 * Only writes fields explicitly present in `patch`, and NEVER overwrites an
 * existing value with null/empty (the qualifier sends only what it learned this
 * turn; missing info stays missing rather than wiping prior answers). `status`
 * is always applied when provided.
 */
export async function updateLeadQualification(
  leadId: string,
  patch: LeadQualificationPatch,
): Promise<LeadRow> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'status') {
      if (value) update.status = value;
      continue;
    }
    // Skip null/undefined so we don't clobber previously-captured fields.
    if (value === null || value === undefined) continue;
    // Skip empty strings / empty arrays (no signal).
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    update[key] = value;
  }

  const { data, error } = await getSupabase()
    .from('leads')
    .update(update)
    .eq('id', leadId)
    .select('*')
    .single();
  if (error) throw new Error(`updateLeadQualification failed: ${error.message}`);
  return data as LeadRow;
}

/** Record outbound activity (bumps `last_outbound_at`). */
export async function updateLeadOutboundActivity(leadId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('leads')
    .update({ last_outbound_at: new Date().toISOString() })
    .eq('id', leadId);
  if (error) throw new Error(`updateLeadOutboundActivity failed: ${error.message}`);
}
