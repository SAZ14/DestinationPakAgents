"""Agent runner: classify → orchestrate → tool-loop → reply.

The confirm lane runs FIRST: if a pending action exists for (tenant, sender) and
the body is a confirmation, we handle it here and skip classification entirely.
This is also where ``queue_broadcast`` — the release tool the orchestrator can
never see — is invoked.
"""

from __future__ import annotations

import logging
import re
from datetime import date

from ..adapters.anthropic_client import AnthropicAdapter, CONFIRM_RE
from ..adapters.apify_client import ApifyClient
from ..adapters.db import Database
from ..config import Settings
from ..tools.chief_of_staff import actions as action_tools
from ..tools.chief_of_staff.actions import PendingActionStore
from ..tools.chief_of_staff.context import ToolContext

logger = logging.getLogger("chief_of_staff.runner")

_CONFIRM_PARSE = re.compile(
    r"^\s*(?P<verb>send|yes|confirm|edit|cancel|no)\b\s*(?P<token>[A-Za-z0-9]{4,8})?\s*(?P<rest>.*)$",
    re.IGNORECASE | re.DOTALL,
)


class Agent:
    def __init__(
        self, *, db: Database, anthropic: AnthropicAdapter, apify: ApifyClient,
        actions: PendingActionStore, settings: Settings,
    ) -> None:
        self.db = db
        self.anthropic = anthropic
        self.apify = apify
        self.actions = actions
        self.settings = settings

    def _context(self, tenant_id: str, sender: str, today: date) -> ToolContext:
        ctx = ToolContext(
            tenant_id=tenant_id, sender=sender, db=self.db, apify=self.apify,
            settings=self.settings, actions=self.actions, today=today,
        )
        # Wire the drafter so draft_broadcast can produce copy without a cycle.
        ctx.draft_copy = self.anthropic.draft_copy
        return ctx

    def handle(self, *, message: str, tenant_id: str, sender: str,
               today: date | None = None) -> str:
        today = today or date.today()
        ctx = self._context(tenant_id, sender, today)

        # 1. Confirm lane (runs before classification).
        pending = self.actions.latest_for(tenant_id, sender)
        if pending and CONFIRM_RE.match(message):
            return self._confirm(ctx, message, pending)

        # 2. Classify.
        classification = self.anthropic.classify(message)
        lane = classification.get("lane", "query")

        if lane == "confirm":
            if pending:
                return self._confirm(ctx, message, pending)
            return "Nothing pending to confirm. Ask me to draft a follow-up first."

        if lane == "smalltalk":
            return self.anthropic.smalltalk(message)

        # 3. query / action / intelligence → orchestrate over the tool registry.
        return self.anthropic.orchestrate(message=message, classification=classification, ctx=ctx)

    # -- confirm lane -------------------------------------------------------
    def _confirm(self, ctx: ToolContext, message: str, pending) -> str:
        m = _CONFIRM_PARSE.match(message)
        verb = (m.group("verb") if m else "").lower()
        token = (m.group("token") if m else None) or pending.token
        rest = (m.group("rest") if m else "").strip()
        token = token.upper()

        if verb in ("send", "yes", "confirm"):
            result = action_tools.queue_broadcast(ctx, token=token)
            if result.get("sent"):
                return (f"✅ Sent to {result['recipients']} lead"
                        f"{'s' if result['recipients'] != 1 else ''} (log-only mode).")
            return f"Couldn't send — {result.get('reason')}. Draft may have expired; ask me to redraft."

        if verb == "edit":
            # Re-draft the same segment, folding the requested change into the angle.
            self.actions.cancel(token)
            angle = _angle_from_changes(rest, pending.angle)
            redraft = action_tools.draft_broadcast(
                ctx, lead_ids=pending.lead_ids, angle=angle,
                include_deposit_link=pending.include_deposit_link,
            )
            n = redraft["segment_size"]
            return (f"Revised draft ({n} leads):\n{redraft['draft']}\n\n"
                    f"Reply SEND {redraft['token']} to send, EDIT {redraft['token']} <changes> "
                    f"to revise again, or ignore.")

        if verb in ("cancel", "no"):
            self.actions.cancel(token)
            return "Cancelled — nothing sent."

        return "Reply SEND <token>, EDIT <token> <changes>, or CANCEL."


def _angle_from_changes(changes: str, default: str) -> str:
    t = (changes or "").lower()
    if "price" in t or "discount" in t:
        return "price nudge"
    if "deposit" in t:
        return "deposit push"
    if "season" in t or "urgen" in t:
        return "season urgency"
    if "re-engage" in t or "reengage" in t or "warm" in t:
        return "re-engage"
    return default
