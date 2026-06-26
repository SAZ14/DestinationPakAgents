/**
 * Twilio WhatsApp inbound webhook.
 *
 *   POST /webhooks/twilio/whatsapp
 *
 * Step 2 scope: prove the loop — inbound WhatsApp -> find/create lead -> log
 * inbound -> send a fixed test reply -> log outbound. NO Claude, NO qualifier,
 * NO quotes. Step 3 replaces the fixed reply with the qualifier agent; this file
 * is structured so that swap is localized to `handleInbound`.
 *
 * Twilio posts application/x-www-form-urlencoded with fields including:
 *   From, To, Body, MessageSid, ProfileName (when the sender shares it).
 */

import { Router, type Request, type Response } from 'express';
import { env } from '../config/env';
import {
  sendWhatsAppMessage,
  stripWhatsAppPrefix,
  isValidTwilioSignature,
} from '../services/twilio/client';
import {
  findLeadByWhatsAppNumber,
  createLeadFromWhatsApp,
  updateLeadInboundActivity,
  updateLeadOutboundActivity,
  updateLeadQualification,
} from '../services/supabase/leads';
import {
  logConversation,
  getRecentConversationsForLead,
} from '../services/supabase/conversations';
import { qualifyLead, FALLBACK_REPLY } from '../agents/qualifier';

interface InboundPayload {
  from: string; // normalized (no whatsapp: prefix)
  body: string;
  messageSid: string | null;
  profileName: string | null;
}

/** Pull and normalize the fields we care about from the Twilio form body. */
function parseInbound(body: Record<string, unknown>): InboundPayload {
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const fromRaw = str(body.From);
  const profile = str(body.ProfileName).trim();
  return {
    from: stripWhatsAppPrefix(fromRaw),
    body: str(body.Body),
    messageSid: str(body.MessageSid) || null,
    profileName: profile !== '' ? profile : null,
  };
}

/**
 * Core inbound handler.
 *
 * Step 3: every inbound message is treated as a CUSTOMER lead message and run
 * through the Claude qualifier, which extracts fields, classifies the segment,
 * and writes the next warm reply.
 *
 * // Step 6 will route authenticated staff messages to the staff command parser.
 * // For Step 3, all inbound messages are treated as customer lead messages.
 */
async function handleInbound(payload: InboundPayload): Promise<void> {
  // 1. Find or create the lead by phone number.
  let lead = await findLeadByWhatsAppNumber(payload.from);
  if (!lead) {
    lead = await createLeadFromWhatsApp({
      number: payload.from,
      profileName: payload.profileName,
    });
  } else {
    await updateLeadInboundActivity(lead.id, payload.profileName);
  }

  // 2. Log the inbound customer message FIRST (so it survives even if the
  //    qualifier fails, and so it's part of the history we load next).
  await logConversation({
    leadId: lead.id,
    role: 'customer',
    channel: 'whatsapp',
    body: payload.body,
    twilioSid: payload.messageSid,
  });

  // 3. Load recent history (includes the message we just logged).
  const recentMessages = await getRecentConversationsForLead(lead.id, 12);

  // 4. Run the qualifier. It never throws — on failure it returns the fallback.
  const result = await qualifyLead({
    lead,
    recentMessages,
    inboundMessage: payload.body,
  });

  // 5. Persist extracted fields + status. Move 'new' leads at least to
  //    'qualifying'; never overwrite known fields with null (helper handles it).
  try {
    await updateLeadQualification(lead.id, {
      ...result.extractedFields,
      status: result.status,
    });
  } catch (err) {
    // Don't let a persistence hiccup block the reply — log and continue.
    console.error(
      '[twilio webhook] updateLeadQualification failed:',
      err instanceof Error ? err.message : err,
    );
  }

  // 6. Send the qualifier's reply (or the safe fallback).
  const reply = result.reply?.trim() ? result.reply : FALLBACK_REPLY;
  const { sid: outboundSid } = await sendWhatsAppMessage(payload.from, reply);

  // 7. Log the outbound agent message + bump outbound activity.
  await logConversation({
    leadId: lead.id,
    role: 'agent',
    channel: 'whatsapp',
    body: reply,
    twilioSid: outboundSid,
  });
  await updateLeadOutboundActivity(lead.id);
}

export function twilioWebhookRouter(): Router {
  const router = Router();

  router.post('/whatsapp', async (req: Request, res: Response) => {
    try {
      // Verify the request really came from Twilio (skippable in dev).
      const fullUrl = `${webhookBaseUrl()}/webhooks/twilio/whatsapp`;
      const signature = req.header('X-Twilio-Signature');
      const params = (req.body ?? {}) as Record<string, unknown>;
      if (!isValidTwilioSignature(signature, fullUrl, params)) {
        // Don't leak details; just reject.
        return res.status(403).json({ ok: false, error: 'invalid_signature' });
      }

      const payload = parseInbound(params);
      await handleInbound(payload);
      return res.status(200).json({ ok: true });
    } catch (err) {
      // Log the real error server-side; never expose it to Twilio.
      console.error('[twilio webhook] failed:', err instanceof Error ? err.message : err);
      return res.status(500).json({ ok: false, error: 'webhook_failed' });
    }
  });

  return router;
}

/** Public base URL Twilio used to reach us (for signature validation). */
function webhookBaseUrl(): string {
  return (env.publicWebhookBaseUrl ?? env.publicBaseUrl).replace(/\/+$/, '');
}
