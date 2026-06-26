/**
 * Destination Pakistan — concierge knowledge base.
 *
 * Built from the real Destination Pakistan website (destinationpakistan.travel),
 * their Instagram (@destinationpakistan), public terms/refund pages, and
 * verified search data. Every fact here is sourced, not assumed.
 *
 * HOW TO KEEP IT CURRENT (non-developer staff can do this):
 *   - New deal / promotion? Edit the `DEALS` section and restart the server.
 *   - New package? Add it to src/seed/packages.ts, run `npm run seed` — the
 *     concierge picks it up from the database automatically.
 *   - New service or policy change? Edit the relevant section below.
 *
 * The concierge answers from this file + the live database catalog injected
 * at runtime. It NEVER invents prices or confirms bookings — a human always
 * reviews the final quote.
 */

import type { PackageRow } from '../services/supabase/types';

// =============================================================================
// COMPANY IDENTITY
// =============================================================================

export const COMPANY_PROFILE = `ABOUT DESTINATION PAKISTAN
- Website: destinationpakistan.travel | Instagram: @destinationpakistan (170K+ followers)
- A premium inbound tour operator based in Gulberg, Lahore, Pakistan, with around a decade of experience.
- Founded and led by Bilal Yousuf Khan (CEO/Founder), who is personally passionate about showcasing Pakistan's beauty to the world.
- Focus: curated, private multi-day journeys for INTERNATIONAL tourists — foreign travellers are the core customer, not Pakistani domestic tourists.
- Prices are in US Dollars (USD), quoted per person, "from" prices.
- Philosophy: personally crafted itineraries, attention to every detail, seamless experience from landing to departure. Not a generic group-tour company.
- Committed to responsible and sustainable tourism, working with local communities.
- 24/7 support team throughout your trip.
- Contact: message on WhatsApp (this bot), DM on Instagram @destinationpakistan, or email (available on their website).`;

// =============================================================================
// ALL SERVICES DESTINATION PAKISTAN OFFERS
// =============================================================================

export const ALL_SERVICES = `SERVICES DESTINATION PAKISTAN OFFERS

1. CUSTOM PRIVATE TOURS
   - Fully personalised multi-day itineraries tailored to your dates, interests, group size, budget, and pace.
   - Everything managed: private transport, experienced local guides, hand-picked accommodations, sightseeing.
   - No two trips are identical — every itinerary is built for the specific client.

2. FIXED / GROUP TRIP DEPARTURES
   - Destination Pakistan runs scheduled group departures throughout the season (e.g. Cherry Blossom season, peak summer, autumn photography season).
   - Limited slots; book early to secure a place.

3. PHOTOGRAPHY & FILMMAKER TRIPS
   - Dedicated routes and timing built around the best light, landscapes, and cultural access for photographers, filmmakers, content creators, and drone pilots.
   - Photographer-specific guides who understand shot composition and logistics.

4. TREKKING & EXPEDITION MANAGEMENT
   - Full expedition logistics: K2 Base Camp, Nanga Parbat Base Camp, Batura Glacier, Snow Leopard trails, Nangma Valley, Horseback Expedition.
   - Experienced trekking crews, porters, gear logistics, permits, emergency protocols.

5. FAITH & SPIRITUAL JOURNEYS (REVERTS JOURNEY)
   - Curated experiences for Muslim reverts and faith travellers — Islamic heritage, spiritual significance, cultural depth.
   - A unique offering specifically designed to connect faith with travel.

6. CORPORATE & GROUP BOOKINGS
   - Team-building retreats, corporate getaways, organisational delegations, MICE travel.
   - Custom corporate itineraries with professional facilitation.

7. VISA ASSISTANCE
   - Destination Pakistan guides clients through Pakistan's tourist visa process.
   - Provides the invitation/support letters and booking documents that some nationalities need for their e-visa application.
   - Does NOT process visas directly (the official Pakistan e-visa system is at visa.nadra.gov.pk), but handles the documentation, support, and guidance throughout.
   - Especially important for nationalities that need a sponsor letter from a registered tour operator.

8. AIRPORT TRANSFERS & ARRIVAL LOGISTICS
   - Airport pickup from Islamabad (IATA: ISB) — the primary arrival point for northern Pakistan trips.
   - Welcome dinner and trip orientation on Day 1.
   - Drop-off and departure assistance.

9. HOTEL & ACCOMMODATION BOOKING
   - Hand-picked premium accommodations matched to the route and luxury level.
   - Options from standard guesthouses to premium mountain lodges — tailored to budget.

10. PR COLLABORATION / CONTENT CREATOR PROGRAMME
    - Content creators, travel bloggers, photographers, and filmmakers can travel Pakistan at a DISCOUNTED RATE in exchange for social media content.
    - In exchange: social media tags, mentions, stories, and content that tells the story of Pakistan.
    - You can also EARN by leading group trips to Pakistan through Destination Pakistan.
    - To apply: message @destinationpakistan on Instagram or WhatsApp.

11. HONEYMOON PACKAGES
    - Romantic curated itineraries through the northern valleys — Hunza, Skardu, Fairy Meadows.
    - Private arrangements, premium accommodation, personalised touches.

12. TRAVEL GUIDE & BLOG
    - Destination Pakistan publishes in-depth travel guides (Pakistan 2025 guide, destination-specific guides for Pir Ghaib, Chitral, bioluminescent beaches, and more) on their website.`;

