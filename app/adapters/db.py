"""Tenant-scoped data access.

This adapter presents the same surface a Supabase-backed implementation would:
parameterized, read-only, tenant-filtered ``select`` plus a per-tenant SQLite
view for the guarded ``run_sql_readonly`` fallback. Offline it is backed by an
in-memory seed so the whole agent is exercisable without any infrastructure.

Statuses/"current" fields are stored on the rows here for clarity, but the read
tools derive open-pipeline vs booked from the presence of quotes/bookings so
the behaviour matches the append-only ledger pattern (a lead is only *booked*
once a deposit exists).
"""

from __future__ import annotations

import sqlite3
from copy import deepcopy
from datetime import date, timedelta
from typing import Any, Callable, Iterable

# Anchor seed data to a fixed "today" so time-window filtering is deterministic
# in tests. Production data carries real timestamps.
BASE_TODAY = date(2026, 6, 26)


def _d(days_ago: int) -> str:
    return (BASE_TODAY - timedelta(days=days_ago)).isoformat()


def _future(days_ahead: int) -> str:
    return (BASE_TODAY + timedelta(days=days_ahead)).isoformat()


Row = dict[str, Any]


class Database:
    """In-memory, multi-tenant store. Swap for a Supabase client in prod by
    re-implementing :meth:`select` and :meth:`sqlite_for_tenant`."""

    TABLES = (
        "leads",
        "conversations",
        "quotes",
        "bookings",
        "trips",
        "vendors",
        "vendor_feedback",
        "reviews",
        "competitors",
    )

    def __init__(self, tables: dict[str, list[Row]] | None = None) -> None:
        self.tables: dict[str, list[Row]] = {t: [] for t in self.TABLES}
        if tables:
            for name, rows in tables.items():
                self.tables[name] = list(rows)

    # -- reads --------------------------------------------------------------
    def select(
        self,
        table: str,
        tenant_id: str,
        predicate: Callable[[Row], bool] | None = None,
    ) -> list[Row]:
        """Tenant-scoped read. ``tenant_id`` is injected by the tool layer; the
        model never supplies it. Returns deep copies so callers can't mutate
        the store."""
        if table not in self.tables:
            raise KeyError(f"unknown table {table!r}")
        out = []
        for row in self.tables[table]:
            if row.get("tenant_id") != tenant_id:
                continue
            if predicate and not predicate(row):
                continue
            out.append(deepcopy(row))
        return out

    def get(self, table: str, tenant_id: str, row_id: str) -> Row | None:
        rows = self.select(table, tenant_id, lambda r: r.get("id") == row_id)
        return rows[0] if rows else None

    # -- SQL fallback view --------------------------------------------------
    def sqlite_for_tenant(self, tenant_id: str) -> sqlite3.Connection:
        """Build an ephemeral in-memory SQLite DB containing ONLY this tenant's
        rows (tenant_id column dropped). The SQL-fallback model writes queries
        "as if all visible rows are one tenant's"; this is what makes that true
        and keeps cross-tenant data unreachable."""
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        for table in self.TABLES:
            rows = self.select(table, tenant_id)
            cols = _columns_for(table, rows)
            col_defs = ", ".join(f'"{c}"' for c in cols)
            conn.execute(f'CREATE TABLE "{table}" ({col_defs})')
            if rows:
                placeholders = ", ".join("?" for _ in cols)
                conn.executemany(
                    f'INSERT INTO "{table}" ({col_defs}) VALUES ({placeholders})',
                    [[r.get(c) for c in cols] for r in rows],
                )
        conn.commit()
        return conn


_SCHEMA_COLUMNS = {
    "leads": ["id", "name", "nationality", "source", "destination", "trip_type",
              "budget_usd", "party_size", "status", "created_at"],
    "conversations": ["id", "lead_id", "channel", "last_inbound_at",
                      "last_outbound_at", "last_quote_at", "state"],
    "quotes": ["id", "lead_id", "trip_id", "amount_usd", "sent_at", "accepted_at"],
    "bookings": ["id", "lead_id", "trip_id", "deposit_paid", "total_usd",
                 "start_date", "status", "created_at"],
    "trips": ["id", "name", "destination", "trip_type", "base_price_usd", "duration_days"],
    "vendors": ["id", "name", "vendor_type", "region"],
    "vendor_feedback": ["id", "vendor_id", "booking_id", "rating_1_5", "sentiment",
                        "note", "created_at"],
    "reviews": ["id", "trip_id", "booking_id", "rating_1_5", "sentiment", "text",
                "source", "created_at"],
    "competitors": ["id", "name", "handle", "platform"],
}


def _columns_for(table: str, rows: Iterable[Row]) -> list[str]:
    return _SCHEMA_COLUMNS[table]


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

