# Webhooks

Inbound HTTP entrypoints from external providers. Currently: Twilio WhatsApp.

## `POST /webhooks/twilio/whatsapp`

The inbound WhatsApp webhook. Twilio calls this URL (configured in the Twilio
Console) every time a user messages the sandbox/production WhatsApp number.

### What it does (Step 2 — echo loop)

1. **Validates** the request came from Twilio (HMAC signature), unless
   `SKIP_TWILIO_SIGNATURE_VALIDATION=true`.
2. **Parses** the Twilio form payload and normalizes the sender number (strips
   the `whatsapp:` prefix).
3. **Finds or creates** the `leads` row by `whatsapp_number`.
   - New lead → `source=whatsapp`, `status=new`, `name=ProfileName?`,
     `last_inbound_at=now()`.
   - Existing lead → bumps `last_inbound_at`; sets `name` only if it was null.
4. **Logs** the inbound message to `conversations` (`role=customer`).
5. **Sends** a fixed test reply via the Twilio REST API.
6. **Logs** the outbound reply to `conversations` (`role=agent`) and bumps
   `last_outbound_at`.

> Step 3 swaps the fixed reply for the Claude qualifier. That change is isolated
> to `handleInbound` in `twilio.ts` — transport, lookup, and logging stay put.

### Expected fields (Twilio `application/x-www-form-urlencoded`)

| Field         | Used for                                  |
| ------------- | ----------------------------------------- |
| `From`        | Sender, e.g. `whatsapp:+923001234567`     |
| `To`          | The WhatsApp number messaged (our sender) |
| `Body`        | Message text                              |
| `MessageSid`  | Stored as `twilio_sid` for traceability   |
| `ProfileName` | Lead name (when the sender shares it)     |

### Responses

| Outcome             | Status | Body                                       |
| ------------------- | ------ | ------------------------------------------ |
| Success             | 200    | `{ "ok": true }`                           |
| Bad signature       | 403    | `{ "ok": false, "error": "invalid_signature" }` |
| Any internal error  | 500    | `{ "ok": false, "error": "webhook_failed" }`    |

Errors are logged server-side only — no secrets or stack traces are returned.

### How to test

See the **"Step 2: Twilio Sandbox Echo Test"** section in the project root
`README.md` for the full ngrok + Twilio Sandbox walkthrough.

Quick local sanity check (no Twilio/Supabase needed) — confirms the route is
mounted and the error path is clean (returns 500 because no DB is configured):

```bash
curl -s -X POST http://localhost:3000/webhooks/twilio/whatsapp \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'From=whatsapp:%2B923001234567&To=whatsapp:%2B14155238886&Body=hi&MessageSid=SM1&ProfileName=Test'
```
