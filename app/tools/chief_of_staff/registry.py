"""Tool registry: JSON schemas (for the Sonnet tool loop) + dispatch.

The orchestrator only ever sees the tools in :data:`ORCHESTRATOR_TOOLS`.
``queue_broadcast`` is deliberately NOT here — it is callable only from the
confirm lane. ``run_sql_readonly`` is included last as the guarded fallback.
"""

from __future__ import annotations

from typing import Callable

from . import actions, intelligence, reads, sql_fallback
from .context import ToolContext

_TIME_WINDOW = {
    "type": "string",
    "description": "today|this_week|last_week|this_month|last_month|last_30d|"
                   "this_year|last_year, or an explicit {from,to}.",
}


def _tool(name, description, properties, required=None):
    return {
        "name": name,
        "description": description,
        "input_schema": {
            "type": "object",
            "properties": properties,
            "required": required or [],
        },
    }


ORCHESTRATOR_TOOLS = [
    _tool(
        "count_leads",
        "Count leads, optionally filtered and grouped. Use for 'how many' questions.",
        {
            "destination": {"type": "string"},
            "nationality": {"type": "string"},
            "trip_type": {"type": "string"},
            "budget_usd_min": {"type": "number"},
            "budget_usd_max": {"type": "number"},
            "status": {"type": "string",
                       "enum": ["new", "quoted", "negotiating", "booked", "lost", "ghosted"]},
            "time_window": _TIME_WINDOW,
            "group_by": {"type": "string", "enum": ["destination", "trip_type", "nationality", "status"]},
        },
    ),
    _tool(
        "list_leads",
        "List leads (name, nationality, destination, budget_usd, status, last_contact). Cap 50.",
        {
            "destination": {"type": "string"},
            "nationality": {"type": "string"},
            "trip_type": {"type": "string"},
            "budget_usd_min": {"type": "number"},
            "budget_usd_max": {"type": "number"},
            "status": {"type": "string"},
            "time_window": _TIME_WINDOW,
            "limit": {"type": "integer", "maximum": 50},
        },
    ),
    _tool(
        "stale_quotes",
        "Leads quoted but silent (no deposit) for >= days_since_quote days.",
        {
            "days_since_quote": {"type": "integer", "default": 3},
            "destination": {"type": "string"},
        },
    ),
    _tool(
        "segment_no_booking",
        "Segment builder for actions: leads with no deposit. Returns lead_ids + summary.",
        {
            "destination": {"type": "string"},
            "trip_type": {"type": "string"},
            "time_window": _TIME_WINDOW,
            "min_budget_usd": {"type": "number"},
        },
    ),
    _tool(
        "trip_feedback_ranking",
        "Rank trips by average review rating (worst or best).",
        {
            "time_window": _TIME_WINDOW,
            "order": {"type": "string", "enum": ["worst", "best"], "default": "worst"},
            "limit": {"type": "integer", "default": 5},
        },
    ),
    _tool(
        "vendor_feedback_ranking",
        "Rank vendors (hotel|guide|driver|transport|porter) by avg feedback rating.",
        {
            "vendor_type": {"type": "string",
                            "enum": ["hotel", "guide", "driver", "transport", "porter"]},
            "region": {"type": "string"},
            "time_window": _TIME_WINDOW,
            "order": {"type": "string", "enum": ["worst", "best"], "default": "worst"},
            "limit": {"type": "integer", "default": 5},
        },
    ),
    _tool(
        "pipeline_summary",
        "Leads->quoted->deposited funnel with revenue and conversion, grouped.",
        {
            "time_window": _TIME_WINDOW,
            "group_by": {"type": "string", "enum": ["destination", "trip_type", "nationality"]},
        },
    ),
    _tool(
        "competitor_scan",
        "Scrape competitor packages for a destination (Apify). Flags undercuts.",
        {
            "destination": {"type": "string"},
            "handles": {"type": "array", "items": {"type": "string"}},
        },
        required=["destination"],
    ),
    _tool(
        "draft_broadcast",
        "Draft a WhatsApp broadcast to a segment. DOES NOT SEND — returns a draft "
        "+ one-time token the owner must confirm with SEND <token>.",
        {
            "lead_ids": {"type": "array", "items": {"type": "string"}},
            "angle": {"type": "string",
                      "enum": ["re-engage", "price nudge", "season urgency", "deposit push"]},
            "include_deposit_link": {"type": "boolean", "default": False},
        },
        required=["lead_ids", "angle"],
    ),
    _tool(
        "run_sql_readonly",
        "FALLBACK ONLY: run a single read-only SELECT when no parameterized tool "
        "fits. Validated and tenant-scoped in code.",
        {
            "sql": {"type": "string"},
            "purpose": {"type": "string"},
        },
        required=["sql"],
    ),
]

# name -> callable(ctx, **params). queue_broadcast is intentionally absent.
DISPATCH: dict[str, Callable] = {
    "count_leads": reads.count_leads,
    "list_leads": reads.list_leads,
    "stale_quotes": reads.stale_quotes,
    "segment_no_booking": reads.segment_no_booking,
    "trip_feedback_ranking": reads.trip_feedback_ranking,
    "vendor_feedback_ranking": reads.vendor_feedback_ranking,
    "pipeline_summary": reads.pipeline_summary,
    "competitor_scan": intelligence.competitor_scan,
    "draft_broadcast": actions.draft_broadcast,
    "run_sql_readonly": sql_fallback.run_sql_readonly,
}


def execute(ctx: ToolContext, name: str, params: dict) -> dict:
    if name not in DISPATCH:
        return {"error": f"unknown_or_forbidden_tool: {name}"}
    try:
        return DISPATCH[name](ctx, **(params or {}))
    except TypeError as exc:
        return {"error": f"bad_params: {exc}"}
    except Exception as exc:  # never let a tool crash the turn
        return {"error": f"tool_error: {exc}"}
