/**
 * Qualifier agent (Step 3).
 *
 * A warm, premium travel concierge for Destination Pakistan. Given a lead, the
 * recent conversation, and the latest inbound message, Claude:
 *   - extracts trip fields,
 *   - classifies the lead into exactly one segment,
 *   - decides whether the required-to-quote minimum is met,
 *   - and writes the next warm, concise reply (1–3 questions).
 *
 * It NEVER confirms bookings, promises availability, quotes prices, or generates
 * itineraries — that is Step 4 (behind human approval). This file owns only
 * qualification + the next reply.
 *
 * Robustness: Claude is asked for JSON only and parsed defensively. If parsing
 * fails we return a safe fallback question so the webhook never crashes.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropic } from '../services/anthropic/client';
import type { LeadQualificationPatch } from '../services/supabase/leads';
import type { ConversationRow, LeadRow, LeadSegment } from '../services/supabase/types';

export const SEGMENTS: readonly LeadSegment[] = [
  'culture',
  'trek',
  'photography',
  'faith',
  'corporate',
] as const;

/** Safe fallback when Claude output cannot be parsed. */
export const FALLBACK_REPLY =
  "Thanks — I'd love to help plan this properly. Could you share your preferred " +
  'travel dates, number of people, and the places in Pakistan you’d like to visit?';

export interface QualifierResult {
  reply: string;
  /** Snake_case patch that maps directly onto lead columns. */
  extractedFields: LeadQualificationPatch;
  segment?: LeadSegment;
  status: 'qualifying' | 'qualified';
  requiredFieldsComplete: boolean;
  confidence: number;
}

// DESTINATION-PAKISTAN SPECIFIC: persona, guardrails, segment rules, and the
// exact JSON contract. Tune tone/rules here.
const SYSTEM_PROMPT = `You are Asaan Intelligence, working for Destination Pakistan, a premium inbound tour operator in Lahore, Pakistan.

Your job is to qualify inbound WhatsApp leads for multi-day Pakistan trips.

Hard rules:
- Never confirm a booking.
- Never promise availability.
- Never quote a final price or invent package prices.
- Never say a human has approved anything.
- Never ask too many questions at once. Ask 1–3 natural questions per message.
- Be warm, premium, trustworthy, calm, concise, and helpful — not a form, not a generic bot.
- If safety is asked ("is Pakistan safe?"), reassure factually and mention planned routes, experienced local guides, and that the team confirms details with a human before anything is finalised.
- If visa/passport help may be relevant, ask whether they need guidance.
- If the traveler seems foreign and nationality is unknown, try to detect it early.

Segment classification — choose exactly ONE primary segment:
- culture: general culture, adventure, heritage, family; Hunza, Skardu, Lahore, Islamabad, Fairy Meadows, Swat, Kashmir, Naran, Chitral.
- trek: K2, Batura, Snow Leopard, expedition, climbing, serious hiking, base camp, high altitude.
- photography: photographers, filmmakers, content creators, documentary, drone/content trips.
- faith: reverts, spiritual journey, Islamic heritage, faith-based travel.
- corporate: company group, bank, corporate retreat, organization, delegation, MICE/group booking.

Required-to-quote minimum:
dates or month, number of people, destination/trip type, rough budget, and a segment.

When the required-to-quote minimum is met, set requiredFieldsComplete=true and status="qualified". In the reply, tell the traveler the team now has enough to prepare a draft itinerary and quote for internal review — DO NOT quote prices and DO NOT present an itinerary.

If the customer gives a month but no exact dates, leave start_date and end_date null and mention the month in the reply (you may note it in special_requests). Never fabricate exact dates.

Output contract — respond with ONLY a single JSON object, no markdown, no code fences, no text before or after:
{
  "reply": string,                       // the WhatsApp message to send back
  "extractedFields": {
    "name": string | null,
    "nationality": string | null,
    "city": string | null,
    "segment": "culture" | "trek" | "photography" | "faith" | "corporate" | null,
    "num_people": number | null,
    "start_date": string | null,         // YYYY-MM-DD or null
    "end_date": string | null,           // YYYY-MM-DD or null
    "budget_usd": number | null,         // numeric only, no currency symbols
    "luxury_level": string | null,       // e.g. "budget" | "standard" | "premium" | "luxury"
    "destinations": string[] | null,
    "hotel_pref": string | null,
    "transport_pref": string | null,
    "dietary": string | null,
    "visa_help": boolean | null,
    "special_requests": string | null
  },
  "requiredFieldsComplete": boolean,
  "status": "qualifying" | "qualified",
  "confidence": number                   // 0..1, your confidence in the extraction
}

Only include fields you actually learned (use null otherwise). Do not overwrite previously known facts with guesses.`;

