/**
 * Centralised, validated environment config.
 *
 * All secrets live in `.env` (never hardcoded). Importing this module loads and
 * validates the environment exactly once. Anything missing that is required for
 * the requested operation throws early with a clear message.
 *
 * We intentionally do NOT hard-require every key at import time, because some
 * scripts (e.g. the seed) only need Supabase, while the webhook server needs
 * Twilio + Anthropic too. Use the `require*()` helpers at the point of use.
 */

import * as dotenv from 'dotenv';

dotenv.config();

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

function bool(name: string, fallback = false): boolean {
  const v = optional(name);
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

/** Parse a comma-separated list into a trimmed, de-duped array. */
function list(name: string): string[] {
  const v = optional(name);
  if (!v) return [];
  return Array.from(
    new Set(
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

export const env = {
  // Server
  port: Number(optional('PORT') ?? 3000),
  publicBaseUrl: optional('PUBLIC_BASE_URL') ?? 'http://localhost:3000',
  // Exact public base URL Twilio uses to reach the webhook (your ngrok/tunnel
  // URL). Used to validate Twilio request signatures. Falls back to
  // publicBaseUrl when unset.
  publicWebhookBaseUrl: optional('PUBLIC_WEBHOOK_BASE_URL'),
  skipTwilioSignatureValidation: bool('SKIP_TWILIO_SIGNATURE_VALIDATION', true),

  // Supabase
  supabaseUrl: optional('SUPABASE_URL'),
  supabaseServiceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY'),

  // Twilio
  twilioAccountSid: optional('TWILIO_ACCOUNT_SID'),
  twilioAuthToken: optional('TWILIO_AUTH_TOKEN'),
  twilioWhatsappFrom: optional('TWILIO_WHATSAPP_FROM') ?? 'whatsapp:+14155238886',

  // Anthropic (or any Anthropic-compatible provider, e.g. z.ai / GLM).
  anthropicApiKey: optional('ANTHROPIC_API_KEY'),
  anthropicModel: optional('ANTHROPIC_MODEL') ?? 'claude-opus-4-8',
  // Optional custom base URL. Point this at an Anthropic-compatible endpoint to
  // use a different provider, e.g. z.ai: https://api.z.ai/api/anthropic
  anthropicBaseUrl: optional('ANTHROPIC_BASE_URL'),

  // Staff
  staffApproverNumbers: list('STAFF_APPROVER_NUMBERS'),

  // Business
  defaultCurrency: optional('DEFAULT_CURRENCY') ?? 'USD',
} as const;

/** Throw if any of the named keys are missing. */
function requireKeys(keys: { name: string; value: string | undefined }[]): void {
  const missing = keys.filter((k) => !k.value).map((k) => k.name);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        `Copy .env.example to .env and fill them in.`,
    );
  }
}

export function requireSupabase(): { url: string; serviceRoleKey: string } {
  requireKeys([
    { name: 'SUPABASE_URL', value: env.supabaseUrl },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', value: env.supabaseServiceRoleKey },
  ]);
  return { url: env.supabaseUrl!, serviceRoleKey: env.supabaseServiceRoleKey! };
}

export function requireTwilio(): {
  accountSid: string;
  authToken: string;
  from: string;
} {
  requireKeys([
    { name: 'TWILIO_ACCOUNT_SID', value: env.twilioAccountSid },
    { name: 'TWILIO_AUTH_TOKEN', value: env.twilioAuthToken },
  ]);
  return {
    accountSid: env.twilioAccountSid!,
    authToken: env.twilioAuthToken!,
    from: env.twilioWhatsappFrom,
  };
}

export function requireAnthropic(): { apiKey: string; model: string; baseUrl?: string } {
  requireKeys([{ name: 'ANTHROPIC_API_KEY', value: env.anthropicApiKey }]);
  return { apiKey: env.anthropicApiKey!, model: env.anthropicModel, baseUrl: env.anthropicBaseUrl };
}
