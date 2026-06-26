"""FastAPI app + the ``/wa/chief-of-staff`` WhatsApp webhook.

Lifecycle on every inbound:
  1. AUTH GATE — resolve tenant from the Twilio number, verify sender ∈ whitelist.
     Unauthorized → empty 200 (silent drop).
  2. Instant TwiML ack ("On it — pulling that now 🔎").
  3. Background task → run the agent → send the real answer as a SEPARATE
     outbound WhatsApp message (not TwiML).
"""

from __future__ import annotations

import logging

from fastapi import BackgroundTasks, FastAPI, Request, Response

from .adapters.anthropic_client import make_anthropic
from .adapters.apify_client import ApifyClient
from .adapters.db import seeded_database
from .adapters.twilio_client import TwilioClient
from .agent.runner import Agent
from .auth import authorize
from .config import SETTINGS
from .prompts import ACK_MESSAGE
from .tools.chief_of_staff.actions import PendingActionStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chief_of_staff.app")


def _ack_twiml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f"<Response><Message>{ACK_MESSAGE}</Message></Response>"
    )


def build_agent(settings=SETTINGS) -> Agent:
    return Agent(
        db=seeded_database(),
        anthropic=make_anthropic(settings),
        apify=ApifyClient(settings),
        actions=PendingActionStore(ttl_minutes=settings.pending_ttl_minutes),
        settings=settings,
    )


def create_app(*, agent: Agent | None = None, twilio: TwilioClient | None = None,
               settings=SETTINGS) -> FastAPI:
    app = FastAPI(title="Chief of Staff Agent", version="0.1.0")
    app.state.agent = agent or build_agent(settings)
    app.state.twilio = twilio or TwilioClient(settings)

    def _process(*, tenant_id: str, sender: str, to: str, body: str) -> None:
        try:
            reply = app.state.agent.handle(message=body, tenant_id=tenant_id, sender=sender)
        except Exception:  # never crash the worker; tell the owner something
            logger.exception("agent failure")
            reply = "Something went wrong pulling that. Try rephrasing?"
        # Second message: the real answer, sent FROM the tenant line TO the owner.
        app.state.twilio.send_whatsapp(to=sender, from_=to, body=reply)

    @app.get("/health")
    def health():
        return {"ok": True, "anthropic_live": SETTINGS.anthropic_live,
                "twilio_live": SETTINGS.twilio_live, "apify_live": SETTINGS.apify_live}

    @app.post("/wa/chief-of-staff")
    async def inbound(request: Request, background: BackgroundTasks):
        form = await request.form()
        to = form.get("To")
        sender = form.get("From")
        body = (form.get("Body") or "").strip()

        auth = authorize(twilio_to=to, twilio_from=sender)
        if not auth.authorized or auth.tenant is None:
            # Silent drop: empty 200, no TwiML body. Never confirm the line.
            return Response(status_code=200)

        if not body:
            return Response(content=_ack_twiml(), media_type="application/xml")

        background.add_task(
            _process, tenant_id=auth.tenant.tenant_id, sender=sender, to=to, body=body
        )
        return Response(content=_ack_twiml(), media_type="application/xml")

    @app.post("/simulate")
    async def simulate(request: Request):
        """Dev helper: run the agent synchronously and return the reply as JSON.
        Same auth gate as the real webhook. Not used by Twilio."""
        form = await request.form()
        to = form.get("To")
        sender = form.get("From")
        body = (form.get("Body") or "").strip()
        auth = authorize(twilio_to=to, twilio_from=sender)
        if not auth.authorized or auth.tenant is None:
            return Response(status_code=200)
        reply = app.state.agent.handle(message=body, tenant_id=auth.tenant.tenant_id, sender=sender)
        return {"reply": reply}

    return app


app = create_app()
