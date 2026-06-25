/**
 * Destination Pakistan — real product catalog (seed data).
 *
 * DESTINATION-PAKISTAN SPECIFIC: these are the actual packages sold by the
 * client. Prices are USD, "from" / per person. The concierge agent is NEVER
 * allowed to quote a price outside this catalog without flagging the quote for
 * human pricing — see services/anthropic and the quote agent (later steps).
 *
 * To tune the catalog, edit this file and re-run `npm run seed`. The seed is
 * idempotent (upsert by name).
 */

export type Segment = 'culture' | 'trek' | 'photography' | 'faith' | 'corporate';

export interface SeedPackage {
  name: string;
  segment: Segment;
  durationDays: number;
  basePriceUsd: number;
  /** Best-guess core destinations for matching; tune as the client confirms. */
  destinations: string[];
  summary?: string;
}

/** Core destinations the client operates across (for reference / matching). */
export const CORE_DESTINATIONS = [
  'Hunza',
  'Skardu',
  'Fairy Meadows',
  'Chitral',
  'Naran',
  'Kalam',
  'Swat',
  'Kashmir',
  'Islamabad',
  'Lahore',
] as const;

export const PACKAGES: SeedPackage[] = [
  {
    name: '13 Days Culture & Adventure Trip',
    segment: 'culture',
    durationDays: 13,
    basePriceUsd: 2100,
    destinations: ['Islamabad', 'Hunza', 'Skardu', 'Fairy Meadows'],
    summary: 'Flagship 13-day culture & adventure loop through northern Pakistan.',
  },
  {
    name: 'Fairy Meadows + Hunza Valley',
    segment: 'culture',
    durationDays: 10,
    basePriceUsd: 1500,
    destinations: ['Fairy Meadows', 'Hunza'],
    summary: 'Classic 10-day combination of Fairy Meadows and the Hunza Valley.',
  },
  {
    name: "The Filmmaker's Journey",
    segment: 'photography',
    durationDays: 13,
    basePriceUsd: 2000,
    destinations: ['Hunza', 'Skardu', 'Fairy Meadows', 'Chitral'],
    summary: '13-day route built for filmmakers and content creators.',
  },
  {
    name: 'The Soul of Pakistan (Heritage)',
    segment: 'culture',
    durationDays: 13,
    basePriceUsd: 2400,
    destinations: ['Lahore', 'Islamabad', 'Hunza', 'Skardu'],
    summary: '13-day heritage-focused journey across Pakistan.',
  },
  {
    name: 'South Pakistan – Indus Heritage Route',
    segment: 'culture',
    durationDays: 9,
    basePriceUsd: 1500,
    destinations: ['Lahore', 'Islamabad'],
    summary: '9-day Indus heritage route through southern Pakistan.',
  },
  {
    name: 'Batura Trekking Expedition',
    segment: 'trek',
    durationDays: 15,
    basePriceUsd: 2000,
    destinations: ['Hunza', 'Skardu'],
    summary: '15-day Batura glacier trekking expedition.',
  },
  {
    name: 'Northern Pakistan Ultimate Adventure',
    segment: 'culture',
    durationDays: 11,
    basePriceUsd: 1650,
    destinations: ['Hunza', 'Skardu', 'Fairy Meadows', 'Naran'],
    summary: '11-day ultimate adventure across northern Pakistan.',
  },
  {
    name: 'Autumn Photography Trip',
    segment: 'photography',
    durationDays: 12,
    basePriceUsd: 1650,
    destinations: ['Hunza', 'Skardu', 'Chitral'],
    summary: '12-day autumn photography trip timed for fall colours.',
  },
  {
    name: 'Horseback Expedition (experienced riders)',
    segment: 'trek',
    durationDays: 10,
    basePriceUsd: 3000,
    destinations: ['Chitral', 'Hunza'],
    summary: '10-day horseback expedition for experienced riders.',
  },
  {
    name: 'Reverts Journey (spiritual/cultural)',
    segment: 'faith',
    durationDays: 12,
    basePriceUsd: 1750,
    destinations: ['Lahore', 'Islamabad', 'Hunza'],
    summary: '12-day spiritual & cultural journey for reverts.',
  },
  {
    name: 'Snow Leopard Expedition',
    segment: 'trek',
    durationDays: 10,
    basePriceUsd: 3500,
    destinations: ['Hunza', 'Skardu'],
    summary: '10-day snow leopard tracking expedition.',
  },
  {
    name: 'K2 (Chogori) Base Camp Trek',
    segment: 'trek',
    durationDays: 21,
    basePriceUsd: 3000,
    destinations: ['Skardu'],
    summary: '21-day K2 base camp trek — the flagship expedition.',
  },
  {
    name: "Kīmiyā – A Journey Through Pakistan's Soul",
    segment: 'culture',
    durationDays: 13,
    basePriceUsd: 2500,
    destinations: ['Lahore', 'Islamabad', 'Hunza', 'Skardu'],
    summary: "13-day curated journey through Pakistan's soul.",
  },
  {
    name: 'Nangma Valley & Thallay Broq Trek',
    segment: 'trek',
    durationDays: 11,
    basePriceUsd: 1600,
    destinations: ['Skardu'],
    summary: '11-day Nangma Valley and Thallay Broq trek.',
  },
];
