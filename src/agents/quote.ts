/**
 * Quote agent (Step 4).
 *
 * Given a QUALIFIED lead, this agent:
 *   1. Matches the best seeded Destination Pakistan package (pure logic — no AI,
 *      no invented products or prices).
 *   2. Asks Claude to draft a personalised day-by-day itinerary (markdown) and a
 *      short, warm WhatsApp quote message.
 *   3. Returns a draft for the webhook to persist as `awaiting_approval`.
 *
 * Hard rules (consistent with the qualifier):
 *   - The price ALWAYS comes from the seeded catalog. Claude is never asked to
 *     price anything. If the lead's budget can't be met by any catalog package,
 *     we still draft against the closest one but flag `needsHumanPricing` so a
 *     human sets the real number before the customer sees it.
 *   - Nothing here is sent to the customer. The webhook routes the draft to
 *     staff for approval first.
 *
 * Robustness: Claude is asked for JSON only and parsed defensively. On any
 * failure we fall back to a deterministic itinerary built from the package
 * summary so a quote draft is always produced.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropic } from '../services/anthropic/client';
import type { LeadRow, PackageRow } from '../services/supabase/types';

export interface QuoteDraft {
  packageId: string | null;
  packageName: string | null;
  /** Per-person catalog price (USD). Null only if no package matched at all. */
  priceUsd: number | null;
  itineraryMd: string;
  /** Short WhatsApp message a staff member can approve and forward as-is. */
  quoteMessage: string;
  needsHumanPricing: boolean;
  /** Human-readable note on the match (shown to staff, not the customer). */
  matchNote: string;
}

// ---------------------------------------------------------------------------
// Package matching — pure, deterministic, catalog-only.
// ---------------------------------------------------------------------------

interface MatchResult {
  pkg: PackageRow | null;
  needsHumanPricing: boolean;
  note: string;
}

/** Overlap count between two destination lists (case-insensitive). */
function destinationOverlap(a: string[], b: string[]): number {
  const setB = new Set(b.map((d) => d.toLowerCase().trim()));
  return a.reduce((n, d) => (setB.has(d.toLowerCase().trim()) ? n + 1 : n), 0);
}

/**
 * Score a package against a lead. Higher is better. Segment match is the
 * strongest signal, then destination overlap, then duration proximity. Budget
 * is handled separately (it flags human pricing rather than excluding a match).
 */
function scorePackage(lead: LeadRow, pkg: PackageRow): number {
  let score = 0;
  if (lead.segment && pkg.segment === lead.segment) score += 100;

  score += destinationOverlap(lead.destinations ?? [], pkg.destinations) * 20;

  // Duration proximity: prefer packages close to the requested trip length.
  if (lead.start_date && lead.end_date) {
    const days =
      Math.round(
        (new Date(lead.end_date).getTime() - new Date(lead.start_date).getTime()) /
          86_400_000,
      ) + 1;
    if (days > 0) score += Math.max(0, 15 - Math.abs(pkg.duration_days - days));
  }
  return score;
}

/**
 * Pick the best catalog package for a lead.
 *
 * Budget note: catalog prices are per-person "from". If the lead's budget is
 * below the matched package price, we still return that package but flag
 * `needsHumanPricing` so staff can decide (discount, downscale, or decline)
 * before the customer is quoted.
 */
export function matchPackage(lead: LeadRow, packages: PackageRow[]): MatchResult {
  if (packages.length === 0) {
    return { pkg: null, needsHumanPricing: true, note: 'No packages in catalog.' };
  }

  // Prefer same-segment candidates; fall back to the whole catalog if none.
  const sameSegment = lead.segment ? packages.filter((p) => p.segment === lead.segment) : [];
  const pool = sameSegment.length > 0 ? sameSegment : packages;

  const best = pool
    .map((p) => ({ p, s: scorePackage(lead, p) }))
    .sort((a, b) => b.s - a.s)[0]!.p;

  const notes: string[] = [];
  if (sameSegment.length === 0 && lead.segment) {
    notes.push(`No exact "${lead.segment}" package; matched closest available.`);
  }

  let needsHumanPricing = false;
  if (lead.budget_usd != null && lead.budget_usd < best.base_price_usd) {
    needsHumanPricing = true;
    notes.push(
      `Lead budget ~$${lead.budget_usd}/pp is below "${best.name}" from $${best.base_price_usd}/pp — needs human pricing.`,
    );
  }
  if (notes.length === 0) notes.push(`Matched "${best.name}" (from $${best.base_price_usd}/pp).`);

  return { pkg: best, needsHumanPricing, note: notes.join(' ') };
}

// ---------------------------------------------------------------------------
// Itinerary drafting (Claude).
// ---------------------------------------------------------------------------

export const QUOTE_SYSTEM_PROMPT = `You are Asaan Intelligence, drafting a travel quote for Destination Pakistan, a premium inbound tour operator in Lahore.

You are given ONE matched package from the company's real catalog, plus what we know about the lead. Draft TWO things for INTERNAL STAFF REVIEW (a human approves before the customer ever sees it):

1. A day-by-day itinerary in clean markdown, tailored to the lead (their destinations, group size, segment, dates/month, dietary needs, special requests). Use the package's duration and destinations as the backbone. Keep it concrete and inviting but realistic for northern Pakistan travel.

2. A short, warm WhatsApp quote message (4–8 lines) the staff member can forward as-is.

ABSOLUTE rules:
- Use ONLY the price provided to you. Never invent, discount, or change a price. If a "needsHumanPricing" flag is set, do NOT state any price in the quote message — instead say the team is confirming the best price for their budget and will share it shortly.
- Never confirm a booking or promise availability. Frame it as a proposed itinerary and quote for them to review.
- Never claim a human has approved anything.
- Quote prices are per person in USD, described as "from" (starting) prices.
- Do not fabricate exact dates if only a month is known — refer to the month.

Output contract — respond with ONLY a single JSON object, no markdown fences, no text before or after:
{
  "itineraryMd": string,     // markdown, day-by-day
  "quoteMessage": string     // the WhatsApp message to (later) send the customer
}`;

