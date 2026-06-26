from datetime import date

from app.time_window import normalize


TODAY = date(2026, 6, 26)  # a Friday


def test_today():
    r = normalize("today", today=TODAY)
    assert r.start == r.end == TODAY


def test_this_week_is_monday_based():
    r = normalize("this_week", today=TODAY)
    assert r.start == date(2026, 6, 22)  # Monday
    assert r.end == date(2026, 6, 28)  # Sunday


def test_last_week():
    r = normalize("last_week", today=TODAY)
    assert r.start == date(2026, 6, 15)
    assert r.end == date(2026, 6, 21)


def test_this_month():
    r = normalize("this_month", today=TODAY)
    assert r.start == date(2026, 6, 1)
    assert r.end == date(2026, 6, 30)


def test_last_month():
    r = normalize("last_month", today=TODAY)
    assert r.start == date(2026, 5, 1)
    assert r.end == date(2026, 5, 31)


def test_last_30d():
    r = normalize("last_30d", today=TODAY)
    assert r.start == date(2026, 5, 28)
    assert r.end == TODAY


def test_this_year():
    r = normalize("this_year", today=TODAY)
    assert r.start == date(2026, 1, 1)
    assert r.end == TODAY


def test_explicit_range():
    r = normalize({"from": "2026-01-01", "to": "2026-03-31"}, today=TODAY)
    assert r.start == date(2026, 1, 1)
    assert r.end == date(2026, 3, 31)


def test_unknown_is_all_time():
    assert normalize("whenever", today=TODAY) is None
    assert normalize(None, today=TODAY) is None


def test_contains():
    r = normalize("this_month", today=TODAY)
    assert r.contains("2026-06-15")
    assert r.contains("2026-06-15T09:00:00Z")
    assert not r.contains("2026-05-31")
