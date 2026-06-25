/**
 * Asaan Intelligence — HTTP server entrypoint.
 *
 * Step 1: only a health check + a friendly root route. Twilio webhooks, the
 * concierge agent, and admin commands are wired in in later steps.
 *
 * Modular structure (filling in as we go):
 *   src/config        — env + validation
 *   src/services      — supabase / twilio / anthropic clients
 *   src/agents        — Claude-backed agents (qualifier, quote, recovery, commands)
 *   src/webhooks      — Twilio inbound webhook handlers
 *   src/jobs          — scheduled jobs (lead recovery)
 */

import express from 'express';
import { env } from './config/env';
import { twilioWebhookRouter } from './webhooks/twilio';

export function createApp(): express.Express {
  const app = express();

  // Twilio posts application/x-www-form-urlencoded webhooks.
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'asaan-intelligence', ts: new Date().toISOString() });
  });

  // Twilio WhatsApp inbound webhook (Step 2).
  app.use('/webhooks/twilio', twilioWebhookRouter());

  app.get('/', (_req, res) => {
    res
      .type('text/plain')
      .send('Asaan Intelligence — WhatsApp concierge for Destination Pakistan. See /health.');
  });

  return app;
}

function main(): void {
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`Asaan Intelligence listening on :${env.port}`);
    console.log(`Health:  ${env.publicBaseUrl}/health`);
  });
}

if (require.main === module) {
  main();
}
