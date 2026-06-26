/**
 * Quote persistence helpers.
 *
 * Human-in-the-loop: the quote agent only ever writes rows in
 * `awaiting_approval`. A staff member flips it to `approved` (or `rejected`)
 * from WhatsApp; the send step flips it to `sent`. Nothing reaches the customer
 * until a human approves.
 */

import { getSupabase } from './client';
import type { QuoteRow, QuoteStatus } from './types';

export interface CreateQuoteInput {
  leadId: string;
  packageId: string | null;
  itineraryMd: string | null;
  quoteMessage: string | null;
  priceUsd: number | null;
  needsHumanPricing: boolean;
  /** Defaults to 'awaiting_approval' — drafts are immediately staff-gated. */
  status?: QuoteStatus;
}

/** Insert a new quote (default status `awaiting_approval`) and return it. */
export async function createQuote(input: CreateQuoteInput): Promise<QuoteRow> {
  const { data, error } = await getSupabase()
    .from('quotes')
    .insert({
      lead_id: input.leadId,
      package_id: input.packageId,
      itinerary_md: input.itineraryMd,
      quote_message: input.quoteMessage,
      price_usd: input.priceUsd,
      needs_human_pricing: input.needsHumanPricing,
      status: input.status ?? 'awaiting_approval',
    })
    .select('*')
    .single();

  if (error) throw new Error(`createQuote failed: ${error.message}`);
  return data as QuoteRow;
}

/** Fetch one quote by id. Returns null if not found. */
export async function getQuoteById(id: string): Promise<QuoteRow | null> {
  const { data, error } = await getSupabase()
    .from('quotes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getQuoteById failed: ${error.message}`);
  return (data as QuoteRow | null) ?? null;
}

/**
 * The most recent quote still awaiting approval for a lead. Used by the staff
 * approval router to resolve "approve quote for <lead>" to a concrete quote.
 */
export async function getPendingQuoteForLead(leadId: string): Promise<QuoteRow | null> {
  const { data, error } = await getSupabase()
    .from('quotes')
    .select('*')
    .eq('lead_id', leadId)
    .eq('status', 'awaiting_approval')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getPendingQuoteForLead failed: ${error.message}`);
  return (data as QuoteRow | null) ?? null;
}

/**
 * The single most-recent quote awaiting approval across ALL leads. In the pilot
 * (low volume, one approval at a time) this lets a staff member just reply
 * "approve" without naming the lead.
 */
export async function getLatestPendingQuote(): Promise<QuoteRow | null> {
  const { data, error } = await getSupabase()
    .from('quotes')
    .select('*')
    .eq('status', 'awaiting_approval')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestPendingQuote failed: ${error.message}`);
  return (data as QuoteRow | null) ?? null;
}

/** Count of quotes still awaiting approval — to disambiguate a bare "approve". */
export async function countPendingQuotes(): Promise<number> {
  const { count, error } = await getSupabase()
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'awaiting_approval');
  if (error) throw new Error(`countPendingQuotes failed: ${error.message}`);
  return count ?? 0;
}

/** Update a quote's status (and optionally who approved it). Returns the row. */
export async function updateQuoteStatus(
  quoteId: string,
  status: QuoteStatus,
  approvedBy?: string | null,
): Promise<QuoteRow> {
  const patch: Record<string, unknown> = { status };
  if (approvedBy !== undefined) patch.approved_by = approvedBy;

  const { data, error } = await getSupabase()
    .from('quotes')
    .update(patch)
    .eq('id', quoteId)
    .select('*')
    .single();
  if (error) throw new Error(`updateQuoteStatus failed: ${error.message}`);
  return data as QuoteRow;
}
