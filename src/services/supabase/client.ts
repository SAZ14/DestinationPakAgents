/**
 * Supabase client (server-side, service-role).
 *
 * Uses the service role key, so this must only ever run on the server. Never
 * ship this key to a browser. Row Level Security is not relied upon here — the
 * server is the only writer.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { requireSupabase } from '../../config/env';

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const { url, serviceRoleKey } = requireSupabase();
  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
