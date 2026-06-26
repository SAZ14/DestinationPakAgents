/* ===== Asaan demo engine: WATCH (scripted) + LIVE (type your own) ===== */
const WATCH = __WATCH__;
const PACKAGES = __PACKAGES__;
const QUALIFIER_SYSTEM = __QUALSYS__;
const QUOTE_SYSTEM = __QUOTESYS__;
const MODEL = __MODEL__;
const WELCOME = __WELCOME__;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);
let LIVE = false;
let API_KEY = '';
let liveLead = null, liveMsgs = [], liveQuote = null;

// resetDemo is bound to a header button in the markup; make it safe offline.
resetDemo = function () {
  $('chat').innerHTML = '';
  $('quoteArea').innerHTML = '';
  renderLead({ status: 'new', destinations: [] });
  renderQuote(null);
  bubble('agent', WELCOME);
};

function setComposer(enabled) {
  $('input').disabled = !enabled;
  $('sendBtn').disabled = !enabled;
  $('input').placeholder = enabled ? 'Type your message…' : '(press ▶ Watch demo, or 🔴 Go live to type)';
}

/* ---------------- WATCH MODE (scripted replay of a real run) ---------------- */
async function watch() {
  LIVE = false;
  setComposer(false);
  $('chips').style.display = 'none';
  $('modeNote').textContent = '▶ Recorded walkthrough';
  resetDemo();
  await sleep(800);
  for (const turn of WATCH.turns) {
    bubble('customer', turn.customer);
    setBusy(true);
    await sleep(1400);
    setBusy(false);
    bubble('agent', turn.agent);
    renderLead(turn.lead);
    await sleep(2100);
  }
  const q = Object.assign({}, WATCH.quote, { status: 'awaiting_approval' });
  renderQuote(q);
  $('statusBadge').textContent = 'awaiting approval';
  $('statusBadge').className = 'badge awaiting_approval';
  await sleep(2600);
  renderQuote(Object.assign({}, WATCH.quote, { status: 'sent' }));
  renderLead(WATCH.finalLead);
  await sleep(700);
  bubble('agent', WATCH.sentMsgs[0]);
  await sleep(900);
  bubble('agent', WATCH.sentMsgs[1], true);
}

/* ---------------- LIVE MODE (real AI, type your own) ---------------- */
function newLiveLead() {
  return {
    name: null, nationality: null, city: null, segment: null, num_people: null,
    start_date: null, end_date: null, budget_usd: null, luxury_level: null,
    destinations: [], hotel_pref: null, transport_pref: null, dietary: null,
    visa_help: false, special_requests: null, status: 'new',
  };
}

function goLive() {
  const key = (API_KEY || prompt('Paste your Anthropic API key (sk-ant-…). It stays in this browser only and is never uploaded anywhere except Anthropic.') || '').trim();
  if (!key) return;
  API_KEY = key;
  LIVE = true;
  liveLead = newLiveLead();
  liveMsgs = [];
  liveQuote = null;
  $('chat').innerHTML = '';
  $('quoteArea').innerHTML = '';
  renderLead(liveLead);
  renderQuote(null);
  $('chips').style.display = 'flex';
  $('modeNote').textContent = '🔴 Live — type anything';
  setComposer(true);
  bubble('agent', WELCOME);
  $('input').focus();
}

