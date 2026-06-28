"""Anthropic adapter: Haiku classify + Sonnet orchestrate/draft.

Two interchangeable implementations behind one interface:

* :class:`LiveAnthropic` — real Messages API. Haiku classifies; Sonnet runs the
  tool-use loop over the registry, drafts broadcasts, and handles smalltalk.
* :class:`MockAnthropic` — deterministic, offline. A rule-based classifier and a
  rule-based planner that drives the SAME tool registry, so the end-to-end path
  (classify → tool calls → reply) is exercised without any API key.

The tool registry and tool execution are shared by both — only the "brain"
(which tool to call, how to phrase the answer) differs.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date

from ..config import Settings
from ..prompts import (
    BROADCAST_DRAFTER_SYSTEM,
    CLASSIFIER_SYSTEM,
    ORCHESTRATOR_SYSTEM,
    SQL_FALLBACK_SYSTEM,
    SQL_SCHEMA_HINT,
)
from ..tools.chief_of_staff import registry
from ..tools.chief_of_staff.context import ToolContext

logger = logging.getLogger("chief_of_staff.anthropic")

CONFIRM_RE = re.compile(r"^\s*(send|yes|confirm|edit|cancel|no)\b", re.IGNORECASE)

_DESTINATIONS = {
    "hunza": "Hunza", "skardu": "Skardu", "fairy meadows": "Fairy Meadows",
    "fairy": "Fairy Meadows", "naran": "Naran", "kashmir": "Kashmir",
    "swat": "Swat", "kalam": "Swat", "chitral": "Chitral",
    "islamabad": "Islamabad", "lahore": "Lahore", "k2": "K2",
    "concordia": "K2", "south pakistan": "South Pakistan",
}
_NATIONALITIES = [
    "american", "british", "german", "french", "japanese", "australian",
    "italian", "polish", "spanish", "chinese", "irish", "norwegian",
    "canadian", "emirati", "dutch",
]
_STATUSES = ["new", "quoted", "negotiating", "booked", "lost", "ghosted"]
_VENDOR_TYPES = ["hotel", "guide", "driver", "transport", "porter"]


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------
class AnthropicAdapter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    # Implemented by subclasses.
    def classify(self, message: str) -> dict:  # pragma: no cover
        raise NotImplementedError

    def orchestrate(self, *, message: str, classification: dict, ctx: ToolContext) -> str:  # pragma: no cover
        raise NotImplementedError

    def draft_copy(self, *, destination, angle, season_context, include_deposit_link) -> str:  # pragma: no cover
        raise NotImplementedError

    def smalltalk(self, message: str) -> str:  # pragma: no cover
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Shared formatting helpers (used by the mock planner and as live fallbacks)
# ---------------------------------------------------------------------------
def _fmt_money(n) -> str:
    try:
        return f"${int(n):,}"
    except (TypeError, ValueError):
        return f"${n}"


def format_tool_result(tool: str, result: dict, classification: dict) -> str:
    ents = classification.get("entities", {}) or {}
    if "error" in result:
        return f"Couldn't pull that — {result['error']}."

    if tool == "count_leads":
        n = result["count"]
        filt = ents.get("destination") or ents.get("status") or ""
        head = f"**{n}** lead{'s' if n != 1 else ''}" + (f" — {filt}" if filt else "")
        if result.get("groups"):
            lines = [f"• {k}: {v}" for k, v in list(result["groups"].items())[:6]]
            return head + " by " + result["group_by"] + ":\n" + "\n".join(lines)
        return head + "."

    if tool == "list_leads":
        leads = result.get("leads", [])
        if not leads:
            return "No matching leads."
        head = f"**{result['count']}** match (showing {len(leads)}):"
        lines = [
            f"• {l['name']} ({l['nationality']}) — {l['destination']}, "
            f"{_fmt_money(l['budget_usd'])}, {l['status']}"
            for l in leads[:10]
        ]
        return head + "\n" + "\n".join(lines)

    if tool == "stale_quotes":
        sq = result.get("stale_quotes", [])
        if not sq:
            return f"No quotes silent ≥{result['days_since_quote']}d. Pipeline's warm."
        head = f"**{result['count']}** quote{'s' if result['count'] != 1 else ''} silent ≥{result['days_since_quote']}d:"
        lines = [
            f"• {q['name']} — {q['destination']}, {_fmt_money(q['amount_usd'])}, "
            f"{q['days_silent']}d silent"
            for q in sq[:8]
        ]
        return head + "\n" + "\n".join(lines) + "\nWant me to draft a follow-up?"

    if tool == "pipeline_summary":
        t = result["totals"]
        head = (f"Pipeline: **{t['leads']}** leads → {t['quoted']} quoted → "
                f"{t['deposited']} deposited ({_fmt_money(t['revenue_usd'])}, "
                f"{int(t['conversion'] * 100)}% conv).")
        groups = result.get("groups", {})
        lines = [
            f"• {k}: {v['leads']}→{v['deposited']} dep ({_fmt_money(v['revenue_usd'])})"
            for k, v in list(groups.items())[:5]
        ]
        return head + ("\n" + "\n".join(lines) if lines else "")

    if tool == "trip_feedback_ranking":
        rk = result.get("ranking", [])
        if not rk:
            return "No trip reviews in that window."
        head = f"{result['order'].title()} trips by rating:"
        lines = [f"• {r['trip']} — {r['avg_rating']}★ ({r['n_reviews']})" for r in rk]
        return head + "\n" + "\n".join(lines)

    if tool == "vendor_feedback_ranking":
        rk = result.get("ranking", [])
        if not rk:
            return "No vendor feedback in that window."
        head = f"{result['order'].title()} vendors by rating:"
        lines = [f"• {r['vendor']} ({r['vendor_type']}) — {r['avg_rating']}★ ({r['n_feedback']})" for r in rk]
        return head + "\n" + "\n".join(lines)

    if tool == "competitor_scan":
        res = result.get("results", [])
        if not res:
            return f"No competitor packages found for {result['destination']}."
        our = result.get("our_base_price_usd")
        head = f"{result['destination']} competitors" + (f" (us: {_fmt_money(our)}):" if our else ":")
        lines = []
        for r in res[:6]:
            flag = ""
            if r.get("undercuts_us"):
                flag = f" ⚠️ undercuts by {_fmt_money(abs(r['delta_usd']))}"
            price = _fmt_money(r["price"]) if r.get("price") else "n/a"
            lines.append(f"• {r['competitor']}: {r['package']} — {price}{flag}")
        return head + "\n" + "\n".join(lines)

    if tool == "run_sql_readonly":
        if not result.get("ok"):
            return f"SQL rejected — {result.get('reason')}."
        return f"{result['row_count']} row(s):\n" + json.dumps(result["rows"][:10], default=str)

    return json.dumps(result, default=str)


def _group_by_from_text(text: str, *, default, allowed):
    """Pick a group_by dimension from an explicit "by X" phrase. Matches whole
    phrases (not bare "nation", which is a substring of "destination")."""
    checks = [
        ("trip_type", ["by trip type", "by type", "per type", "by trip-type"]),
        ("nationality", ["by nationality", "per nationality"]),
        ("destination", ["by destination", "per destination", "by region"]),
        ("status", ["by status", "per status", "by stage"]),
    ]
    for canon, phrases in checks:
        if canon in allowed and any(ph in text for ph in phrases):
            return canon
    return default


def _draft_action_reply(draft_result: dict, segment: dict) -> str:
    n = draft_result["segment_size"]
    token = draft_result["token"]
    note = draft_result.get("note")
    body = (
        f"Segment: **{n}** leads.\n\n"
        f"Draft:\n{draft_result['draft']}\n\n"
        f"Reply SEND {token} to send to all {n}, EDIT {token} <changes> to revise, or ignore."
    )
    if note:
        body += f"\n\n({note})"
    return body


# ---------------------------------------------------------------------------
# Mock implementation
# ---------------------------------------------------------------------------
class MockAnthropic(AnthropicAdapter):
    """Deterministic, offline brain. Good enough to demo and to test the whole
    pipeline end to end; in production the live adapter takes over."""

    def classify(self, message: str) -> dict:
        text = message.lower()
        ents: dict = {}

        for kw, canon in _DESTINATIONS.items():
            if kw in text:
                ents["destination"] = canon
                break
        for nat in _NATIONALITIES:
            if nat in text:
                ents["nationality"] = nat.title()
                break
        for st in _STATUSES:
            if st in text:
                ents["status"] = st
                break
        for vt in _VENDOR_TYPES:
            if vt in text:
                ents["vendor_type"] = vt
                break
        m = re.search(r"\$?\s*(\d{3,5})\s*(?:\+|or more|and up|plus)?", text)
        if m and ("budget" in text or "over" in text or "above" in text or "$" in message):
            ents["budget_usd_min"] = int(m.group(1))

        time_window = self._time_window(text)
        lane = self._lane(text, ents)
        needs_conf = lane == "action"
        out = {"lane": lane, "needs_confirmation": needs_conf, "entities": ents,
               "raw_intent": message.strip()[:120]}
        if time_window:
            out["time_window"] = time_window
        return out

    @staticmethod
    def _time_window(text: str) -> str | None:
        for tw in ["today", "this week", "last week", "this month", "last month",
                   "last 30 days", "this year", "last year"]:
            if tw in text:
                return tw.replace(" ", "_")
        return None

    @staticmethod
    def _lane(text: str, ents: dict) -> str:
        if CONFIRM_RE.match(text):
            return "confirm"
        if any(w in text for w in ["competitor", "competition", "rival", "market", "undercut", "vs ", "versus"]):
            return "intelligence"
        if any(w in text for w in ["draft", "broadcast", "follow up", "follow-up", "message them",
                                   "send", "reach out", "re-engage", "reengage", "nudge", "blast", "campaign"]):
            # "send"/"draft" here means *compose* outbound → action lane.
            return "action"
        if any(w in text for w in ["hi", "hello", "hey", "thanks", "thank you", "good morning"]) \
                and len(text.split()) <= 3:
            return "smalltalk"
        return "query"

    def orchestrate(self, *, message: str, classification: dict, ctx: ToolContext) -> str:
        lane = classification["lane"]
        ents = classification.get("entities", {}) or {}
        tw = classification.get("time_window")
        text = message.lower()

        if lane == "intelligence":
            dest = ents.get("destination") or "Hunza"
            result = registry.execute(ctx, "competitor_scan", {"destination": dest})
            return format_tool_result("competitor_scan", result, classification)

        if lane == "action":
            seg_params = {k: v for k, v in {
                "destination": ents.get("destination"),
                "trip_type": ents.get("trip_type"),
                "time_window": tw,
                "min_budget_usd": ents.get("budget_usd_min"),
            }.items() if v is not None}
            segment = registry.execute(ctx, "segment_no_booking", seg_params)
            if segment.get("segment_size", 0) == 0:
                return "That segment is empty — no leads without a deposit match those filters."
            angle = self._angle(text)
            include_deposit = "deposit" in text
            draft = registry.execute(ctx, "draft_broadcast", {
                "lead_ids": segment["lead_ids"],
                "angle": angle,
                "include_deposit_link": include_deposit,
            })
            return _draft_action_reply(draft, segment)

        # query lane → choose a read tool
        tool, params = self._plan_query(text, ents, tw)
        result = registry.execute(ctx, tool, params)
        return format_tool_result(tool, result, classification)

    @staticmethod
    def _angle(text: str) -> str:
        if "price" in text or "discount" in text:
            return "price nudge"
        if "deposit" in text:
            return "deposit push"
        if "season" in text or "urgen" in text or "closing" in text:
            return "season urgency"
        return "re-engage"

    @staticmethod
    def _plan_query(text: str, ents: dict, tw):
        common = {}
        if ents.get("destination"):
            common["destination"] = ents["destination"]
        if tw:
            common["time_window"] = tw

        if any(w in text for w in ["pipeline", "funnel", "conversion", "convert", "revenue"]):
            gb = _group_by_from_text(text, default="destination",
                                     allowed=("destination", "trip_type", "nationality"))
            return "pipeline_summary", {**({"time_window": tw} if tw else {}), "group_by": gb}

        if "stale" in text or ("quote" in text and any(w in text for w in ["silent", "old", "follow", "stuck", "cold"])):
            p = {"destination": ents["destination"]} if ents.get("destination") else {}
            return "stale_quotes", p

        if ents.get("vendor_type") or any(w in text for w in ["vendor", "hotel", "guide", "driver", "porter", "transport"]):
            p = {}
            if ents.get("vendor_type"):
                p["vendor_type"] = ents["vendor_type"]
            p["order"] = "best" if "best" in text else "worst"
            if tw:
                p["time_window"] = tw
            return "vendor_feedback_ranking", p

        if any(w in text for w in ["trip review", "trip feedback", "worst trip", "best trip", "rating", "reviews"]):
            return "trip_feedback_ranking", {"order": "best" if "best" in text else "worst",
                                             **({"time_window": tw} if tw else {})}

        if any(w in text for w in ["list", "show", "who are", "which leads", "names"]):
            p = dict(common)
            if ents.get("status"):
                p["status"] = ents["status"]
            if ents.get("nationality"):
                p["nationality"] = ents["nationality"]
            if ents.get("budget_usd_min"):
                p["budget_usd_min"] = ents["budget_usd_min"]
            return "list_leads", p

        # default: count
        p = dict(common)
        if ents.get("status"):
            p["status"] = ents["status"]
        if ents.get("nationality"):
            p["nationality"] = ents["nationality"]
        if ents.get("budget_usd_min"):
            p["budget_usd_min"] = ents["budget_usd_min"]
        gb = _group_by_from_text(text, default=None,
                                 allowed=("destination", "nationality", "trip_type", "status"))
        if gb:
            p["group_by"] = gb
        return "count_leads", p

    def draft_copy(self, *, destination, angle, season_context, include_deposit_link) -> str:
        if include_deposit_link:
            return (
                f"Hi {{{{first_name}}}}! Your {{{{destination}}}} trip is ready to lock in — "
                f"{season_context}. Secure your spot with a small deposit here: "
                f"{{{{asaanpay_deposit_link}}}} 🏔️\n— Team Destination Pakistan"
            )
        templates = {
            "price nudge": (
                "Hi {{first_name}}! Still thinking about {{destination}}? We can tailor the "
                "itinerary to your budget — reply and let's find the right fit.\n"
                "— Team Destination Pakistan"
            ),
            "season urgency": (
                "Hi {{first_name}}! A quick note on {{destination}}: " + season_context +
                ". Spots fill fast — reply to keep planning your trip. 🏔️\n"
                "— Team Destination Pakistan"
            ),
            "deposit push": (
                "Hi {{first_name}}! Ready to make {{destination}} happen? Reply and we'll "
                "walk you through the next step to confirm your dates.\n"
                "— Team Destination Pakistan"
            ),
        }
        return templates.get(angle, (
            "Hi {{first_name}}! Still dreaming of {{destination}}? We'd love to help you plan "
            "it — reply anytime to pick up where we left off.\n— Team Destination Pakistan"
        ))

    def smalltalk(self, message: str) -> str:
        return "👋 Here when you need a read on the business — leads, quotes, vendors, competitors."


# ---------------------------------------------------------------------------
# Live implementation
# ---------------------------------------------------------------------------
class LiveAnthropic(AnthropicAdapter):
    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)
        import anthropic  # imported lazily; only on the live path

        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self._fallback = MockAnthropic(settings)

    def _text(self, resp) -> str:
        return "".join(b.text for b in resp.content if getattr(b, "type", None) == "text").strip()

    def classify(self, message: str) -> dict:
        try:
            resp = self._client.messages.create(
                model=self.settings.classifier_model,
                max_tokens=400,
                system=CLASSIFIER_SYSTEM,
                messages=[{"role": "user", "content": message}],
            )
            raw = self._text(resp)
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            return json.loads(match.group(0) if match else raw)
        except Exception as exc:  # pragma: no cover - network/parse
            logger.warning("classify fell back to mock: %s", exc)
            return self._fallback.classify(message)

    def orchestrate(self, *, message: str, classification: dict, ctx: ToolContext) -> str:
        system = (
            ORCHESTRATOR_SYSTEM
            + f"\n\nRuntime date: {ctx.today.isoformat()}."
            + "\nThis is WhatsApp — plain text only. Do NOT use markdown tables or | pipes; "
            "use short lines, one item per line starting with '• '. Bold the single key figure "
            "with **double asterisks**. Keep it tight."
        )
        messages = [{"role": "user", "content": message}]
        try:
            for _ in range(6):  # bounded tool loop
                resp = self._client.messages.create(
                    model=self.settings.orchestrator_model,
                    max_tokens=1024,
                    system=system,
                    tools=registry.ORCHESTRATOR_TOOLS,
                    messages=messages,
                )
                if resp.stop_reason != "tool_use":
                    return self._text(resp) or "(no answer)"
                messages.append({"role": "assistant", "content": resp.content})
                tool_results = []
                for block in resp.content:
                    if getattr(block, "type", None) != "tool_use":
                        continue
                    out = registry.execute(ctx, block.name, dict(block.input or {}))
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(out, default=str),
                    })
                messages.append({"role": "user", "content": tool_results})
            return "Hit the tool-loop limit — try narrowing the question."
        except Exception as exc:  # pragma: no cover - network
            logger.warning("orchestrate fell back to mock: %s", exc)
            return self._fallback.orchestrate(message=message, classification=classification, ctx=ctx)

    def draft_copy(self, *, destination, angle, season_context, include_deposit_link) -> str:
        deposit = "{{asaanpay_deposit_link}}" if include_deposit_link else "none"
        user = (
            f"destination: {destination}\nangle: {angle}\n"
            f"season_context: {season_context}\ndeposit_link: {deposit}"
        )
        try:
            resp = self._client.messages.create(
                model=self.settings.orchestrator_model,
                max_tokens=200,
                system=BROADCAST_DRAFTER_SYSTEM,
                messages=[{"role": "user", "content": user}],
            )
            return self._text(resp)
        except Exception as exc:  # pragma: no cover - network
            logger.warning("draft fell back to mock: %s", exc)
            return self._fallback.draft_copy(
                destination=destination, angle=angle,
                season_context=season_context, include_deposit_link=include_deposit_link,
            )

    def generate_sql(self, question: str) -> str:  # pragma: no cover - helper
        resp = self._client.messages.create(
            model=self.settings.orchestrator_model,
            max_tokens=300,
            system=SQL_FALLBACK_SYSTEM,
            messages=[{"role": "user", "content": f"Schema:\n{SQL_SCHEMA_HINT}\n\nQuestion: {question}"}],
        )
        return self._text(resp)

    def smalltalk(self, message: str) -> str:
        try:
            resp = self._client.messages.create(
                model=self.settings.orchestrator_model,
                max_tokens=120,
                system=ORCHESTRATOR_SYSTEM,
                messages=[{"role": "user", "content": message}],
            )
            return self._text(resp)
        except Exception:  # pragma: no cover - network
            return self._fallback.smalltalk(message)


def make_anthropic(settings: Settings) -> AnthropicAdapter:
    if settings.anthropic_live:
        try:
            return LiveAnthropic(settings)
        except Exception as exc:  # pragma: no cover
            logger.warning("Live Anthropic init failed (%s); using mock.", exc)
    return MockAnthropic(settings)