// =============================================================================
// HOW BOOKING WORKS
// =============================================================================

export const HOW_IT_WORKS = `HOW BOOKING WORKS (step by step)

Step 1 — ENQUIRY
   Tell us your trip idea on WhatsApp (this bot), Instagram DM, or email. Share dates, group size, interests, budget, and destinations in mind.

Step 2 — CUSTOM QUOTE
   Our team prepares a personalised itinerary and quote tailored to you. A real human at Destination Pakistan reviews EVERY quote before it is sent — nothing is auto-generated.

Step 3 — CONFIRM & DEPOSIT
   Your booking is confirmed when you pay a 30% non-refundable deposit OR pay in full. The deposit covers reservations with hotels, transport partners, and third parties.

Step 4 — REMAINING BALANCE
   The remaining 70% (or 50% of the total, since 30% is already paid as deposit and the remaining 50% is collected on Day 1) is collected on Day 1 of your trip.

   In practice: 30% deposit to confirm → 50% balance on arrival → 20% already within the deposit structure. Confirm exact payment schedule when you get your quote.

Step 5 — TRIP
   Your Destination Pakistan experience begins. 24/7 support throughout.

IMPORTANT: Quoted prices are starting "from" prices per person. The final confirmed price depends on group size, season, hotel level, duration, and specific inclusions — always confirmed in writing by our team before you pay.`;

// =============================================================================
// PAYMENT, REFUND & CANCELLATION POLICY (sourced from their website)
// =============================================================================

export const PAYMENT_POLICY = `PAYMENT, REFUND & CANCELLATION POLICY

PAYMENT
- Currencies: USD (standard for all packages). Local PKR accepted for on-ground costs in some cases.
- Payment methods: confirmed by the team at booking (bank transfer, online payment — details shared with your confirmed quote).
- A booking is confirmed when either (a) full payment is received OR (b) a 30% deposit is paid.

DEPOSIT
- The 30% advance deposit is NON-REFUNDABLE.
- It covers the cost of cancelling reservations with hotels, transport partners, and third parties.

CANCELLATIONS
- If you cancel for any reason (personal, weather, flight cancellations, natural disasters), Destination Pakistan refunds advance or partial payments MINUS:
  (a) The non-refundable 30% deposit.
  (b) A service charge of UP TO 20% of the total trip cost, based on time, effort, and resources already used in planning and organising your tour.
  (c) Note: the 20% service charge does NOT apply to payments made for domestic airfare.

POSTPONEMENTS
- If your trip is delayed or postponed (personal reasons, weather, flight disruption), payments remain secure with Destination Pakistan.
- Contact them to request a new quotation for rescheduling — they work with you to find a new date.

PRICE CHANGES
- All prices are subject to change based on season, availability, and market rates. Confirmed bookings are honoured at the quoted price.`;

// =============================================================================
// VISA SERVICES (detailed)
// =============================================================================

