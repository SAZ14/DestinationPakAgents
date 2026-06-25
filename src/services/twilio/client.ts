/**
 * Twilio WhatsApp service.
 *
 * Sandbox-first: the sender is driven by TWILIO_WHATSAPP_FROM (e.g. the sandbox
 * number `whatsapp:+14155238886`). Moving to a production sender is a config
 * change only — no code change.
 *
 * Number normalization: WhatsApp addresses on Twilio are prefixed with
 * `whatsapp:`. Internally we store *normalized* numbers (E.164, no prefix);
 * these helpers convert in both directions so callers can pass either form.
 */

import twilio, { Twilio } from 'twilio';
import { requireTwilio, env } from '../../config/env';

const WHATSAPP_PREFIX = 'whatsapp:';

/** Strip the `whatsapp:` prefix and trim. Safe to call on already-bare numbers. */
export function stripWhatsAppPrefix(value: string): string {
  const v = value.trim();
  return v.startsWith(WHATSAPP_PREFIX) ? v.slice(WHATSAPP_PREFIX.length).trim() : v;
}

/** Ensure a number is in Twilio WhatsApp address form: `whatsapp:+E164`. */
export function toWhatsAppAddress(value: string): string {
  const bare = stripWhatsAppPrefix(value);
  return `${WHATSAPP_PREFIX}${bare}`;
}

let cached: Twilio | null = null;

function getClient(): Twilio {
  if (cached) return cached;
  const { accountSid, authToken } = requireTwilio();
  cached = twilio(accountSid, authToken);
  return cached;
}

/**
 * Send a WhatsApp message via the Twilio REST API.
 *
 * @param to   Destination number. Accepts `+923...` or `whatsapp:+923...`.
 * @param body Message text.
 * @returns The Twilio Message SID.
 */
export async function sendWhatsAppMessage(
  to: string,
  body: string,
): Promise<{ sid: string }> {
  const { from } = requireTwilio();
  const client = getClient();
  const message = await client.messages.create({
    from: toWhatsAppAddress(from),
    to: toWhatsAppAddress(to),
    body,
  });
  return { sid: message.sid };
}

/**
 * Validate that an inbound request genuinely came from Twilio (HMAC of the
 * exact public URL + POST params, keyed by the auth token).
 *
 * Controlled by SKIP_TWILIO_SIGNATURE_VALIDATION. We skip when explicitly told
 * to, or when prerequisites (auth token / signature header) are absent — this
 * keeps the sandbox echo test frictionless while still allowing strict
 * validation in production once PUBLIC_WEBHOOK_BASE_URL is configured exactly.
 */
export function isValidTwilioSignature(
  signatureHeader: string | undefined,
  fullUrl: string,
  params: Record<string, unknown>,
): boolean {
  if (env.skipTwilioSignatureValidation) return true;
  if (!env.twilioAuthToken || !signatureHeader) return false;
  return twilio.validateRequest(env.twilioAuthToken, signatureHeader, fullUrl, params);
}
