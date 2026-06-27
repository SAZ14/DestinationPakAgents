"""Execution context threaded into every tool call.

The context carries the server-resolved ``tenant_id`` and ``sender``; tools read
them from here and inject ``tenant_id`` into every query. The model never sees
this object — it only ever fills in tool *parameters*.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from ...adapters.apify_client import ApifyClient
from ...adapters.db import Database
from ...config import Settings


@dataclass
class ToolContext:
    tenant_id: str
    sender: str
    db: Database
    apify: ApifyClient
    settings: Settings
    actions: "PendingActionStore"  # forward ref, set in actions.py
    today: date
    # The drafter callable (set by the runner) generates broadcast copy. Kept as
    # an attribute so draft_broadcast can call into the LLM/mock without a hard
    # import cycle.
    draft_copy = None  # type: ignore[assignment]
