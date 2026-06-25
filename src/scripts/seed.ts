/**
 * Seed script — loads the Destination Pakistan catalog and staff approvers.
 *
 * Idempotent: packages upsert by `name`, staff upsert by `whatsapp_number`.
 * Run after applying the migration:
 *   npm run seed
 */

import { getSupabase } from '../services/supabase/client';
import { PACKAGES } from '../seed/packages';
import { env } from '../config/env';

async function seedPackages(): Promise<void> {
  const supabase = getSupabase();
  const rows = PACKAGES.map((p) => ({
    name: p.name,
    segment: p.segment,
    duration_days: p.durationDays,
    base_price_usd: p.basePriceUsd,
    destinations: p.destinations,
    summary: p.summary ?? null,
    active: true,
  }));

  const { error } = await supabase.from('packages').upsert(rows, { onConflict: 'name' });
  if (error) throw new Error(`Failed to seed packages: ${error.message}`);
  console.log(`✓ Seeded ${rows.length} packages.`);
}

async function seedStaff(): Promise<void> {
  if (env.staffApproverNumbers.length === 0) {
    console.log(
      '• No STAFF_APPROVER_NUMBERS set — skipping staff seed. ' +
        'Add them to .env to enable WhatsApp approvals.',
    );
    return;
  }

  const supabase = getSupabase();
  const rows = env.staffApproverNumbers.map((number, i) => ({
    name: `Approver ${i + 1}`,
    whatsapp_number: number,
    role: 'approver' as const,
    active: true,
  }));

  const { error } = await supabase
    .from('staff')
    .upsert(rows, { onConflict: 'whatsapp_number' });
  if (error) throw new Error(`Failed to seed staff: ${error.message}`);
  console.log(`✓ Seeded ${rows.length} staff approver(s).`);
}

async function main(): Promise<void> {
  await seedPackages();
  await seedStaff();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