function knownFields(lead) {
  const snap = {};
  for (const k of ['name','nationality','city','segment','num_people','start_date','end_date','budget_usd','luxury_level','destinations','hotel_pref','transport_pref','dietary','visa_help','special_requests','status']) {
    const v = lead[k];
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    snap[k] = v;
  }
  return snap;
}
function transcript(msgs) {
  if (!msgs.length) return '(no prior messages)';
  const label = { customer: 'Customer', agent: 'Concierge', staff: 'Staff' };
  return msgs.map((m) => (label[m.role] || m.role) + ': ' + m.body).join('\n');
}
function leadFacts(lead) {
  return {
    name: lead.name, nationality: lead.nationality, num_people: lead.num_people,
    start_date: lead.start_date, end_date: lead.end_date, budget_usd_per_person: lead.budget_usd,
    luxury_level: lead.luxury_level, destinations: lead.destinations, hotel_pref: lead.hotel_pref,
    transport_pref: lead.transport_pref, dietary: lead.dietary, visa_help: lead.visa_help,
    special_requests: lead.special_requests, segment: lead.segment,
  };
}
function applyPatch(lead, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'status') { if (v) lead.status = v; continue; }
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    lead[k] = v;
  }
}
function normalizeFields(o) {
  o = o || {};
  const out = {};
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const num = (v) => (typeof v === 'number' ? v : (v != null && !isNaN(Number(v)) && String(v).trim() ? Number(v) : undefined));
  for (const k of ['name','nationality','city','segment','start_date','end_date','luxury_level','hotel_pref','transport_pref','dietary','special_requests']) {
    const s = str(o[k]); if (s !== undefined) out[k] = s;
  }
  if (num(o.num_people) !== undefined) out.num_people = num(o.num_people);
  if (num(o.budget_usd) !== undefined) out.budget_usd = num(o.budget_usd);
  if (typeof o.visa_help === 'boolean') out.visa_help = o.visa_help;
  if (Array.isArray(o.destinations)) {
    const arr = o.destinations.filter((x) => typeof x === 'string' && x.trim()).map((s) => s.trim());
    if (arr.length) out.destinations = arr;
  }
  return out;
}

// Pure JS port of matchPackage (same scoring as src/agents/quote.ts).
function destOverlap(a, b) {
  const setB = new Set((b || []).map((d) => d.toLowerCase().trim()));
  return (a || []).reduce((n, d) => (setB.has(d.toLowerCase().trim()) ? n + 1 : n), 0);
}
function scorePackage(lead, p) {
  let s = 0;
  if (lead.segment && p.segment === lead.segment) s += 100;
  s += destOverlap(lead.destinations, p.destinations) * 20;
  if (lead.start_date && lead.end_date) {
    const days = Math.round((new Date(lead.end_date) - new Date(lead.start_date)) / 86400000) + 1;
    if (days > 0) s += Math.max(0, 15 - Math.abs(p.duration_days - days));
  }
  return s;
}
function matchPackage(lead) {
  if (!PACKAGES.length) return { pkg: null, needsHumanPricing: true, note: 'No packages.' };
  const same = lead.segment ? PACKAGES.filter((p) => p.segment === lead.segment) : [];
  const pool = same.length ? same : PACKAGES;
  const best = pool.map((p) => ({ p, s: scorePackage(lead, p) })).sort((a, b) => b.s - a.s)[0].p;
  const notes = [];
  if (!same.length && lead.segment) notes.push('No exact "' + lead.segment + '" package; matched closest.');
  let needsHumanPricing = false;
  if (lead.budget_usd != null && lead.budget_usd < best.base_price_usd) {
    needsHumanPricing = true;
    notes.push('Budget ~$' + lead.budget_usd + '/pp is below "' + best.name + '" from $' + best.base_price_usd + '/pp — needs human pricing.');
  }
  if (!notes.length) notes.push('Matched "' + best.name + '" (from $' + best.base_price_usd + '/pp).');
  return { pkg: best, needsHumanPricing, note: notes.join(' ') };
}

function extractJson(text) {
  let t = (text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) t = fence[1].trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a === -1 || b === -1 || b < a) throw new Error('no JSON in model reply');
  return JSON.parse(t.slice(a, b + 1));
}

async function callClaude(system, userContent, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: userContent }] }),
  });
  if (!r.ok) throw new Error('Anthropic API ' + r.status + ': ' + (await r.text()).slice(0, 160));
  const j = await r.json();
  return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