/** Compact snapshot of what we already know, so Claude doesn't re-ask. */
function knownFields(lead: LeadRow): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  const fields: (keyof LeadRow)[] = [
    'name',
    'nationality',
    'city',
    'segment',
    'num_people',
    'start_date',
    'end_date',
    'budget_usd',
    'luxury_level',
    'destinations',
    'hotel_pref',
    'transport_pref',
    'dietary',
    'visa_help',
    'special_requests',
    'status',
  ];
  for (const f of fields) {
    const v = lead[f];
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    snapshot[f] = v;
  }
  return snapshot;
}

function transcript(messages: ConversationRow[]): string {
  if (messages.length === 0) return '(no prior messages)';
  const label: Record<string, string> = {
    customer: 'Customer',
    agent: 'Concierge',
    staff: 'Staff',
  };
  return messages.map((m) => `${label[m.role] ?? m.role}: ${m.body}`).join('\n');
}

/** Pull a JSON object out of a model response, tolerating fences / stray text. */
function extractJson(text: string): unknown {
  let t = text.trim();
  // Strip ```json ... ``` or ``` ... ``` fences if present.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON object found');
  return JSON.parse(t.slice(start, end + 1));
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}
function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}
function asBool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}
function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const arr = v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((s) => s.trim());
  return arr.length > 0 ? arr : undefined;
}
function asSegment(v: unknown): LeadSegment | undefined {
  return typeof v === 'string' && (SEGMENTS as readonly string[]).includes(v)
    ? (v as LeadSegment)
    : undefined;
}

/** Normalize Claude's extractedFields into a clean snake_case patch. */
function normalizeExtracted(raw: unknown): LeadQualificationPatch {
  const o = (raw ?? {}) as Record<string, unknown>;
  const patch: LeadQualificationPatch = {};
  const set = <K extends keyof LeadQualificationPatch>(
    k: K,
    v: LeadQualificationPatch[K] | undefined,
  ): void => {
    if (v !== undefined) patch[k] = v;
  };

  set('name', asString(o.name));
  set('nationality', asString(o.nationality));
  set('city', asString(o.city));
  set('segment', asSegment(o.segment));
  set('num_people', asNumber(o.num_people));
  set('start_date', asString(o.start_date));
  set('end_date', asString(o.end_date));
  set('budget_usd', asNumber(o.budget_usd));
  set('luxury_level', asString(o.luxury_level));
  set('destinations', asStringArray(o.destinations));
  set('hotel_pref', asString(o.hotel_pref));
  set('transport_pref', asString(o.transport_pref));
  set('dietary', asString(o.dietary));
  set('visa_help', asBool(o.visa_help));
  set('special_requests', asString(o.special_requests));
  return patch;
}

/**
 * Qualify a lead and produce the next reply. Always resolves (never throws):
 * on any model/parse failure it returns the safe fallback.
 */
export async function qualifyLead(input: {
  lead: LeadRow;
  recentMessages: ConversationRow[];
  inboundMessage: string;
}): Promise<QualifierResult> {
  const userContent =
    `CURRENT LEAD RECORD (already known — do not re-ask these):\n` +
    `${JSON.stringify(knownFields(input.lead), null, 2)}\n\n` +
    `CONVERSATION HISTORY (oldest first):\n${transcript(input.recentMessages)}\n\n` +
    `LATEST CUSTOMER MESSAGE:\n${input.inboundMessage}\n\n` +
    `Return the JSON object now.`;

  try {
    // Inside the try so any config/SDK failure degrades to the safe fallback
    // rather than throwing into the webhook.
    const { client, model } = getAnthropic();
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const parsed = extractJson(text) as Record<string, unknown>;

    const reply = asString(parsed.reply) ?? FALLBACK_REPLY;
    const extractedFields = normalizeExtracted(parsed.extractedFields);
    const requiredFieldsComplete = parsed.requiredFieldsComplete === true;
    // Single source of truth: derive status from completeness.
    const status: 'qualifying' | 'qualified' = requiredFieldsComplete ? 'qualified' : 'qualifying';
    const confidence = (() => {
      const c = asNumber(parsed.confidence);
      if (c === undefined) return 0.5;
      return Math.min(1, Math.max(0, c));
    })();

    return {
      reply,
      extractedFields,
      segment: extractedFields.segment ?? undefined,
      status,
      requiredFieldsComplete,
      confidence,
    };
  } catch (err) {
    console.error(
      '[qualifier] model/parse failure — using fallback:',
      err instanceof Error ? err.message : err,
    );
    return {
      reply: FALLBACK_REPLY,
      extractedFields: {},
      status: 'qualifying',
      requiredFieldsComplete: false,
      confidence: 0,
    };
  }
}
