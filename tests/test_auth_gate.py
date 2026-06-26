from app.auth import authorize
from app.config import DESTINATION_PAKISTAN

DP_NUMBER = DESTINATION_PAKISTAN.twilio_number
OWNER = next(iter(DESTINATION_PAKISTAN.whitelist))
STRANGER = "whatsapp:+19998887777"


def test_authorized_owner():
    res = authorize(twilio_to=DP_NUMBER, twilio_from=OWNER)
    assert res.authorized is True
    assert res.tenant.tenant_id == "destination-pakistan"


def test_non_whitelisted_sender_dropped():
    res = authorize(twilio_to=DP_NUMBER, twilio_from=STRANGER)
    assert res.authorized is False
    assert res.reason == "not_whitelisted"
    # We still resolved the tenant internally, but the route drops silently.
    assert res.tenant is not None


def test_unknown_tenant_number_dropped():
    res = authorize(twilio_to="whatsapp:+10000000001", twilio_from=OWNER)
    assert res.authorized is False
    assert res.reason == "unknown_tenant"
    assert res.tenant is None


def test_missing_from_dropped():
    res = authorize(twilio_to=DP_NUMBER, twilio_from=None)
    assert res.authorized is False


def test_bare_e164_in_config_matches_whatsapp_prefix():
    # Owner configured as +E164 should match an inbound whatsapp:+E164.
    bare = OWNER.replace("whatsapp:", "")
    res = authorize(twilio_to=DP_NUMBER, twilio_from=bare)
    assert res.authorized is True
