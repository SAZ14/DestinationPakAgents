/**
 * Anthropic (Claude) client.
 *
 * Model is env-driven (ANTHROPIC_MODEL) so it can be tuned without code changes.
 * Used by the agents (qualifier now; quote/recovery/command parser later).
 */

import Anthropic from '@anthropic-ai/sdk';
import { requireAnthropic } from '../../config/env';

let cached: { client: Anthropic; model: string } | null = null;

export function getAnthropic(): { client: Anthropic; model: string } {
  if (cached) return cached;
  const { apiKey, model } = requireAnthropic();
  cached = { client: new Anthropic({ apiKey }), model };
  return cached;
}
