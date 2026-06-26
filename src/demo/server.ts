/**
 * Asaan Intelligence — owner demo server.
 *
 * A self-contained, browser-based demo of the WhatsApp Travel Concierge that
 * runs the REAL agents (qualifier + quote) against the REAL knowledge base, but
 * with in-memory state instead of Supabase/Twilio. The only requirement is an
 * ANTHROPIC_API_KEY in .env.
 *
 *   npm run demo
 *   → open http://localhost:4000
 *
 * Left panel = the customer's WhatsApp. Right panel = the staff Ops Console,
 * where the lead record fills in live and drafted quotes are approved. Approving
 * sends the quote to the customer panel — the full human-in-the-loop flow.
 */

import path from 'path';
import express from 'express';
import { env } from '../config/env';
import { qualifyLead, FALLBACK_REPLY } from '../agents/qualifier';
import { draftQuote } from '../agents/quote';
import {
  getOrCreateSession,
  resetSession,
  addMessage,
  applyPatch,
  DEMO_PACKAGES,
  type DemoSession,
} from './store';

const DEMO_PORT = Number(process.env.DEMO_PORT ?? 4000);

/** Shape returned to the browser — the public view of a session. */
function view(session: DemoSession) {
  return {
    lead: session.lead,
    messages: session.messages.map((m) => ({ role: m.role, body: m.body, at: m.created_at })),
    quote: session.quote,
    catalogCount: DEMO_PACKAGES.length,
  };
}

function createDemoApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // Customer sends a WhatsApp message.
  app.post('/api/demo/message', async (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId ?? '').trim();
      const body = String(req.body?.body ?? '').trim();
      if (!sessionId || !body) {
        return res.status(400).json({ ok: false, error: 'sessionId and body are required' });
      }

      const session = getOrCreateSession(sessionId);
      addMessage(session, 'customer', body);

      // Run the real concierge against the real knowledge base + catalog.
      const result = await qualifyLead({
        lead: session.lead,
        recentMessages: session.messages,
        inboundMessage: body,
        packages: DEMO_PACKAGES,
      });

      applyPatch(session.lead, { ...result.extractedFields, status: result.status });

      const reply = result.reply?.trim() ? result.reply : FALLBACK_REPLY;
      addMessage(session, 'agent', reply);

      // When the lead qualifies, auto-draft a quote for staff approval (once).
      let quoteDrafted = false;
      if (result.status === 'qualified' && !session.quote) {
        const draft = await draftQuote({ lead: session.lead, packages: DEMO_PACKAGES });
        session.quote = { ...draft, status: 'awaiting_approval' };
        session.lead.status = 'awaiting_approval';
        quoteDrafted = true;
      }

      return res.json({ ok: true, quoteDrafted, ...view(session) });
    } catch (err) {
      console.error('[demo] message failed:', err instanceof Error ? err.message : err);
      return res.status(500).json({ ok: false, error: errorHint(err) });
    }
  });

  // Staff approves the pending quote → it is "sent" to the customer.
  app.post('/api/demo/approve', (req, res) => {
    const session = getOrCreateSession(String(req.body?.sessionId ?? ''));
    if (!session.quote || session.quote.status !== 'awaiting_approval') {
      return res.status(400).json({ ok: false, error: 'No quote awaiting approval.' });
    }
    if (session.quote.needsHumanPricing && session.quote.priceUsd == null) {
      return res
        .status(400)
        .json({ ok: false, error: 'Quote needs a human price before it can be sent.' });
    }
    session.quote.status = 'sent';
    session.lead.status = 'sent';
    // Deliver the staff-reviewed quote message + itinerary to the customer.
    addMessage(session, 'agent', session.quote.quoteMessage);
    addMessage(session, 'agent', session.quote.itineraryMd);
    return res.json({ ok: true, ...view(session) });
  });

  // Staff rejects the pending quote → lead stays qualified.
  app.post('/api/demo/reject', (req, res) => {
    const session = getOrCreateSession(String(req.body?.sessionId ?? ''));
    if (session.quote) session.quote.status = 'rejected';
    session.lead.status = 'qualified';
    return res.json({ ok: true, ...view(session) });
  });

  app.post('/api/demo/reset', (req, res) => {
    const session = resetSession(String(req.body?.sessionId ?? 'default'));
    return res.json({ ok: true, ...view(session) });
  });

  app.get('/api/demo/state', (req, res) => {
    const session = getOrCreateSession(String(req.query.sessionId ?? 'default'));
    return res.json({ ok: true, ...view(session) });
  });

  return app;
}

/** Friendlier hint when the usual culprit (missing API key) bites. */
function errorHint(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/ANTHROPIC_API_KEY/i.test(msg)) {
    return 'ANTHROPIC_API_KEY is missing. Add it to .env and restart `npm run demo`.';
  }
  return 'Something went wrong running the concierge. Check the server logs.';
}

function main(): void {
  const app = createDemoApp();
  app.listen(DEMO_PORT, () => {
    console.log('\n  Asaan Intelligence — Owner Demo');
    console.log(`  ▶ open  http://localhost:${DEMO_PORT}\n`);
    if (!env.anthropicApiKey) {
      console.warn('  ⚠ ANTHROPIC_API_KEY is not set — add it to .env or the demo cannot reply.\n');
    }
  });
}

if (require.main === module) {
  main();
}

export { createDemoApp };
