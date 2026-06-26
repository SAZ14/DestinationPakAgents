/**
 * Destination Pakistan — concierge knowledge base.
 *
 * This is the single source of truth the WhatsApp concierge uses to answer ANY
 * customer question (company info, how trips work, safety, visas, and in-depth
 * destination guides). It is injected into the agent's system prompt on every
 * message, alongside the LIVE package catalog loaded from the database.
 *
 * DESTINATION-PAKISTAN SPECIFIC + EDIT-ME:
 *   - Tune the company facts to match exactly what the client wants stated.
 *   - `DEALS` is the easiest thing for staff to keep current — edit it whenever
 *     there's a new promotion, seasonal offer, or limited-time discount.
 *   - Destination guides are evergreen travel facts; expand them as the team
 *     adds new routes.
 *
 * Accuracy rule (enforced in the agent prompt): the concierge may share what is
 * written here and the catalog's "from" prices, but must NEVER invent prices,
 * confirm bookings, or promise availability — those are always confirmed by a
 * human at Destination Pakistan.
 */

/** Who Destination Pakistan is. Keep factual; the team can refine wording. */
export const COMPANY_PROFILE = `ABOUT DESTINATION PAKISTAN
- A premium inbound tour operator based in Gulberg, Lahore, Pakistan, with around a decade of experience hosting foreign travellers.
- Website: destinationpakistan.travel
- Focus: curated, multi-day private and small-group journeys across northern and historic Pakistan for international guests. Prices are in US Dollars (USD), typically per person.
- Style: premium, personal, and safety-first — experienced local guides, vetted hotels, and private transport. Itineraries are tailored to each guest rather than fixed off-the-shelf tours.
- Specialities: culture & heritage trips, high-altitude trekking and expeditions (including K2 Base Camp), photography/filmmaking journeys, faith & spiritual travel, and corporate/group trips.`;

/** How a trip actually comes together — sets correct expectations. */
export const HOW_IT_WORKS = `HOW BOOKING WORKS
- The concierge helps you shape your trip on WhatsApp: your dates, group size, interests, budget, and must-see places.
- Once we understand your trip, our team prepares a tailored itinerary and a quote for you to review. A real person at Destination Pakistan checks every quote before it is sent — we never auto-confirm.
- Quoted prices are starting "from" prices per person; the final price depends on group size, season, hotel level, and inclusions, and is confirmed by our team.
- Typical inclusions on most trips: private transport, experienced local guide(s), accommodation, and planned sightseeing. Exact inclusions (meals, domestic flights, permits, gear) vary by trip and are confirmed in your quote.
- Payment instructions and booking confirmation are always handled by a human team member, not automatically.`;

/** Safety + practicalities foreign tourists ask about most. */
export const PRACTICAL_INFO = `SAFETY, VISAS & PRACTICALITIES
- Safety: Pakistan's northern tourist regions (Gilgit-Baltistan, Hunza, Skardu) are well-travelled by international visitors. We use planned routes, experienced local guides, and trusted local partners, and our team confirms current conditions before travel.
- Visas: most nationalities can apply through Pakistan's official online e-visa system; many travellers are eligible. We can guide you on the process and provide the invitation/booking documents some applicants need — ask us and we'll help.
- Best season: summer (roughly May–September) is the main season for the northern valleys and most trekking; autumn (late September–October) is prized for photography. Winters are cold and some high routes close.
- Altitude: northern valleys and treks involve high elevations — itineraries build in acclimatisation, and treks like K2 Base Camp require good fitness.
- Connectivity, money, dietary needs (halal is standard; vegetarian/other diets can be arranged), and women/family-friendly travel can all be accommodated — just ask.`;

/**
 * Current deals / promotions. EDIT THIS whenever there's a new offer.
 * Keep entries short and dated so the concierge can mention them accurately.
 * If empty, the concierge simply says there are no special promotions running
 * right now but will share the best current pricing.
 */
export const DEALS = `CURRENT DEALS & OFFERS
- (No special promotions are loaded right now.) The team always shares the best current pricing for your dates and group — ask and we'll tailor it.
- To advertise a real promotion, a Destination Pakistan staff member should edit this section (e.g. "Early-bird: 10% off July Hunza trips booked before 31 May").`;

/**
 * In-depth destination guides. These are evergreen travel facts the concierge
 * uses to answer "tell me about X" in depth and to recommend places.
 */
