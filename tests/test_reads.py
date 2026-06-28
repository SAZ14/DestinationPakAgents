from app.tools.chief_of_staff import reads

TENANT = "destination-pakistan"


def test_count_leads_total(ctx):
    out = reads.count_leads(ctx)
    assert out["count"] == 18  # seeded Destination Pakistan leads


def test_count_leads_filtered(ctx):
    out = reads.count_leads(ctx, destination="Hunza")
    assert out["count"] == 5  # James, Sophie, David, Nina, Grace


def test_count_leads_group_by(ctx):
    out = reads.count_leads(ctx, group_by="status")
    assert out["group_by"] == "status"
    assert sum(out["groups"].values()) == 18
    assert "booked" in out["groups"]


def test_count_leads_budget_floor(ctx):
    out = reads.count_leads(ctx, budget_usd_min=3000)
    # Hiroshi (3500), Chen (3400), Ahmed (3000), K2 leads
    assert out["count"] >= 3


def test_tenant_isolation_no_cross_tenant_rows(ctx):
    """The northern-treks Martian/9999 lead must never appear."""
    listing = reads.list_leads(ctx, limit=50)
    names = {l["name"] for l in listing["leads"]}
    assert "Should Not Appear" not in names
    budgets = {l["budget_usd"] for l in listing["leads"]}
    assert 9999 not in budgets


def test_list_leads_cap(ctx):
    out = reads.list_leads(ctx, limit=100)
    assert out["returned"] <= 50


def test_stale_quotes(ctx):
    out = reads.stale_quotes(ctx, days_since_quote=3)
    # Quoted-but-unbooked leads older than 3 days exist in the seed.
    assert out["count"] >= 1
    for q in out["stale_quotes"]:
        assert q["days_silent"] >= 3


def test_segment_no_booking_excludes_booked(ctx):
    out = reads.segment_no_booking(ctx)
    booked = {b["lead_id"] for b in ctx.db.select("bookings", TENANT)}
    assert not (set(out["lead_ids"]) & booked)
    assert out["segment_size"] == len(out["lead_ids"])


def test_segment_no_booking_filtered(ctx):
    out = reads.segment_no_booking(ctx, destination="Hunza")
    assert out["segment_size"] >= 1
    for lid in out["lead_ids"]:
        lead = ctx.db.get("leads", TENANT, lid)
        assert lead["destination"] == "Hunza"


def test_pipeline_summary(ctx):
    out = reads.pipeline_summary(ctx, group_by="destination")
    t = out["totals"]
    assert t["leads"] == 18
    assert t["deposited"] == 3  # Emma, Maria, Ahmed
    assert t["revenue_usd"] == 7900  # 2600 + 2300 + 3000
    assert 0 <= t["conversion"] <= 1


def test_vendor_feedback_ranking_worst(ctx):
    out = reads.vendor_feedback_ranking(ctx, order="worst", limit=3)
    rk = out["ranking"]
    assert rk
    # worst-first → ascending avg_rating
    assert rk[0]["avg_rating"] <= rk[-1]["avg_rating"]


def test_vendor_feedback_ranking_by_type(ctx):
    out = reads.vendor_feedback_ranking(ctx, vendor_type="transport")
    for r in out["ranking"]:
        assert r["vendor_type"] == "transport"


def test_trip_feedback_ranking(ctx):
    out = reads.trip_feedback_ranking(ctx, order="best", limit=5)
    rk = out["ranking"]
    assert rk
    assert rk[0]["avg_rating"] >= rk[-1]["avg_rating"]