export const VISA_SERVICES = `PAKISTAN TOURIST VISA — FULL GUIDE

WHO NEEDS A VISA
- Citizens of GCC countries (Saudi Arabia, UAE, Bahrain, Oman, Qatar, Kuwait) + Nepal and Maldives: VISA FREE entry.
- 120+ nationalities: eligible for Pakistan e-Visa (online, fast).
- Visa on Arrival: available for select nationalities for single entry up to 30 days.
- All other nationalities: apply through a Pakistani embassy/consulate.

E-VISA (most common for foreign tourists)
- Apply online at visa.nadra.gov.pk — Pakistan's official system, open to 192 countries.
- Typically processed in 24–48 hours (standard applications 7–10 working days).
- Valid for up to 3 months, single entry. Can be extended up to 6 months.
- Some applicants need an invitation/support letter from a registered tour operator — Destination Pakistan provides this.

HOW DESTINATION PAKISTAN HELPS
- Guides you through the e-visa application step by step.
- Provides the official invitation letter and booking documentation required by some nationalities.
- Works with registered tour operator status, so their documents are accepted by Pakistan immigration.
- They do NOT charge separately for visa guidance — it is part of the overall service.

IMPORTANT TIPS
- Apply for your visa BEFORE booking flights — processing times vary.
- Some nationalities (e.g. Indian passport holders, certain nationalities) have restricted access; ask and we will check for your specific passport.
- Visa extension can be done inside Pakistan through the Foreigners Registration Office (FRO).`;

// =============================================================================
// PR COLLABORATION / CONTENT CREATOR PROGRAMME
// =============================================================================

export const PR_COLLABORATION = `PR COLLABORATION & CONTENT CREATOR PROGRAMME

Destination Pakistan actively works with travel photographers, filmmakers, bloggers, YouTubers, and social media content creators.

WHAT YOU GET
- Travel Pakistan at a SIGNIFICANTLY DISCOUNTED RATE (up to half price, depending on your audience size and content plan).
- A chance to be one of the first creators to document destinations most people haven't seen.
- Full Destination Pakistan support: logistics, guides, permits, accommodations.

WHAT THEY EXPECT IN RETURN
- Social media content: posts, stories, reels, tags, mentions testifying to the trip and Pakistan's beauty.
- Your content reaches curious Pakistanis and a global audience simultaneously.
- No hard follower minimum stated, but they consider your content quality and audience relevance.

HOW TO APPLY
- DM @destinationpakistan on Instagram with your portfolio/profile.
- Or message on WhatsApp (this bot can take initial details and pass them to the team).

EARN BY LEADING TRIPS
- If you have a following or community, you can EARN money by leading group trips to Pakistan through Destination Pakistan.
- They handle all logistics; you bring your audience and lead the experience.
- Ask for details — the team will explain the revenue structure.`;

// =============================================================================
// CURRENT DEALS & PROMOTIONS (EDIT THIS FREQUENTLY)
// =============================================================================

export const DEALS = `CURRENT DEALS & SPECIAL OFFERS

(This section is updated by the Destination Pakistan team. If no specific promotion is listed, the team always works to offer the best current pricing for your dates and group.)

SEASONAL HIGHLIGHTS
- Cherry Blossom Season (late March to mid-April): Hunza and Skardu valleys transform with apricot, cherry, and apple blossoms. Limited slots — book well in advance. Starting from $2,000/person for 12 days.
- Peak Summer (May–September): Best for most northern Pakistan trips, trekking, K2 expeditions, and Deosai. Main booking season.
- Autumn Photography Season (September–October): Golden light, harvest colours, and stunning landscapes — favourite for photographers. Book early.
- Winter Trips (November–February): Snow-covered northern Pakistan for the adventurous. Some high routes close; lower valleys accessible.

PR COLLABORATION DISCOUNT
- Photographers, filmmakers, and content creators can travel at a discounted rate in exchange for content. Ask for details.

GROUP DISCOUNT
- Groups of 6+ may qualify for a group rate. Ask the team when enquiring.

NOTE: All promotions and deals are subject to availability and are confirmed by the team. This bot will flag to the team if you'd like the latest pricing.`;

// =============================================================================
// DESTINATION GUIDES (in-depth, covering every place DP operates)
// =============================================================================

