#!/usr/bin/env python3
"""Offline demo of the Chief of Staff Agent — no WhatsApp/Twilio needed.

Runs a scripted owner conversation against the agent in fully-mocked mode
(deterministic classifier/orchestrator, in-memory seed data, logged-only
outbound) and prints the transcript. The draft→SEND exchange shows the
draft-then-confirm gate: the agent never sends until the owner replies SEND.

Usage:
    python scripts/demo.py
"""

from __future__ import annotations

import dataclasses
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.adapters.db import BASE_TODAY  # noqa: E402
from app.config import SETTINGS  # noqa: E402
from app.main import build_agent  # noqa: E402

# Force fully-mocked mode regardless of ambient credentials so the demo is
# deterministic and never touches the network.
MOCK = dataclasses.replace(
    SETTINGS, anthropic_api_key=None, apify_token=None,
    twilio_account_sid=None, twilio_auth_token=None,
)

TENANT = "destination-pakistan"
OWNER = "whatsapp:+923001112233"
TOKEN_RE = re.compile(r"SEND\s+([A-Z0-9]{4,8})")


def main() -> None:
    agent = build_agent(MOCK)

    def say(message: str) -> str:
        reply = agent.handle(message=message, tenant_id=TENANT, sender=OWNER, today=BASE_TODAY)
        print(f"\n\033[1;36mOwner ▸\033[0m {message}")
        print(f"\033[1;32mChief of Staff ▸\033[0m\n{reply}")
        return reply

    print("=" * 70)
    print(" Chief of Staff Agent — offline demo (mock mode, seed data)")
    print(" Tenant: Destination Pakistan   'Today': " + BASE_TODAY.isoformat())
    print("=" * 70)

    # --- READS (auto-run) ---
    say("how many leads do we have?")
    say("count leads by status")
    say("how many American leads for Hunza?")
    say("what's our pipeline this month by destination?")
    say("which quotes have gone stale?")
    say("worst vendors by feedback")

    # --- INTELLIGENCE ---
    say("what are competitors charging for Hunza?")

    # --- ACTION (draft-then-confirm) ---
    draft = say("draft a season-urgency follow-up to Skardu leads who didn't book")
    m = TOKEN_RE.search(draft)
    if m:
        token = m.group(1)
        print("\n  …the agent DRAFTED but did not send. Owner now confirms:")
        say(f"SEND {token}")

    # --- A blocked write proves the gate (unauthorized number would be dropped
    #     at the route; here we show a confirm with no pending draft) ---
    say("SEND ABC123")

    print("\n" + "=" * 70)
    print(" Done. Same flow runs over real WhatsApp via POST /wa/chief-of-staff.")
    print("=" * 70)


if __name__ == "__main__":
    main()
