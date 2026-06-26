/**
 * Conversation logging helpers.
 *
 * Every inbound/outbound WhatsApp message is appended to `conversations` for a
 * full audit trail. `twilio_sid` is stored for traceability and future dedupe.
 */

import { getSupabase } from './client';
import type { ConversationRole, ConversationRow } from './types';

export interface LogConversationInput {
  leadId: string;
  role: ConversationRole;
  body: string;
  channel?: string; // defaults to 'whatsapp'
  twilioSid?: string | null;
}

/** Append a conversation row and return it. */
export async function logConversation(input: LogConversationInput): Promise<ConversationRow> {
  const { data, error } = await getSupabase()
    .from('conversations')
    .insert({
      lead_id: input.leadId,
      role: input.role,
      channel: input.channel ?? 'whatsapp',
      body: input.body,
      twilio_sid: input.twilioSid ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(`logConversation failed: ${error.message}`);
  return data as ConversationRow;
}

/**
 * Recent conversation history for a lead, returned oldest → newest so it can be
 * fed to Claude in chronological order. Fetches the latest `limit` rows.
 */
export async function getRecentConversationsForLead(
  leadId: string,
  limit = 12,
): Promise<ConversationRow[]> {
  const { data, error } = await getSupabase()
    .from('conversations')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentConversationsForLead failed: ${error.message}`);
  return ((data as ConversationRow[] | null) ?? []).reverse();
}