// Override the interactive handlers for LIVE mode.
send = async function () {
  if (!LIVE) { alert('Click "🔴 Go live" first to type your own messages.'); return; }
  const input = $('input');
  const text = input.value.trim();
  if (!text || busy) return;
  input.value = '';
  bubble('customer', text);
  liveMsgs.push({ role: 'customer', body: text });
  setBusy(true);
  try {
    const userContent =
      'CURRENT LEAD RECORD (already known — do not re-ask these):\n' + JSON.stringify(knownFields(liveLead), null, 2) +
      '\n\nCONVERSATION HISTORY (oldest first):\n' + transcript(liveMsgs) +
      '\n\nLATEST CUSTOMER MESSAGE:\n' + text + '\n\nReturn the JSON object now.';
    const raw = await callClaude(QUALIFIER_SYSTEM, userContent, 1024);
    const parsed = extractJson(raw);
    const reply = (typeof parsed.reply === 'string' && parsed.reply.trim()) ? parsed.reply.trim()
      : "Thanks — could you share your travel dates, group size, and the places you'd like to visit?";
    const fields = normalizeFields(parsed.extractedFields);
    const status = parsed.requiredFieldsComplete === true ? 'qualified' : 'qualifying';
    applyPatch(liveLead, Object.assign({}, fields, { status }));
    liveMsgs.push({ role: 'agent', body: reply });
    bubble('agent', reply);
    renderLead(liveLead);
    if (status === 'qualified' && !liveQuote) await draftLiveQuote();
  } catch (e) {
    bubble('agent', '⚠ ' + e.message);
  }
  setBusy(false);
  input.focus();
};

async function draftLiveQuote() {
  const m = matchPackage(liveLead);
  const priceUsd = m.pkg ? m.pkg.base_price_usd : null;
  let itineraryMd = '', quoteMessage = '';
  try {
    const userContent =
      'MATCHED PACKAGE (catalog — use this price only):\n' +
      JSON.stringify({
        name: m.pkg.name, segment: m.pkg.segment, duration_days: m.pkg.duration_days,
        price_usd_per_person_from: m.pkg.base_price_usd, destinations: m.pkg.destinations, summary: m.pkg.summary,
      }, null, 2) +
      '\n\nneedsHumanPricing: ' + m.needsHumanPricing +
      '\n\nLEAD (tailor the itinerary to this):\n' + JSON.stringify(leadFacts(liveLead), null, 2) +
      '\n\nReturn the JSON object now.';
    const raw = await callClaude(QUOTE_SYSTEM, userContent, 2048);
    const p = extractJson(raw);
    itineraryMd = p.itineraryMd || '';
    quoteMessage = p.quoteMessage || '';
  } catch (e) {
    quoteMessage = 'Thank you! Our team is putting together your tailored plan and will share it shortly.';
    itineraryMd = '_Itinerary drafting hit an error: ' + e.message + '_';
  }
  liveQuote = {
    packageName: m.pkg ? m.pkg.name : null, priceUsd, itineraryMd, quoteMessage,
    needsHumanPricing: m.needsHumanPricing, matchNote: m.note, status: 'awaiting_approval',
  };
  liveLead.status = 'awaiting_approval';
  renderLead(liveLead);
  renderQuote(liveQuote);
}

approve = function () {
  if (!liveQuote || liveQuote.status !== 'awaiting_approval') return;
  if (liveQuote.needsHumanPricing && liveQuote.priceUsd == null) { alert('Needs a human price first.'); return; }
  liveQuote.status = 'sent';
  liveLead.status = 'sent';
  renderLead(liveLead);
  renderQuote(liveQuote);
  bubble('agent', liveQuote.quoteMessage);
  bubble('agent', liveQuote.itineraryMd, true);
};
reject = function () {
  if (!liveQuote) return;
  liveQuote.status = 'rejected';
  liveLead.status = 'qualified';
  renderLead(liveLead);
  renderQuote(liveQuote);
};

watch();
