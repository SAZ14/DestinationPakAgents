/**
 * Anthropic (Claude) client.
 *
 * Model is env-driven (ANTHROPIC_MODEL) so it can be tuned without code changes.
 * An optional ANTHROPIC_BASE_URL lets us point the SDK at any Anthropic-compatible
 * provider (e.g. z.ai / GLM: https://api.z.ai/api/anthropic) — same code, same
 * agents, just a different backend.
 *
 * Used by the agents (qualifier now; quote/recovery/command parser later).
 */

import Anthropic from '@anthropic-ai/sdk';
import { requireAnthropic } from '../../config/env';

let cached: { client: Anthropic; model: string } | null = null;

export function getAnthropic(): { client: Anthropic; model: string } {
  if (cached) return cached;
  const { apiKey, model, baseUrl } = requireAnthropic();
  cached = { client: new Anthropic({ apiKey, ...(baseUrl ? { baseURL: baseUrl } : {}) }), model };
  return cached;
}
