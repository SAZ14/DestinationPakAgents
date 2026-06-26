/**
 * Package catalog queries.
 *
 * The catalog is seeded from src/seed/packages.ts (real Destination Pakistan
 * products, USD). The quote agent matches a qualified lead against these rows;
 * it is NEVER allowed to invent a package or a price outside this catalog —
 * if nothing fits, the quote is flagged `needs_human_pricing`.
 */

import { getSupabase } from './client';
import type { PackageRow } from './types';

/** All active packages, cheapest first. */
export async function listActivePackages(): Promise<PackageRow[]> {
  const { data, error } = await getSupabase()
    .from('packages')
    .select('*')
    .eq('active', true)
    .order('base_price_usd', { ascending: true });

  if (error) throw new Error(`listActivePackages failed: ${error.message}`);
  return (data as PackageRow[] | null) ?? [];
}

/** Fetch one package by id. Returns null if not found. */
export async function getPackageById(id: string): Promise<PackageRow | null> {
  const { data, error } = await getSupabase()
    .from('packages')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getPackageById failed: ${error.message}`);
  return (data as PackageRow | null) ?? null;
}