function leadFacts(lead: LeadRow): Record<string, unknown> {
  return {
    name: lead.name,
    nationality: lead.nationality,
    num_people: lead.num_people,
    start_date: lead.start_date,
    end_date: lead.end_date,
    budget_usd_per_person: lead.budget_usd,
    luxury_level: lead.luxury_level,
    destinations: lead.destinations,
    hotel_pref: lead.hotel_pref,
    transport_pref: lead.transport_pref,
    dietary: lead.dietary,
    visa_help: lead.visa_help,
    special_requests: lead.special_requests,
    segment: lead.segment,
  };
}

/** Pull a JSON object out of a model response, tolerating fences / stray text. */
function extractJson(text: string): Record<string, unknown> {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON object found');
  return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
}

/** Deterministic fallback itinerary so a draft always exists, even if Claude fails. */
function fallbackDraft(lead: LeadRow, pkg: PackageRow | null, needsHumanPricing: boolean): {
  itineraryMd: string;
  quoteMessage: string;
} {
  if (!pkg) {
    return {
      itineraryMd:
        '_No catalog package matched. Staff to build a custom itinerary and price manually._',
      quoteMessage:
        'Thank you! Your trip looks a little bespoke — our team is putting together a tailored plan and will share it with you shortly.',
    };
  }
  const who = lead.name ? `${lead.name}, ` : '';
  const priceLine = needsHumanPricing
    ? 'Our team is confirming the best price for your budget and will share it shortly.'
    : `Pricing starts from $${pkg.base_price_usd} per person.`;
  return {
    itineraryMd:
      `# ${pkg.name}\n\n` +
      `**Duration:** ${pkg.duration_days} days\n\n` +
      `**Destinations:** ${pkg.destinations.join(', ')}\n\n` +
      `${pkg.summary ?? ''}\n\n` +
      `_Full day-by-day itinerary to be finalised by the team._`,
    quoteMessage:
      `Hi ${who}thanks for reaching out to Destination Pakistan! ` +
      `Based on what you shared, we'd recommend our "${pkg.name}" — ` +
      `${pkg.duration_days} days across ${pkg.destinations.join(', ')}. ` +
      `${priceLine} ` +
      `This is a proposed plan for you to review — shall we tailor it further?`,
  };
}

/**
 * Produce a quote draft for a qualified lead. Always resolves (never throws):
 * on model/parse failure it returns a deterministic fallback draft.
 */
export async function draftQuote(input: {
  lead: LeadRow;
  packages: PackageRow[];
}): Promise<QuoteDraft> {
  const { lead, packages } = input;
  const match = matchPackage(lead, packages);
  const pkg = match.pkg;

  // Price is always the catalog price (or null if nothing matched).
  const priceUsd = pkg ? pkg.base_price_usd : null;

  if (!pkg) {
    const fb = fallbackDraft(lead, null, true);
    return {
      packageId: null,
      packageName: null,
      priceUsd: null,
      itineraryMd: fb.itineraryMd,
      quoteMessage: fb.quoteMessage,
      needsHumanPricing: true,
      matchNote: match.note,
    };
  }

  const userContent =
    `MATCHED PACKAGE (catalog — use this price only):\n` +
    `${JSON.stringify(
      {
        name: pkg.name,
        segment: pkg.segment,
        duration_days: pkg.duration_days,
        price_usd_per_person_from: pkg.base_price_usd,
        destinations: pkg.destinations,
        summary: pkg.summary,
      },
      null,
      2,
    )}\n\n` +
    `needsHumanPricing: ${match.needsHumanPricing}\n\n` +
    `LEAD (tailor the itinerary to this):\n${JSON.stringify(leadFacts(lead), null, 2)}\n\n` +
    `Return the JSON object now.`;

  try {
    const { client, model } = getAnthropic();
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: QUOTE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const parsed = extractJson(text);
    const itineraryMd =
      typeof parsed.itineraryMd === 'string' && parsed.itineraryMd.trim() !== ''
        ? parsed.itineraryMd.trim()
        : fallbackDraft(lead, pkg, match.needsHumanPricing).itineraryMd;
    const quoteMessage =
      typeof parsed.quoteMessage === 'string' && parsed.quoteMessage.trim() !== ''
        ? parsed.quoteMessage.trim()
        : fallbackDraft(lead, pkg, match.needsHumanPricing).quoteMessage;

    return {
      packageId: pkg.id,
      packageName: pkg.name,
      priceUsd,
      itineraryMd,
      quoteMessage,
      needsHumanPricing: match.needsHumanPricing,
      matchNote: match.note,
    };
  } catch (err) {
    console.error(
      '[quote] model/parse failure — using fallback draft:',
      err instanceof Error ? err.message : err,
    );
    const fb = fallbackDraft(lead, pkg, match.needsHumanPricing);
    return {
      packageId: pkg.id,
      packageName: pkg.name,
      priceUsd,
      itineraryMd: fb.itineraryMd,
      quoteMessage: fb.quoteMessage,
      needsHumanPricing: match.needsHumanPricing,
      matchNote: match.note,
    };
  }
}
