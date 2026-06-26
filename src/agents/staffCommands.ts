/**
 * Staff command handler (Step 4 slice).
 *
 * Inbound WhatsApp messages from an authorized staff number (see services/staff.ts)
 * are routed here instead of to the customer qualifier. For Step 4 the vocabulary
 * is intentionally small — the quote approval loop:
 *
 *   APPROVE                  → approve the single pending quote and send it
 *   APPROVE <name>           → approve the pending quote for the named lead
 *   REJECT  [name]           → reject the pending quote (lead stays qualified)
 *   HELP                     → list commands
 *
 * The broader admin command set ("show today's hot leads", "follow up all
 * Skardu leads", …) is a later step; this file is structured so those intents
 * slot in alongside the approval ones.
 */

import { sendWhatsAppMessage } from '../services/twilio/client';
import { logConversation } from '../services/supabase/conversations';
import {
  findLeadsByNameLike,
  getLeadById,
  updateLeadQualification,
} from '../services/supabase/leads';
import {
  getLatestPendingQuote,
  getPendingQuoteForLead,
  countPendingQuotes,
  updateQuoteStatus,
} from '../services/supabase/quotes';
import { staffApproverNumbers } from '../services/staff';
import type { LeadRow, QuoteRow } from '../services/supabase/types';

const HELP_TEXT =
  'Asaan staff commands:\n' +
  '• APPROVE — approve & send the pending quote\n' +
  '• APPROVE <name> — approve the quote for a specific lead\n' +
  '• REJECT [name] — reject the pending quote\n' +
  '• HELP — show this message';

type Intent =
  | { kind: 'approve'; name: string | null }
  | { kind: 'reject'; name: string | null }
  | { kind: 'help' }
  | { kind: 'unknown' };

/** Parse a staff message into an intent. Deterministic — no AI needed yet. */
export function parseStaffCommand(message: string): Intent {
  const text = message.trim();
  const lower = text.toLowerCase();

  if (lower === 'help' || lower === '?') return { kind: 'help' };

  // "approve [quote] [for] <name>"
  const approve = lower.match(/^approve(?:\s+quote)?(?:\s+for)?\s*(.*)$/);
  if (approve) return { kind: 'approve', name: cleanName(approve[1]) };

  const reject = lower.match(/^reject(?:\s+quote)?(?:\s+for)?\s*(.*)$/);
  if (reject) return { kind: 'reject', name: cleanName(reject[1]) };

  return { kind: 'unknown' };
}

function cleanName(raw: string | undefined): string | null {
  const n = (raw ?? '').trim();
  return n === '' ? null : n;
}

/**
 * Resolve the pending quote a staff command refers to.
 * Returns the quote + its lead, or an error message to send back to staff.
 */
async function resolvePendingQuote(
  name: string | null,
): Promise<{ quote: QuoteRow; lead: LeadRow } | { error: string }> {
  if (name) {
    const matches = await findLeadsByNameLike(name, 5);
    if (matches.length > 1) {
      const names = matches.map((l) => l.name ?? l.whatsapp_number).join(', ');
      return { error: `Multiple leads match "${name}": ${names}. Be more specific.` };
    }
    const lead = matches[0];
    if (!lead) return { error: `No lead found matching "${name}".` };
    const quote = await getPendingQuoteForLead(lead.id);
    if (!quote) return { error: `No pending quote for ${lead.name ?? name}.` };
    return { quote, lead };
  }

  // No name given — only works when exactly one quote is pending.
  const pending = await countPendingQuotes();
  if (pending === 0) return { error: 'No quotes are pending approval right now.' };
  if (pending > 1) {
    return {
      error: `${pending} quotes are pending. Reply "APPROVE <name>" to choose one.`,
    };
  }
  const quote = await getLatestPendingQuote();
  if (!quote) return { error: 'No pending quote found.' };
  const lead = await getLeadById(quote.lead_id);
  if (!lead) return { error: 'Pending quote has no lead record.' };
  return { quote, lead };
}

/**
 * Handle an inbound staff message. Returns the reply to send back to the staff
 * member. Side effects (sending the quote to the customer, status flips) happen
 * here. Never throws — failures become a readable staff reply.
 */
