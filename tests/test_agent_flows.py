"""End-to-end agent routing over the mock brain (classify → tool → reply)."""

TENANT = "destination-pakistan"
OWNER = "whatsapp:+923001112233"


def _ask(agent, msg, today):
    return agent.handle(message=msg, tenant_id=TENANT, sender=OWNER, today=today)


def test_query_count_total(agent, today):
    assert "18" in _ask(agent, "how many leads do we have?", today)


def test_query_group_by_status(agent, today):
    out = _ask(agent, "count leads by status", today)
    assert "by status" in out
    assert "quoted" in out


def test_pipeline_groups_by_destination_not_nationality(agent, today):
    """Regression: 'destination' contains the substring 'nation'."""
    out = _ask(agent, "pipeline this month by destination", today)
    assert "Hunza" in out
    assert "American" not in out


def test_intelligence_flags_undercut(agent, today):
    out = _ask(agent, "what are competitors charging for Hunza?", today)
    assert "Hunza" in out
    assert "undercut" in out.lower()


def test_stale_quotes_query(agent, today):
    out = _ask(agent, "which quotes have gone stale?", today)
    assert "silent" in out.lower()


def test_smalltalk(agent, today):
    out = _ask(agent, "hi", today)
    assert out  # short, non-empty, no tool data
    assert "lead" in out.lower() or "👋" in out


def test_action_lane_produces_token_and_does_not_send(agent, today):
    out = _ask(agent, "draft a follow up to Hunza leads who didn't book", today)
    assert "SEND" in out
    # The pending action exists but nothing has been released yet.
    assert agent.actions.latest_for(TENANT, OWNER) is not None
