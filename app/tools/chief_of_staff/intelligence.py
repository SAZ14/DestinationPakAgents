"""Intelligence tool — competitor_scan via Apify."""

from __future__ import annotations

from .context import ToolContext


def competitor_scan(ctx: ToolContext, *, destination: str, handles: list[str] | None = None) -> dict:
    """Scrape competitor packages for a destination. If no handles are passed,
    use the tenant's tracked competitor handles."""
    if not handles:
        tracked = ctx.db.select("competitors", ctx.tenant_id)
        handles = [c["handle"] for c in tracked]

    results = ctx.apify.scrape_competitors(destination, handles)

    # Flag likely undercuts against our base price for the destination.
    trips = ctx.db.select(
        "trips", ctx.tenant_id,
        lambda t: str(t.get("destination", "")).lower() == str(destination).lower(),
    )
    our_price = min((t["base_price_usd"] for t in trips), default=None)
    for r in results:
        price = r.get("price")
        if our_price and price:
            r["undercuts_us"] = price < our_price
            r["delta_usd"] = price - our_price
    return {
        "destination": destination,
        "our_base_price_usd": our_price,
        "results": results,
    }