export const DESTINATION_GUIDES = `DESTINATION GUIDES

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HUNZA VALLEY (Gilgit-Baltistan, ~2,400m)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Often called the valley that rewires your soul. Surrounded by Rakaposhi (7,788m), Ultar Sar, Lady Finger/Bublimating, and Diran peaks. The Hunza people are famous for warmth, longevity, and hospitality.

MUST-SEE:
- Baltit Fort (900+ years old, UNESCO-listed, stunning view over Karimabad)
- Altit Fort & Royal Gardens (even older than Baltit, beautifully restored)
- Karimabad bazaar — handicrafts, dried apricots, local gemstones
- Eagle's Nest viewpoint — the sunrise/sunset view is one of the most photographed in Pakistan
- Attabad Lake — vivid turquoise lake formed by a 2010 landslide; boat rides available
- Passu Cones — dramatic jagged rock towers rising straight from the earth
- Passu Glacier & Hopper Glacier — walk on a glacier with a guide
- Khunjerab Pass (4,693m) — China border, one of the world's highest paved crossings; view of Karakoram peaks
- Duikar (Eagle's Nest village) — traditional stone houses and apricot orchards

BEST TIME: April–October. Cherry/apricot blossom: late March–April (magical, book early). Autumn colours: October.
VIBE: Safe, relaxed, romantic, photogenic, great for families and solo travellers.
FOOD: Chapshuro (local meat pastry), Hunzai bread, dried mulberries, apricot juice — don't miss Café de Hunza.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SKARDU (Gilgit-Baltistan, ~2,200m)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gateway to the Karakoram — the world's densest cluster of 8,000m peaks. A high-desert landscape of rivers, cold deserts, and crystal-clear lakes.

MUST-SEE:
- Shangrila / Lower Kachura Lake — resort by a lake, often called "Heaven on Earth"
- Upper Kachura Lake — turquoise alpine lake at higher elevation, fewer crowds
- Shigar Fort (17th century, now a boutique hotel in a spectacular river valley)
- Khaplu Palace & Khaplu Valley — one of the best-preserved historic palaces in the north
- Deosai National Park ("Land of Giants") — vast 4,000m plateau, home to the Himalayan brown bear, snow leopard, and summer wildflowers — opens July–September
- Katpana Cold Desert — sand dunes beside the Indus River in a high-altitude cold desert
- Satpara Lake — peaceful spot near Skardu town with trout fishing
- Skardu Fort — historic hilltop fort with panoramic views

BEST TIME: May–September. Deosai specifically July–September.
TREK BASE: Launch point for K2 Base Camp (via Askole), Gondogoro La, Masherbrum, and all Baltoro treks.
FLIGHT: Skardu has an airport (SKZ) — flights from Islamabad save 2 days of road. Subject to weather; DP books and manages.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FAIRY MEADOWS & NANGA PARBAT (~3,300m)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
One of the most dramatic experiences in all of Pakistan. An open alpine meadow directly in front of Nanga Parbat (8,126m — the 9th highest mountain, "Killer Mountain").

ACCESS: Raikot Bridge on the KKH → 3-hour bone-rattling jeep ride → 3–4 hour uphill hike. No roads into the meadow itself. Porters carry your gear.
STAY: Rustic wooden cabins and camps right in the meadow — basic but magical.

HIGHLIGHTS:
- Watching Nanga Parbat turn gold at sunrise and pink at sunset — one of Pakistan's most stunning experiences
- Hike to Beyal Camp for closer views
- Trek to Nanga Parbat Base Camp (Raikot side) — full day, high altitude, spectacular
- Pine forests, wildflowers in summer, near-perfect stargazing at night
- Bonfire dinners with the mountain right in front of you

BEST TIME: June–September. Snow can remain on the meadow into June.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHITRAL & KALASH VALLEYS (Khyber Pakhtunkhwa)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
One of Pakistan's most culturally unique regions. Home to the Kalash people — a small ethnic minority with their own animist religion, colourful dress, and ancient festivals that have survived for centuries against the backdrop of the Hindu Kush.

HIGHLIGHTS:
- Kalash Valleys (Bumburet, Rumbur, Birir) — meet the Kalash people, see their architecture, festivals
- Chitral Fort and the old town bazaar
- Tirich Mir (7,708m) — highest peak of the Hindu Kush, visible from Chitral
- Shandur Pass (3,734m) — the world's highest polo ground; annual Shandur Polo Festival (July)
- The drive from Chitral to Hunza via Boroghil is spectacular for adventure travellers

FESTIVALS: Chilam Joshi (May, spring festival), Uchal (autumn). Book specifically for these if interested.
BEST TIME: Spring to early autumn.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NARAN, KAGHAN & BABUSAR PASS (Khyber Pakhtunkhwa)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The most accessible alpine escape from Islamabad — green valleys, rivers, and easy high-altitude passes.

HIGHLIGHTS:
- Lake Saif-ul-Malook — a glacial lake wrapped in Pashtun legend, one of Pakistan's most visited and beautiful lakes
- Lulusar Lake — serene, less crowded lake further up the valley
- Babusar Top (4,173m) — a high mountain pass with sweeping 360° views connecting Kaghan to Gilgit-Baltistan
- Naran town as a base with adventure activities (jeep safaris, horse riding)

BEST TIME: Late June–September (the high passes are snow-blocked in winter and spring).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SWAT VALLEY & KALAM (Khyber Pakhtunkhwa)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Often called "The Switzerland of Pakistan" — lush green valleys, rivers, forests, and deep Buddhist-era (Gandhara) archaeological heritage.

HIGHLIGHTS:
- Kalam — picturesque village surrounded by pine forests and rivers; base for higher treks
- Ushu Forest — dense forest of deodars and pines above Kalam
- Mahodand Lake — a mirror-still lake ringed by peaks beyond Kalam
- Malam Jabba — Pakistan's only ski resort, also popular in summer
- Swat Museum and Gandhara Buddhist sites — centuries of history
- Mingora — main city with a lively bazaar

BEST TIME: Spring to autumn. Skiing in winter at Malam Jabba.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AZAD KASHMIR (Neelum Valley, Arang Kel)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lush, forested, and less known than Gilgit-Baltistan — a beautiful alternative for green mountain scenery.

HIGHLIGHTS:
- Neelum Valley — a river valley stretching to the Line of Control, dotted with villages
- Arang Kel — a hilltop village accessible only by cable car or hike; extraordinary views
- Ratti Gali Lake — high-altitude jewel lake
- Keran, Sharda — historic village and ancient university ruins
- Banjosa Lake

NOTE: Some Azad Kashmir areas require special permits — Destination Pakistan arranges these.
BEST TIME: Late spring to autumn.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ISLAMABAD (Capital, ~500m)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The modern, planned capital and the main international arrival hub. Most Destination Pakistan trips begin and end here (Islamabad Airport, IATA: ISB).

HIGHLIGHTS:
- Faisal Mosque — one of the largest mosques in the world, surrounded by the Margalla Hills
- Daman-e-Koh — a hilltop viewpoint over the city from the Margalla Hills
- Pakistan Monument — modern monument representing the four provinces
- Shakarparian Park & Rose & Jasmine Garden
- Taxila (30 min drive) — UNESCO-listed ancient Gandhara city with 3,000 years of history; stupas, museums
- Blue Area — modern commercial centre; good food and shopping

BEST TIME: October–April (summers are hot; winters are mild and pleasant).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAHORE (Cultural Capital)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pakistan's soul and cultural heart — Mughal architecture, extraordinary food, and a city that never slows down. Destination Pakistan is headquartered here in Gulberg.

HIGHLIGHTS:
- Lahore Fort (Shahi Qila, UNESCO) — a magnificent Mughal fortress with palaces and museums
- Badshahi Mosque — one of the largest mosques in the world; Mughal grandeur at its peak
- Wazir Khan Mosque — a smaller but exquisitely detailed Mughal-era gem inside the Walled City
- The Walled City (Androon Lahore) — a 2,000+ year old city; best explored on foot or by rickshaw
- Shalimar Gardens (UNESCO) — Mughal gardens built by Emperor Shah Jahan
- Wagah Border Ceremony — the daily flag-lowering ceremony with India; a unique spectacle
- Food Street and Gawalmandi — legendary street food scene (seekh kebab, nihari, rabri, jalebi)
- Lahore Museum — one of the finest museums in South Asia

BEST TIME: October–March (summers are extremely hot; 40°C+).
NOTE: Destination Pakistan's office is in Gulberg, Lahore — a modern, upscale neighbourhood.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SINDH & SOUTHERN PAKISTAN (emerging)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Destination Pakistan also covers destinations beyond the north, including:
- Mohenjo-daro (Sindh) — one of the world's oldest cities, 4,500 years old; UNESCO World Heritage
- Bioluminescent beaches — a rare natural phenomenon on Pakistan's Makran coast (Balochistan/Sindh)
- Toshangi/Shushangi Gorge — called "The Grand Canyon of Sindh", a spectacular lesser-known canyon
- Pir Ghaib (Balochistan) — a natural waterfall in an otherwise arid landscape; an unexpected gem

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TREKKING & EXPEDITIONS (all managed by Destination Pakistan)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
K2 (Chogori) Base Camp Trek
- The pinnacle of Karakoram trekking. 21 days. Follows the legendary Baltoro Glacier through a cathedral of 8,000m peaks (Gasherbrum I & II, Broad Peak, K2 itself) to Concordia — "the throne room of the mountain gods."
- Physically demanding: good fitness required, altitude acclimatisation built in, experienced crew.
- Starts and ends in Skardu. Summer only (June–August).

Nanga Parbat Basecamp Trek
- A shorter but equally dramatic expedition to the base of the world's 9th-highest peak.
- Access via Fairy Meadows (jeep + hike). Day hike from Fairy Meadows to Raikot Base Camp.

Batura Glacier Expedition (15 days)
- Technical glacier trek in the upper Hunza region. For experienced trekkers.

Snow Leopard Expedition (10 days)
- Wildlife-focused trek to areas where the elusive snow leopard roams. Hunza/Skardu region.

Horseback Expedition (10 days, experienced riders only)
- Unique horse-trekking route through Chitral and Hunza for experienced riders.

Nangma Valley & Thallay Broq Trek (11 days)
- A remote and spectacular Karakoram valley near Skardu. Less crowded than K2 trails.`;

