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