export async function handleStaffMessage(input: {
  staffNumber: string;
  message: string;
}): Promise<string> {
  const intent = parseStaffCommand(input.message);

  switch (intent.kind) {
    case 'help':
      return HELP_TEXT;

    case 'approve': {
      const resolved = await resolvePendingQuote(intent.name);
      if ('error' in resolved) return resolved.error;
      const { quote, lead } = resolved;

      if (quote.needs_human_pricing && quote.price_usd == null) {
        return (
          `Quote for ${lead.name ?? lead.whatsapp_number} needs a human price before sending ` +
          `(${matchPriceHint(quote)}). Set the price, then approve.`
        );
      }

      // Send the customer-facing quote message, then the itinerary.
      await sendWhatsAppMessage(lead.whatsapp_number, customerQuoteText(quote));
      const { sid } = await sendWhatsAppMessage(
        lead.whatsapp_number,
        quote.itinerary_md ?? '(itinerary to follow)',
      );

      await updateQuoteStatus(quote.id, 'sent', input.staffNumber);
      await updateLeadQualification(lead.id, { status: 'sent' });
      await logConversation({
        leadId: lead.id,
        role: 'agent',
        body: customerQuoteText(quote),
        twilioSid: sid,
      });

      return `✅ Approved & sent to ${lead.name ?? lead.whatsapp_number}.`;
    }

    case 'reject': {
      const resolved = await resolvePendingQuote(intent.name);
      if ('error' in resolved) return resolved.error;
      const { quote, lead } = resolved;
      await updateQuoteStatus(quote.id, 'rejected', input.staffNumber);
      // Keep the lead qualified so a fresh quote can be drafted.
      await updateLeadQualification(lead.id, { status: 'qualified' });
      return `🚫 Rejected quote for ${lead.name ?? lead.whatsapp_number}. Lead kept as qualified.`;
    }

    default:
      return `Sorry, I didn't recognise that.\n\n${HELP_TEXT}`;
  }
}

/**
 * What we forward to the customer when a quote is approved: the exact warm
 * message the staff member reviewed (drafted by the quote agent and stored on
 * the quote). Falls back to a safe generic intro if it's missing.
 */
function customerQuoteText(quote: QuoteRow): string {
  if (quote.quote_message && quote.quote_message.trim() !== '') return quote.quote_message;
  const price =
    quote.price_usd != null ? ` Pricing starts from $${quote.price_usd} per person.` : '';
  return (
    'Thank you for your patience — here is a proposed itinerary from Destination Pakistan for ' +
    'you to review.' +
    price +
    ' Let us know what you’d like to adjust and we’ll tailor it for you.'
  );
}

function matchPriceHint(quote: QuoteRow): string {
  return quote.price_usd != null ? `current draft price $${quote.price_usd}/pp` : 'no price set';
}

/**
 * Notify all staff approvers that a new quote draft is awaiting approval.
 * Called by the webhook right after a quote is drafted for a qualified lead.
 * Best-effort: failures are logged, not thrown.
 */
export async function notifyStaffNewQuote(input: {
  lead: LeadRow;
  quote: QuoteRow;
  packageName: string | null;
  matchNote: string;
}): Promise<void> {
  const { lead, quote, packageName, matchNote } = input;
  const approvers = staffApproverNumbers();
  if (approvers.length === 0) {
    console.warn('[staff] no STAFF_APPROVER_NUMBERS configured — quote drafted but nobody notified.');
    return;
  }

  const priceLine = quote.needs_human_pricing
    ? '⚠️ Needs human pricing'
    : quote.price_usd != null
      ? `From $${quote.price_usd}/pp`
      : 'Price: n/a';

  const summary =
    `🆕 New quote awaiting approval\n` +
    `Lead: ${lead.name ?? lead.whatsapp_number}` +
    (lead.nationality ? ` (${lead.nationality})` : '') +
    `\nTrip: ${packageName ?? 'custom'}` +
    (lead.num_people ? ` · ${lead.num_people} pax` : '') +
    `\n${priceLine}\n` +
    `Note: ${matchNote}\n\n` +
    `Reply "APPROVE" to send, or "REJECT".`;

  for (const number of approvers) {
    try {
      await sendWhatsAppMessage(number, summary);
    } catch (err) {
      console.error(
        `[staff] failed to notify ${number}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
