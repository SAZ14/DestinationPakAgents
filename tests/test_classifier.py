from app.adapters.anthropic_client import MockAnthropic
from app.config import SETTINGS

clf = MockAnthropic(SETTINGS)


def test_query_lane_count():
    c = clf.classify("how many leads do we have for Hunza?")
    assert c["lane"] == "query"
    assert c["entities"]["destination"] == "Hunza"


def test_action_lane_needs_confirmation():
    c = clf.classify("draft a follow-up to everyone who didn't book Skardu")
    assert c["lane"] == "action"
    assert c["needs_confirmation"] is True
    assert c["entities"]["destination"] == "Skardu"


def test_intelligence_lane():
    c = clf.classify("what are competitors charging for Hunza trips?")
    assert c["lane"] == "intelligence"


def test_confirm_lane():
    c = clf.classify("SEND 9F2A1C")
    assert c["lane"] == "confirm"


def test_smalltalk_lane():
    c = clf.classify("hi")
    assert c["lane"] == "smalltalk"


def test_status_entity():
    c = clf.classify("list ghosted leads")
    assert c["entities"].get("status") == "ghosted"


def test_vendor_type_entity():
    c = clf.classify("worst hotels by feedback")
    assert c["entities"].get("vendor_type") == "hotel"


def test_time_window_extracted():
    c = clf.classify("how many leads last month")
    assert c.get("time_window") == "last_month"


def test_budget_entity():
    c = clf.classify("leads with budget over $3000")
    assert c["entities"].get("budget_usd_min") == 3000


def test_fuzzy_destination():
    c = clf.classify("anything on K2 / Concordia?")
    assert c["entities"]["destination"] == "K2"
