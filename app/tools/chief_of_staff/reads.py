"""Read tools — auto-execute, read-only, tenant-scoped, LIMIT-capped.

Every function takes a :class:`ToolContext` first (carrying the server-resolved
tenant) followed by the model-supplied parameters. SQL/filter logic lives here;
the model only fills params.
"""

from __future__ import annotations

from typing import Any

from ...time_window import normalize
from .context import ToolContext

MAX_LIST = 50


def _match_text(value: Any, wanted: str | None) -> bool:
    if not wanted:
        return True
    return str(value or "").strip().lower() == str(wanted).strip().lower()


def _lead_predicate(
    *, destination=None, nationality=None, trip_type=None, status=None,
    budget_usd_min=None, budget_usd_max=None, time_range=None,
):
    def pred(row: dict) -> bool:
        if not _match_text(row.get("destination"), destination):
            return False
        if not _match_text(row.get("nationality"), nationality):
            return False
        if not _match_text(row.get("trip_type"), trip_type):
            return False
        if not _match_text(row.get("status"), status):
            return False
        b = row.get("budget_usd") or 0
        if budget_usd_min is not None and b < budget_usd_min:
            return False
        if budget_usd_max is not None and b > budget_usd_max:
            return False
        if time_range is not None and not time_range.contains(row.get("created_at")):
            return False
        return True

    return pred


def count_leads(
    ctx: ToolContext, *, destination=None, nationality=None, trip_type=None,
    budget_usd_min=None, budget_usd_max=None, status=None, time_window=None,
    group_by=None,
) -> dict:
    tr = normalize(time_window, today=ctx.today)
    pred = _lead_predicate(
        destination=destination, nationality=nationality, trip_type=trip_type,
        status=status, budget_usd_min=budget_usd_min, budget_usd_max=budget_usd_max,
        time_range=tr,
    )
    rows = ctx.db.select("leads", ctx.tenant_id, pred)
    result: dict[str, Any] = {"count": len(rows)}
    if group_by:
        groups: dict[str, int] = {}
        for r in rows:
            key = str(r.get(group_by, "unknown"))
            groups[key] = groups.get(key, 0) + 1
        result["group_by"] = group_by
        result["groups"] = dict(sorted(groups.items(), key=lambda kv: -kv[1]))
    return result


def list_leads(
    ctx: ToolContext, *, destination=None, nationality=None, trip_type=None,
    budget_usd_min=None, budget_usd_max=None, status=None, time_window=None,
    limit=MAX_LIST,
) -> dict:
    tr = normalize(time_window, today=ctx.today)
    pred = _lead_predicate(
        destination=destination, nationality=nationality, trip_type=trip_type,
        status=status, budget_usd_min=budget_usd_min, budget_usd_max=budget_usd_max,
        time_range=tr,
    )
    rows = ctx.db.select("leads", ctx.tenant_id, pred)
    limit = max(1, min(int(limit or MAX_LIST), MAX_LIST))

    convs = {c["lead_id"]: c for c in ctx.db.select("conversations", ctx.tenant_id)}
    out = []
    for r in sorted(rows, key=lambda x: x.get("created_at", ""), reverse=True)[:limit]:
        conv = convs.get(r["id"], {})
        out.append({
            "name": r["name"],
            "nationality": r["nationality"],
            "destination": r["destination"],
            "budget_usd": r["budget_usd"],
            "status": r["status"],
            "last_contact": conv.get("last_inbound_at") or r.get("created_at"),
        })
    return {"count": len(rows), "returned": len(out), "leads": out}


def stale_quotes(ctx: ToolContext, *, days_since_quote=3, destination=None) -> dict:
    """Leads quoted but silent (no acceptance, no booking) for >= N days."""
    days = int(days_since_quote or 3)
    cutoff = ctx.today.toordinal() - days

    quotes = ctx.db.select("quotes", ctx.tenant_id, lambda q: q.get("accepted_at") is None)
    booked_leads = {b["lead_id"] for b in ctx.db.select("bookings", ctx.tenant_id)}
    leads = {l["id"]: l for l in ctx.db.select("leads", ctx.tenant_id)}

    out = []
    for q in quotes:
        lead = leads.get(q["lead_id"])
        if not lead or lead["id"] in booked_leads:
            continue
        if destination and not _match_text(lead.get("destination"), destination):
            continue
        sent = q.get("sent_at")
        if not sent:
            continue
        try:
            from datetime import date as _date
            sent_ord = _date.fromisoformat(sent[:10]).toordinal()
        except ValueError:
            continue
        age = ctx.today.toordinal() - sent_ord
        if sent_ord <= cutoff:
            out.append({
                "name": lead["name"], "destination": lead["destination"],
                "budget_usd": lead["budget_usd"], "amount_usd": q["amount_usd"],
                "quoted_at": sent, "days_silent": age,
            })
    out.sort(key=lambda x: -x["days_silent"])
    return {"count": len(out), "days_since_quote": days, "stale_quotes": out}