// =============================================================================
// SAFETY, VISA & PRACTICALITIES
// =============================================================================

export const PRACTICAL_INFO = `SAFETY, VISA & PRACTICALITIES

IS PAKISTAN SAFE?
Yes — Pakistan's northern tourist regions (Gilgit-Baltistan, Hunza, Skardu, Fairy Meadows, Chitral) are well-travelled by international visitors and have an excellent safety track record for tourists. Destination Pakistan uses:
- Planned, vetted routes
- Experienced local guides who know the region and its communities
- Trusted local partners (hotels, transport, crew)
- Real-time monitoring — the team confirms current conditions before and during travel
Foreign tourists frequently report feeling exceptionally safe and welcomed. The warmth of Pakistani hospitality is consistently one of the most-mentioned highlights.

WOMEN & SOLO TRAVELLERS
Absolutely welcome and common on Destination Pakistan trips. The northern mountain communities are especially welcoming to foreign travellers. Modest dress is recommended outside cities; in Islamabad and Lahore, Western dress is acceptable. Destination Pakistan guides clients on cultural norms.

ALTITUDE & HEALTH
- Hunza (2,400m), Skardu (2,200m), Deosai (4,000m+), and trek routes can go above 5,000m.
- Itineraries include acclimatisation days for high-altitude trips.
- Trekking expeditions (K2, Batura, etc.) require good physical fitness and cardiovascular health.
- Travel insurance including emergency evacuation is STRONGLY recommended for all trips. Ask the team for guidance.

CONNECTIVITY
- Pakistani SIM cards (Jazz, Zong, Telenor) are available at airports; Jazz/Zong have the best northern coverage.
- Coverage drops in remote valleys and trek routes — expect to be offline.
- Most hotels in Hunza and Skardu have WiFi; quality varies.

CURRENCY
- Pakistani Rupee (PKR) for local purchases.
- USD is the standard for Destination Pakistan packages.
- ATMs available in Islamabad, Lahore, Gilgit, and Skardu — carry cash for remote areas.
- Credit cards accepted in major hotels and restaurants in cities; not reliable in small towns.

FOOD & DIETARY NEEDS
- Pakistan is largely halal — halal food is the standard everywhere.
- Vegetarian options are widely available (lentils, rice, vegetable curries, local breads).
- Vegan and other dietary needs can be arranged with advance notice.
- Northern Pakistani cuisine highlights: Chapshuro, Hunzai bread, dumplings, Balti cuisine, and legendary Lahori street food.

BEST SEASON SUMMARY
- May–October: Northern Pakistan, trekking, Hunza, Skardu, Fairy Meadows.
- Late March–April: Cherry/apricot blossom in Hunza and Skardu (book early, limited slots).
- September–October: Autumn photography — golden light, fall colours, harvests.
- October–March: Lahore, Islamabad, historic sites, South Pakistan (cities cool down pleasantly).
- Deosai National Park: July–September only.
- K2 Base Camp Trek: June–August.`;

