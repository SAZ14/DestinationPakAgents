import re

import pytest

from app.tools.chief_of_staff import actions as action_tools
from app.tools.chief_of_staff import registry

TENANT = "destination-pakistan"
OWNER = "whatsapp:+923001112233"
OTHER = "whatsapp:+923004445566"

TOKEN_RE = re.compile(r"SEND\s+([A-Z0-9]{4,8})")


def _token(reply: str) -> str:
    m = TOKEN_RE.search(reply)
    assert m, f"no token in reply: {reply!r}"
    return m.group(1)


def test_queue_broadcast_is_not_orchestrator_callable():
    names = {t["name"] for t in registry.ORCHESTRATOR_TOOLS}
    assert "queue_broadcast" not in names
    assert "queue_broadcast" not in registry.DISPATCH


def test_draft_broadcast_drafts_but_does_not_send(ctx):
    seg = registry.execute(ctx, "segment_no_booking", {"destination": "Hunza"})
    out = registry.execute(ctx, "draft_broadcast", {
        "lead_ids": seg["lead_ids"], "angle": "re-engage",
    })
    assert out["segment_size"] == seg["segment_size"]
    assert out["token"]
    # A pending row was written; nothing was sent.
    assert ctx.actions.get(out["token"]) is not None


def test_draft_broadcast_deposit_link_blocked_until_asaanpay(ctx):
    seg = registry.execute(ctx, "segment_no_booking", {"destination": "Hunza"})
    out = registry.execute(ctx, "draft_broadcast", {
        "lead_ids": seg["lead_ids"], "angle": "deposit push",
        "include_deposit_link": True,
    })
    assert out["include_deposit_link"] is False
    assert "note" in out and "Asaanpay" in out["note"]


def test_confirm_send_flow_one_token_one_send(agent, today):
    reply = agent.handle(
        message="draft a re-engage follow up to Hunza leads who didn't book",
        tenant_id=TENANT, sender=OWNER, today=today,
    )
    assert "SEND" in reply
    token = _token(reply)

    sent = agent.handle(message=f"SEND {token}", tenant_id=TENANT, sender=OWNER, today=today)
    assert sent.startswith("✅ Sent")

    # Token is consumed — a replay can't re-send.
    replay = agent.handle(message=f"SEND {token}", tenant_id=TENANT, sender=OWNER, today=today)
    assert "Couldn't send" in replay or "Nothing pending" in replay


def test_confirm_cancel(agent, today):
    reply = agent.handle(
        message="draft a follow up to Skardu leads", tenant_id=TENANT, sender=OWNER, today=today,
    )
    token = _token(reply)
    out = agent.handle(message=f"CANCEL {token}", tenant_id=TENANT, sender=OWNER, today=today)
    assert "Cancelled" in out
    assert agent.actions.get(token) is None


def test_confirm_edit_redrafts_with_new_token(agent, today):
    reply = agent.handle(
        message="draft a follow up to Hunza leads", tenant_id=TENANT, sender=OWNER, today=today,
    )
    token = _token(reply)
    edited = agent.handle(
        message=f"EDIT {token} make it about the price", tenant_id=TENANT, sender=OWNER, today=today,
    )
    assert "Revised draft" in edited
    new_token = _token(edited)
    assert new_token != token
    # Old token invalidated, new one live.
    assert agent.actions.get(token) is None
    assert agent.actions.get(new_token) is not None


def test_queue_broadcast_rejects_other_sender(ctx):
    seg = registry.execute(ctx, "segment_no_booking", {"destination": "Hunza"})
    out = registry.execute(ctx, "draft_broadcast", {"lead_ids": seg["lead_ids"], "angle": "re-engage"})
    token = out["token"]
    # A different sender (even same tenant) cannot release this token.
    ctx.sender = OTHER
    res = action_tools.queue_broadcast(ctx, token=token)
    assert res["sent"] is False
    assert res["reason"] == "token_owner_mismatch"


def test_queue_broadcast_unknown_token(ctx):
    res = action_tools.queue_broadcast(ctx, token="ZZZZZZ")
    assert res["sent"] is False
    assert res["reason"] == "no_such_or_expired_token"
