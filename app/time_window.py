"""Normalize ``time_window`` tokens to a concrete ``{from, to}`` date range.

Supported tokens (resolved against the runtime date):
``today | this_week | last_week | this_month | last_month | last_30d |
this_year | last_year`` and an explicit ``{"from": "YYYY-MM-DD", "to": ...}``.

Weeks are Monday-based. Ranges are inclusive of ``from`` and exclusive of the
day after ``to`` when filtering timestamps (callers compare ``from <= ts < to+1d``
via :func:`contains`).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta


@dataclass(frozen=True)
class DateRange:
    start: date  # inclusive
    end: date  # inclusive

    def contains(self, value: str | date | datetime | None) -> bool:
        if value is None:
            return False
        d = _to_date(value)
        if d is None:
            return False
        return self.start <= d <= self.end

    def as_dict(self) -> dict[str, str]:
        return {"from": self.start.isoformat(), "to": self.end.isoformat()}


def _to_date(value: str | date | datetime) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            try:
                return date.fromisoformat(value[:10])
            except ValueError:
                return None
    return None


def _month_bounds(year: int, month: int) -> DateRange:
    start = date(year, month, 1)
    if month == 12:
        nxt = date(year + 1, 1, 1)
    else:
        nxt = date(year, month + 1, 1)
    return DateRange(start, nxt - timedelta(days=1))


def normalize(token, *, today: date | None = None) -> DateRange | None:
    """Return a :class:`DateRange` for ``token`` or ``None`` for "all time".

    ``token`` may be a string keyword or a ``{"from","to"}`` dict.
    """

    if token is None or token == "":
        return None
    today = today or date.today()

    if isinstance(token, dict):
        start = _to_date(token.get("from")) if token.get("from") else today
        end = _to_date(token.get("to")) if token.get("to") else today
        if start is None or end is None:
            return None
        if start > end:
            start, end = end, start
        return DateRange(start, end)

    key = str(token).strip().lower().replace("-", "_").replace(" ", "_")

    if key == "today":
        return DateRange(today, today)
    if key in ("this_week", "week"):
        monday = today - timedelta(days=today.weekday())
        return DateRange(monday, monday + timedelta(days=6))
    if key == "last_week":
        monday = today - timedelta(days=today.weekday() + 7)
        return DateRange(monday, monday + timedelta(days=6))
    if key in ("this_month", "month"):
        return _month_bounds(today.year, today.month)
    if key == "last_month":
        first = date(today.year, today.month, 1)
        prev_last = first - timedelta(days=1)
        return _month_bounds(prev_last.year, prev_last.month)
    if key in ("last_30d", "last_30_days", "30d"):
        return DateRange(today - timedelta(days=29), today)
    if key in ("last_7d", "last_7_days", "7d"):
        return DateRange(today - timedelta(days=6), today)
    if key in ("this_year", "year", "ytd"):
        return DateRange(date(today.year, 1, 1), today)
    if key == "last_year":
        return DateRange(date(today.year - 1, 1, 1), date(today.year - 1, 12, 31))

    # Unknown token → treat as all-time rather than failing the whole query.
    return None