def segment_no_booking(
    ctx: ToolContext, *, destination=None, trip_type=None, time_window=None,
    min_budget_usd=None,
) -> dict:
    """Segment builder for actions: leads that never deposited. Returns lead_ids
    plus a summary the action layer turns into a broadcast."""
    tr = normalize(time_window, today=ctx.today)
    booked_leads = {b["lead_id"] for b in ctx.db.select("bookings", ctx.tenant_id)}

    def pred(row: dict) -> bool:
        if row["id"] in booked_leads:
            return False
        if not _match_text(row.get("destination"), destination):
            return False
        if not _match_text(row.get("trip_type"), trip_type):
            return False
        if min_budget_usd is not None and (row.get("budget_usd") or 0) < min_budget_usd:
            return False
        if tr is not None and not tr.contains(row.get("created_at")):
            return False
        return True

    rows = ctx.db.select("leads", ctx.tenant_id, pred)
    lead_ids = [r["id"] for r in rows]
    by_dest: dict[str, int] = {}
    for r in rows:
        by_dest[r["destination"]] = by_dest.get(r["destination"], 0) + 1
    return {
        "segment_size": len(lead_ids),
        "lead_ids": lead_ids,
        "by_destination": dict(sorted(by_dest.items(), key=lambda kv: -kv[1])),
        "summary": f"{len(lead_ids)} leads with no deposit"
                   + (f" for {destination}" if destination else ""),
    }


def _feedback_ranking(rows, *, key_name, order, limit):
    order = (order or "worst").lower()
    reverse = order == "best"
    ranked = sorted(rows, key=lambda r: r["avg_rating"], reverse=reverse)
    return ranked[: max(1, int(limit or 5))]


def trip_feedback_ranking(ctx: ToolContext, *, time_window=None, order="worst", limit=5) -> dict:
    tr = normalize(time_window, today=ctx.today)
    reviews = ctx.db.select(
        "reviews", ctx.tenant_id,
        lambda r: tr is None or tr.contains(r.get("created_at")),
    )
    trips = {t["id"]: t for t in ctx.db.select("trips", ctx.tenant_id)}
    agg: dict[str, list[int]] = {}
    for rv in reviews:
        agg.setdefault(rv["trip_id"], []).append(rv["rating_1_5"])
    rows = [
        {
            "trip": trips.get(tid, {}).get("name", tid),
            "destination": trips.get(tid, {}).get("destination"),
            "avg_rating": round(sum(rs) / len(rs), 2),
            "n_reviews": len(rs),
        }
        for tid, rs in agg.items()
    ]
    return {"order": order, "ranking": _feedback_ranking(rows, key_name="trip", order=order, limit=limit)}


def vendor_feedback_ranking(
    ctx: ToolContext, *, vendor_type=None, region=None, time_window=None,
    order="worst", limit=5,
) -> dict:
    tr = normalize(time_window, today=ctx.today)
    vendors = {v["id"]: v for v in ctx.db.select("vendors", ctx.tenant_id)}

    def vmatch(v):
        return _match_text(v.get("vendor_type"), vendor_type) and _match_text(v.get("region"), region)

    allowed = {vid for vid, v in vendors.items() if vmatch(v)}
    fb = ctx.db.select(
        "vendor_feedback", ctx.tenant_id,
        lambda r: r["vendor_id"] in allowed and (tr is None or tr.contains(r.get("created_at"))),
    )
    agg: dict[str, list[int]] = {}
    for f in fb:
        agg.setdefault(f["vendor_id"], []).append(f["rating_1_5"])
    rows = [
        {
            "vendor": vendors[vid]["name"],
            "vendor_type": vendors[vid]["vendor_type"],
            "region": vendors[vid]["region"],
            "avg_rating": round(sum(rs) / len(rs), 2),
            "n_feedback": len(rs),
        }
        for vid, rs in agg.items()
    ]
    return {
        "order": order,
        "ranking": _feedback_ranking(rows, key_name="vendor", order=order, limit=limit),
    }


def pipeline_summary(ctx: ToolContext, *, time_window=None, group_by="destination") -> dict:
    tr = normalize(time_window, today=ctx.today)
    group_by = group_by if group_by in ("destination", "trip_type", "nationality") else "destination"

    leads = ctx.db.select(
        "leads", ctx.tenant_id, lambda r: tr is None or tr.contains(r.get("created_at"))
    )
    lead_ids = {l["id"] for l in leads}
    quotes = ctx.db.select("quotes", ctx.tenant_id, lambda q: q["lead_id"] in lead_ids)
    quoted_leads = {q["lead_id"] for q in quotes}
    bookings = ctx.db.select("bookings", ctx.tenant_id, lambda b: b["lead_id"] in lead_ids)
    deposited_leads = {b["lead_id"] for b in bookings}
    revenue = sum(b.get("total_usd", 0) for b in bookings)

    groups: dict[str, dict] = {}
    for l in leads:
        key = str(l.get(group_by, "unknown"))
        g = groups.setdefault(key, {"leads": 0, "quoted": 0, "deposited": 0, "revenue_usd": 0})
        g["leads"] += 1
        if l["id"] in quoted_leads:
            g["quoted"] += 1
        if l["id"] in deposited_leads:
            g["deposited"] += 1
    for b in bookings:
        lead = next((l for l in leads if l["id"] == b["lead_id"]), None)
        if lead:
            groups[str(lead.get(group_by, "unknown"))]["revenue_usd"] += b.get("total_usd", 0)

    total_leads = len(leads)
    total_deposited = len(deposited_leads)
    conversion = round(total_deposited / total_leads, 3) if total_leads else 0.0
    return {
        "group_by": group_by,
        "totals": {
            "leads": total_leads,
            "quoted": len(quoted_leads),
            "deposited": total_deposited,
            "revenue_usd": revenue,
            "conversion": conversion,
        },
        "groups": dict(sorted(groups.items(), key=lambda kv: -kv[1]["leads"])),
    }