// =============================================================================
// FAQ
// =============================================================================

export const FAQ = `FREQUENTLY ASKED QUESTIONS

Q: Is Pakistan safe for foreign tourists?
A: Yes. The northern mountain regions are peaceful, welcoming, and well-travelled by internationals. Destination Pakistan monitors conditions and uses planned routes and experienced guides.

Q: Can I get a tourist visa for Pakistan easily?
A: Most nationalities can get an e-visa online at visa.nadra.gov.pk. GCC nationals are visa-free. Destination Pakistan provides the invitation letters and support documents you may need. Ask us and we'll guide you step by step.

Q: Can you arrange a custom trip for just me and my family/partner?
A: Yes — almost every Destination Pakistan trip is private and fully custom. Just share your dates, group, and interests.

Q: Do you cater to solo travellers?
A: Yes. Solo travellers are welcome on both private custom trips and scheduled group departures.

Q: What's the minimum budget for a trip?
A: Destination Pakistan packages typically start from around $1,500/person for 10–13 day trips. Shorter custom trips can be less. The final price depends on group size, season, hotels, and inclusions — share your budget and the team will find the best option.

Q: What's included in your packages?
A: Typically: private transport throughout, experienced local guide(s), accommodation, and planned sightseeing. Exact inclusions (meals, domestic flights, trekking permits, gear) vary by trip and are always specified in your quote.

Q: Do you offer honeymoon trips?
A: Yes. Destination Pakistan creates private, romantic honeymoon itineraries through the northern valleys.

Q: Can I travel with children?
A: Yes. Family-friendly trips are available — the team customises pace and activities for families.

Q: I'm a photographer/filmmaker — do you have special trips?
A: Yes. Photography and filmmaker trips with dedicated routes, timing for best light, and guides who understand content creation. Also see the PR Collaboration programme for discounted rates.

Q: What's the PR collaboration / can I travel for less?
A: Photographers, filmmakers, and content creators can travel at a significantly reduced rate in exchange for social media content (posts, stories, tags). DM @destinationpakistan on Instagram or message this bot to get started.

Q: Can I earn by leading trips?
A: Yes. If you have a community or following, you can lead group trips to Pakistan through Destination Pakistan and earn from it. Ask the team for details.

Q: What's the cancellation policy?
A: The 30% deposit is non-refundable. If you cancel after that, a service charge of up to 20% applies on the remaining amount. Postponements keep your money secure and we rebook at a new date.

Q: How do I pay?
A: A 30% deposit confirms your booking. The balance is due before or on Day 1 of your trip. Payment methods are confirmed with your quote.

Q: Do you cover destinations outside the north (Sindh, Balochistan)?
A: Yes — Destination Pakistan covers destinations including bioluminescent beaches (Makran coast), Mohenjo-daro, Toshangi Gorge (Grand Canyon of Sindh), and Pir Ghaib in Balochistan, among others.`;

