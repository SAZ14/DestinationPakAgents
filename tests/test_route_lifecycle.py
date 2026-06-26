import re

import pytest
from fastapi.testclient import TestClient

from app.config import DESTINATION_PAKISTAN
from app.adapters.twilio_client import TwilioClient
from app.main import build_agent, create_app

from .conftest import MOCK_SETTINGS

DP_NUMBER = DESTINATION_PAKISTAN.twilio_number
OWNER = next(iter(DESTINATION_PAKISTAN.whitelist))
STRANGER = "whatsapp:+19998887777"
TOKEN_RE = re.compile(r"SEND\s+([A-Z0-9]{4,8})")


@pytest.fixture
def twilio():
    return TwilioClient(MOCK_SETTINGS)


@pytest.fixture
def client(twilio):
    app = create_app(agent=build_agent(MOCK_SETTINGS), twilio=twilio, settings=MOCK_SETTINGS)
    return TestClient(app)


def _post(client, *, to, frm, body):
    return client.post("/wa/chief-of-staff", data={"To": to, "From": frm, "Body": body})


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_authorized_inbound_acks_and_sends_separate_message(client, twilio):
    r = _post(client, to=DP_NUMBER, frm=OWNER, body="how many leads do we have?")
    assert r.status_code == 200
    assert "On it" in r.text  # instant TwiML ack
    # Background task ran synchronously under TestClient → outbound recorded.
    assert len(twilio.sent) == 1
    out = twilio.sent[0]
    assert out.to == OWNER
    assert out.from_ == DP_NUMBER
    assert "18" in out.body  # the real answer, as a separate message


def test_unauthorized_sender_silent_drop(client, twilio):
    r = _post(client, to=DP_NUMBER, frm=STRANGER, body="how many leads?")
    assert r.status_code == 200
    assert r.content == b""  # no TwiML body
    assert twilio.sent == []  # nothing sent


def test_unknown_tenant_number_silent_drop(client, twilio):
    r = _post(client, to="whatsapp:+10000000001", frm=OWNER, body="how many leads?")
    assert r.status_code == 200
    assert r.content == b""
    assert twilio.sent == []


def test_full_confirm_flow_over_two_webhooks(client, twilio):
    # 1. Owner asks for a broadcast draft.
    _post(client, to=DP_NUMBER, frm=OWNER, body="draft a follow up to Hunza leads who didn't book")
    draft_reply = twilio.sent[-1].body
    assert "SEND" in draft_reply
    token = TOKEN_RE.search(draft_reply).group(1)

    # 2. Owner confirms with the token → the broadcast is released (log-only).
    _post(client, to=DP_NUMBER, frm=OWNER, body=f"SEND {token}")
    send_reply = twilio.sent[-1].body
    assert send_reply.startswith("✅ Sent")


def test_competitor_intelligence_via_route(client, twilio):
    _post(client, to=DP_NUMBER, frm=OWNER, body="what are competitors charging for Hunza?")
    body = twilio.sent[-1].body
    assert "competitor" in body.lower() or "undercut" in body.lower() or "Hunza" in body