def _dp_rows() -> dict[str, list[Row]]:
    T = "destination-pakistan"

    trips = [
        dict(id="trip-hunza", name="Hunza Valley Explorer", destination="Hunza",
             trip_type="cultural", base_price_usd=1800, duration_days=8),
        dict(id="trip-skardu", name="Skardu & Deosai", destination="Skardu",
             trip_type="adventure", base_price_usd=2400, duration_days=10),
        dict(id="trip-fairy", name="Fairy Meadows & Nanga Parbat BC",
             destination="Fairy Meadows", trip_type="trekking",
             base_price_usd=2100, duration_days=9),
        dict(id="trip-k2", name="K2 Base Camp / Concordia", destination="K2",
             trip_type="trekking", base_price_usd=3500, duration_days=18),
        dict(id="trip-swat", name="Swat & Kalam Getaway", destination="Swat",
             trip_type="cultural", base_price_usd=1500, duration_days=6),
        dict(id="trip-chitral", name="Chitral & Kalash Valleys",
             destination="Chitral", trip_type="cultural",
             base_price_usd=2200, duration_days=9),
    ]

    vendors = [
        dict(id="v-eagle", name="Eagle's Nest Hotel", vendor_type="hotel", region="Hunza"),
        dict(id="v-serena", name="Serena Shigar Fort", vendor_type="hotel", region="Skardu"),
        dict(id="v-karim", name="Karim Ullah (Guide)", vendor_type="guide", region="Hunza"),
        dict(id="v-littlekarim", name="Little Karim Porters", vendor_type="porter", region="Skardu"),
        dict(id="v-raja", name="Raja Transport Co.", vendor_type="transport", region="Gilgit-Baltistan"),
        dict(id="v-ali", name="Ali Hassan (Driver)", vendor_type="driver", region="Lahore"),
        dict(id="v-concordia", name="Concordia Porter Team", vendor_type="porter", region="Skardu"),
        dict(id="v-ptdc", name="PTDC Motel Kalam", vendor_type="hotel", region="Swat"),
    ]

    # (name, nationality, source, destination, trip_type, budget, party, status, created_days_ago)
    lead_specs = [
        ("James Carter", "American", "instagram", "Hunza", "cultural", 2000, 2, "quoted", 5),
        ("Emma Thompson", "British", "referral", "Skardu", "adventure", 2600, 2, "booked", 40),
        ("Lukas Müller", "German", "website", "Fairy Meadows", "trekking", 2200, 1, "negotiating", 8),
        ("Sophie Dubois", "French", "instagram", "Hunza", "cultural", 1900, 2, "quoted", 12),
        ("Hiroshi Tanaka", "Japanese", "website", "K2", "trekking", 3500, 1, "new", 2),
        ("Olivia Brown", "Australian", "facebook", "Swat", "cultural", 1600, 4, "ghosted", 22),
        ("Marco Rossi", "Italian", "instagram", "Skardu", "adventure", 2500, 2, "quoted", 6),
        ("Anna Kowalski", "Polish", "referral", "Chitral", "cultural", 2100, 2, "lost", 35),
        ("David Smith", "American", "website", "Hunza", "cultural", 2000, 3, "quoted", 4),
        ("Maria Garcia", "Spanish", "instagram", "Fairy Meadows", "trekking", 2300, 2, "booked", 30),
        ("Chen Wei", "Chinese", "website", "K2", "trekking", 3400, 2, "new", 1),
        ("Liam O'Brien", "Irish", "facebook", "Skardu", "adventure", 2400, 2, "negotiating", 9),
        ("Nina Hansen", "Norwegian", "instagram", "Hunza", "cultural", 1850, 1, "ghosted", 18),
        ("Tom Wilson", "American", "referral", "Swat", "cultural", 1550, 2, "quoted", 7),
        ("Clara Weber", "German", "website", "Chitral", "cultural", 2200, 2, "new", 3),
        ("Ahmed Al-Rashid", "Emirati", "referral", "Skardu", "adventure", 3000, 4, "booked", 25),
        ("Grace Lee", "Canadian", "instagram", "Hunza", "cultural", 1950, 2, "quoted", 14),
        ("Pieter Bakker", "Dutch", "website", "Fairy Meadows", "trekking", 2150, 2, "lost", 45),
    ]

    leads: list[Row] = []
    conversations: list[Row] = []
    quotes: list[Row] = []
    bookings: list[Row] = []

    trip_by_dest = {t["destination"]: t for t in trips}

    for i, (name, nat, src, dest, ttype, budget, party, status, ago) in enumerate(lead_specs, 1):
        lid = f"L{i:03d}"
        leads.append(dict(
            id=lid, name=name, nationality=nat, source=src, destination=dest,
            trip_type=ttype, budget_usd=budget, party_size=party, status=status,
            created_at=_d(ago),
        ))
        trip = trip_by_dest.get(dest, trips[0])

        last_inbound = _d(max(ago - 1, 0))
        last_outbound = None
        last_quote = None

        if status in ("quoted", "negotiating", "booked", "lost"):
            # Quote sent a few days after the lead came in.
            sent_ago = max(ago - 2, 1)
            last_quote = _d(sent_ago)
            accepted = _d(max(ago - 10, 1)) if status == "booked" else None
            quotes.append(dict(
                id=f"Q{i:03d}", lead_id=lid, trip_id=trip["id"],
                amount_usd=budget, sent_at=last_quote, accepted_at=accepted,
            ))
            last_outbound = last_quote

        if status == "booked":
            bookings.append(dict(
                id=f"B{i:03d}", lead_id=lid, trip_id=trip["id"], deposit_paid=True,
                total_usd=budget, start_date=_future(20 + i), status="confirmed",
                created_at=_d(max(ago - 12, 1)),
            ))

        # Ghosted/negotiating leads: last inbound is older to surface staleness.
        state = status
        if status == "ghosted":
            last_inbound = _d(ago)
        conversations.append(dict(
            id=f"C{i:03d}", lead_id=lid, channel="whatsapp",
            last_inbound_at=last_inbound, last_outbound_at=last_outbound,
            last_quote_at=last_quote, state=state,
        ))

    bookings_by_lead = {b["lead_id"]: b for b in bookings}
    vendor_feedback = [
        dict(id="VF1", vendor_id="v-eagle", booking_id="B002", rating_1_5=5,
             sentiment="positive", note="Guests loved the valley views.", created_at=_d(20)),
        dict(id="VF2", vendor_id="v-raja", booking_id="B002", rating_1_5=2,
             sentiment="negative", note="Van broke down near Chilas, 3hr delay.", created_at=_d(19)),
        dict(id="VF3", vendor_id="v-serena", booking_id="B016", rating_1_5=5,
             sentiment="positive", note="Flawless service at Shigar Fort.", created_at=_d(10)),
        dict(id="VF4", vendor_id="v-littlekarim", booking_id="B010", rating_1_5=4,
             sentiment="positive", note="Strong porters, good pace.", created_at=_d(15)),
        dict(id="VF5", vendor_id="v-ali", booking_id="B010", rating_1_5=1,
             sentiment="negative", note="Driver late for airport pickup twice.", created_at=_d(14)),
        dict(id="VF6", vendor_id="v-concordia", booking_id="B016", rating_1_5=2,
             sentiment="negative", note="Porter strike threat at Concordia.", created_at=_d(9)),
        dict(id="VF7", vendor_id="v-ptdc", booking_id="B002", rating_1_5=3,
             sentiment="neutral", note="Rooms dated but clean.", created_at=_d(40)),
    ]

    reviews = [
        dict(id="R1", trip_id="trip-skardu", booking_id="B002", rating_1_5=5,
             sentiment="positive", text="Trip of a lifetime, Deosai was unreal.",
             source="tripadvisor", created_at=_d(18)),
        dict(id="R2", trip_id="trip-fairy", booking_id="B010", rating_1_5=4,
             sentiment="positive", text="Nanga Parbat views worth the hike.",
             source="google", created_at=_d(12)),
        dict(id="R3", trip_id="trip-skardu", booking_id="B016", rating_1_5=2,
             sentiment="negative", text="Logistics were rough, transport let us down.",
             source="tripadvisor", created_at=_d(8)),
        dict(id="R4", trip_id="trip-swat", booking_id="B002", rating_1_5=3,
             sentiment="neutral", text="Pretty but hotels need an upgrade.",
             source="google", created_at=_d(38)),
    ]

    competitors = [
        dict(id="cmp1", name="Hunza Explorers", handle="@hunzaexplorers", platform="instagram"),
        dict(id="cmp2", name="Karakoram Tours", handle="@karakoramtours", platform="instagram"),
        dict(id="cmp3", name="Apricot Tours", handle="@apricottours_pk", platform="instagram"),
    ]

    def _tag(rows: list[Row]) -> list[Row]:
        for r in rows:
            r["tenant_id"] = T
        return rows

    _ = bookings_by_lead  # documented derivation aid
    return {
        "leads": _tag(leads),
        "conversations": _tag(conversations),
        "quotes": _tag(quotes),
        "bookings": _tag(bookings),
        "trips": _tag(trips),
        "vendors": _tag(vendors),
        "vendor_feedback": _tag(vendor_feedback),
        "reviews": _tag(reviews),
        "competitors": _tag(competitors),
    }


def _other_tenant_rows() -> dict[str, list[Row]]:
    """A tiny second tenant. Its only job is to be present so isolation tests
    can prove the agent never sees these rows."""
    T = "northern-treks"
    leads = [dict(id="NT1", tenant_id=T, name="Should Not Appear", nationality="Martian",
                  source="website", destination="Hunza", trip_type="cultural",
                  budget_usd=9999, party_size=1, status="quoted", created_at=_d(3))]
    trips = [dict(id="nt-trip", tenant_id=T, name="Other Co Trip", destination="Hunza",
                  trip_type="cultural", base_price_usd=1000, duration_days=5)]
    competitors = [dict(id="nt-cmp", tenant_id=T, name="Other Competitor",
                        handle="@other", platform="instagram")]
    return {"leads": leads, "trips": trips, "competitors": competitors}


def seeded_database() -> Database:
    db = Database()
    for name, rows in _dp_rows().items():
        db.tables[name].extend(rows)
    for name, rows in _other_tenant_rows().items():
        db.tables[name].extend(rows)
    return db