// =============================================================================
// BUILDER FUNCTIONS
// =============================================================================

/**
 * Build the full static knowledge block injected into the agent's system prompt
 * on every message. The live package catalog is appended separately below.
 */
export function buildKnowledgeBase(): string {
  return [
    COMPANY_PROFILE,
    ALL_SERVICES,
    HOW_IT_WORKS,
    PAYMENT_POLICY,
    VISA_SERVICES,
    PR_COLLABORATION,
    DEALS,
    DESTINATION_GUIDES,
    PRACTICAL_INFO,
    FAQ,
  ].join('\n\n');
}

/**
 * Render the LIVE catalog from the database so the concierge always knows
 * current packages and their starting "from" prices. Loaded fresh per message.
 */
export function formatPackageCatalog(packages: PackageRow[]): string {
  if (packages.length === 0) {
    return (
      'LIVE PACKAGE CATALOG\n' +
      '- (No packages loaded right now.) Offer to tailor a custom trip and have the team confirm pricing.'
    );
  }
  const lines = packages.map((p) => {
    const dests = p.destinations.length > 0 ? ` | Destinations: ${p.destinations.join(', ')}` : '';
    const summary = p.summary ? ` — ${p.summary}` : '';
    return `- [${p.segment.toUpperCase()}] ${p.name} | ${p.duration_days} days | From $${p.base_price_usd}/person${dests}${summary}`;
  });
  return (
    'LIVE PACKAGE CATALOG (real current packages — you MAY share these names and "from" starting prices;\n' +
    'final pricing is always confirmed by a human at Destination Pakistan)\n' +
    lines.join('\n')
  );
}
