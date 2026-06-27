"""Action tools — draft-then-confirm. Writes never auto-run.

``draft_broadcast`` builds a segment, generates copy, writes a ``pending_actions``
row, and returns ``{draft, segment_size, token}`` WITHOUT sending. The token is
released only by the confirm lane via ``queue_broadcast`` — which is never
exposed to the orchestrator.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from .context import ToolContext


@dataclass
class PendingAction:
    tenant_id: str
    sender: str
    token: str
    draft: str
    lead_ids: list[str]
    angle: str
    include_deposit_link: bool
    created_at: datetime
    expires_at: datetime

    def is_expired(self, now: datetime | None = None) -> bool:
        return (now or datetime.now(timezone.utc)) >= self.expires_at


class PendingActionStore:
    """In-memory ``pending_actions`` table with a TTL. Keyed by token; indexed
    by (tenant, sender) so the confirm lane can find the latest live draft."""

    def __init__(self, ttl_minutes: int = 30) -> None:
        self.ttl_minutes = ttl_minutes
        self._by_token: dict[str, PendingAction] = {}

    def create(self, *, tenant_id, sender, draft, lead_ids, angle,
               include_deposit_link) -> PendingAction:
        now = datetime.now(timezone.utc)
        token = secrets.token_hex(3).upper()  # e.g. "9F2A1C"
        action = PendingAction(
            tenant_id=tenant_id, sender=sender, token=token, draft=draft,
            lead_ids=list(lead_ids), angle=angle,
            include_deposit_link=include_deposit_link,
            created_at=now, expires_at=now + timedelta(minutes=self.ttl_minutes),
        )
        self._by_token[token] = action
        return action

    def get(self, token: str) -> PendingAction | None:
        action = self._by_token.get(token)
        if action and action.is_expired():
            self._by_token.pop(token, None)
            return None
        return action

    def latest_for(self, tenant_id: str, sender: str) -> PendingAction | None:
        live = [
            a for a in self._by_token.values()
            if a.tenant_id == tenant_id and a.sender == sender and not a.is_expired()
        ]
        if not live:
            return None
        return max(live, key=lambda a: a.created_at)

    def consume(self, token: str) -> PendingAction | None:
        """One token, one send: pop on release so it can't be replayed."""
        action = self.get(token)
        if action:
            self._by_token.pop(token, None)
        return action

    def cancel(self, token: str) -> bool:
        return self._by_token.pop(token, None) is not None


def draft_broadcast(
    ctx: ToolContext, *, lead_ids: list[str], angle: str,
    include_deposit_link: bool = False,
) -> dict:
    """Build the draft and a one-time token. DOES NOT SEND."""
    # Asaanpay deposit-link generation is the open dependency. Until it's wired,
    # force the flag off and tell the caller so the orchestrator can relay it.
    deposit_note = None
    if include_deposit_link and not ctx.settings.asaanpay_enabled:
        include_deposit_link = False
        deposit_note = "Asaanpay deposit link not wired yet — drafted without a pay link."

    leads = ctx.db.select("leads", ctx.tenant_id, lambda r: r["id"] in set(lead_ids))
    destinations = sorted({l["destination"] for l in leads})
    destination = destinations[0] if len(destinations) == 1 else "your trip"

    season_context = _season_context(ctx.today.month, destination)

    drafter = ctx.draft_copy  # set by the runner (LLM or mock)
    draft = drafter(
        destination=destination,
        angle=angle,
        season_context=season_context,
        include_deposit_link=include_deposit_link,
    )

    action = ctx.actions.create(
        tenant_id=ctx.tenant_id, sender=ctx.sender, draft=draft,
        lead_ids=[l["id"] for l in leads], angle=angle,
        include_deposit_link=include_deposit_link,
    )
    result = {
        "draft": draft,
        "segment_size": len(leads),
        "token": action.token,
        "include_deposit_link": include_deposit_link,
    }
    if deposit_note:
        result["note"] = deposit_note
    return result


def queue_broadcast(ctx: ToolContext, *, token: str) -> dict:
    """RELEASE. Confirm-lane only — never callable by the orchestrator.

    Requires a valid, unexpired token matching (tenant, sender). Sends are
    log-only for now (per build order); the per-lead merge is rendered here so
    the outbound copy is real even in log mode."""
    action = ctx.actions.get(token)
    if action is None:
        return {"sent": False, "reason": "no_such_or_expired_token"}
    if action.tenant_id != ctx.tenant_id or action.sender != ctx.sender:
        return {"sent": False, "reason": "token_owner_mismatch"}

    action = ctx.actions.consume(token)  # one token, one send
    assert action is not None

    leads = {l["id"]: l for l in ctx.db.select("leads", ctx.tenant_id)}
    rendered = []
    for lid in action.lead_ids:
        lead = leads.get(lid)
        if not lead:
            continue
        rendered.append(_render(action.draft, lead))

    return {
        "sent": True,
        "recipients": len(rendered),
        "token": token,
        "mode": "log_only",
        "sample": rendered[0] if rendered else None,
    }


def _render(draft: str, lead: dict) -> str:
    first_name = (lead.get("name") or "there").split()[0]
    return (
        draft.replace("{{first_name}}", first_name)
        .replace("{{destination}}", lead.get("destination", "your trip"))
    )


def _season_context(month: int, destination: str) -> str:
    if month in (5, 6, 7, 8, 9):
        return "peak northern-Pakistan season — high-altitude trips are open now"
    if month in (10, 11):
        return "shoulder season — passes start closing soon"
    return "off-season for high-altitude trips; planning ahead for summer"