export const DESTINATION_GUIDES = `DESTINATION GUIDES (in-depth)

HUNZA VALLEY (Gilgit-Baltistan, ~2,400m)
- A famed mountain valley surrounded by peaks like Rakaposhi (7,788m), Ultar Sar, and Ladyfinger/Bublimating. Known for terraced orchards, longevity legends, and exceptionally warm hospitality.
- Highlights: Baltit Fort and Altit Fort (centuries-old restored forts), Karimabad bazaar, Eagle's Nest viewpoint at sunrise/sunset, Attabad Lake (vivid turquoise), Passu Cones and Passu/Hopper glaciers, Khunjerab Pass (the China border, one of the highest paved border crossings).
- Best time: April–October; spring blossom (late March–April) and autumn colours (October) are spectacular. Vibe: safe, relaxed, photogenic, family-friendly.

SKARDU (Gilgit-Baltistan, ~2,200m)
- The gateway to the Karakoram and the world's greatest concentration of high peaks, including K2. A high-desert landscape of rivers, cold deserts, and alpine lakes.
- Highlights: Shangrila/Lower Kachura Lake, Upper Kachura Lake, Shigar Fort, Khaplu Palace and valley, Deosai National Park ("Land of Giants", ~4,000m plateau, home to the Himalayan brown bear and summer wildflowers), the Katpana cold desert.
- Best time: May–September (Deosai opens roughly July–September). The launch point for K2 Base Camp and many expeditions.

FAIRY MEADOWS & NANGA PARBAT (~3,300m)
- Alpine meadow facing Nanga Parbat (8,126m), the world's 9th-highest mountain and the famous "Killer Mountain". Reached via a jeep track from Raikot Bridge plus a hike.
- Highlights: front-row sunrise/sunset on Nanga Parbat, hikes to Beyal Camp and the Nanga Parbat base camp viewpoint, pine forests and pristine night skies. Best time: June–September. Rustic cabins; no roads to the meadow itself.

CHITRAL & KALASH VALLEYS (Khyber Pakhtunkhwa)
- A culturally rich region below Tirich Mir (7,708m, the highest peak of the Hindu Kush). Home to the unique Kalash people with their own animist traditions and colourful festivals.
- Highlights: Kalash valleys (Bumburet, Rumbur, Birir), Chitral Fort and bazaar, Shandur Pass (world's highest polo ground). Best time: spring to autumn; Kalash festivals (e.g. Chilam Joshi in May) are a draw.

NARAN, KAGHAN & BABUSAR (Khyber Pakhtunkhwa)
- A green alpine valley popular for accessible mountain scenery. Highlights: Saif-ul-Malook Lake (a glacial lake wrapped in legend), Lulusar Lake, Babusar Top (~4,170m pass with sweeping views). Best time: late June–September (the high passes are snowbound in winter).

SWAT & KALAM (Khyber Pakhtunkhwa)
- "The Switzerland of Pakistan" — lush valleys, rivers, and forests with deep Buddhist-era heritage (Gandhara). Highlights: Kalam, Ushu forest, Mahodand Lake, Malam Jabba (ski resort), Swat's archaeological sites. Best time: spring–autumn.

AZAD KASHMIR
- Green valleys, rivers, and lakes. Highlights: Neelum Valley (Keran, Sharda, Arang Kel), Ratti Gali Lake, Banjosa Lake. Best time: late spring–autumn. Note: some areas require permits, which we arrange.

ISLAMABAD & ROUND-ABOUT
- Pakistan's modern, green capital and the usual arrival/transit hub for northern trips. Highlights: Faisal Mosque (one of the largest mosques in the world), Margalla Hills and Daman-e-Koh viewpoint, Pakistan Monument, nearby Taxila (UNESCO Gandhara archaeology). Good for a gentle first/last day.

LAHORE
- Pakistan's cultural and culinary heart. Highlights: Badshahi Mosque, Lahore Fort (UNESCO), Wazir Khan Mosque, the Walled City, Shalimar Gardens (UNESCO), the Wagah border ceremony, and legendary food. The base of Destination Pakistan. Best time: October–March (summers are very hot).

TREKS & EXPEDITIONS
- K2 (Chogori) Base Camp: the flagship Karakoram trek to the foot of the world's 2nd-highest peak (8,611m) via the Baltoro Glacier and Concordia ("throne room of the mountain gods"). ~3 weeks, demanding, requires fitness and acclimatisation; runs in summer.
- Other expeditions we run include Batura, Snow Leopard, Nangma Valley/Thallay Broq, and horseback expeditions — for serious trekkers and climbers, supported by experienced local crews.`;

/** Quick FAQ-style answers to keep tone consistent. */
export const FAQ = `FREQUENTLY ASKED
- "Is Pakistan safe for tourists?" Yes — the northern tourist regions are well-travelled by international visitors; we use planned routes, experienced guides, and confirm current conditions before travel.
- "Can you customise a trip?" Yes — almost every trip is tailored to your dates, interests, pace, and budget.
- "Do you handle solo travellers / families / women travellers?" Yes, all are welcome and common.
- "What's included?" Typically transport, guide(s), accommodation, and sightseeing; exact inclusions are confirmed in your quote.
- "Can you help with visas?" Yes — we guide you through Pakistan's e-visa and provide documents some applicants need.
- "How do I book?" We prepare a tailored quote, a human reviews it, and then our team shares payment and confirmation details.`;

/**
 * Build the full static knowledge block injected into the agent's system prompt.
 * (The live package catalog is appended separately — see formatPackageCatalog.)
 */
export function buildKnowledgeBase(): string {
  return [
    COMPANY_PROFILE,
    HOW_IT_WORKS,
    PRACTICAL_INFO,
    DEALS,
    DESTINATION_GUIDES,
    FAQ,
  ].join('\n\n');
}

import type { PackageRow } from '../services/supabase/types';

/**
 * Render the LIVE catalog so the concierge always knows current packages and
 * their starting ("from") prices. Loaded from the database each message so it
 * reflects whatever staff have seeded/edited.
 */
export function formatPackageCatalog(packages: PackageRow[]): string {
  if (packages.length === 0) {
    return 'LIVE PACKAGE CATALOG\n- (No packages loaded.) Offer to tailor a custom trip and have the team confirm pricing.';
  }
  const lines = packages.map((p) => {
    const dests = p.destinations.length > 0 ? ` — ${p.destinations.join(', ')}` : '';
    return `- ${p.name} (${p.segment}, ${p.duration_days} days): from $${p.base_price_usd}/person${dests}.${
      p.summary ? ` ${p.summary}` : ''
    }`;
  });
  return (
    'LIVE PACKAGE CATALOG (these are the real current packages and starting "from" prices — ' +
    'you MAY share these; final pricing is confirmed by the team)\n' +
    lines.join('\n')
  );
}
