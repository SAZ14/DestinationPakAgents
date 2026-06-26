"""Runtime configuration for the Chief of Staff Agent.

Everything here is read from environment variables with sensible offline
defaults so the service boots (in mock mode) with zero configuration. In
production every secret/number is supplied via Railway env vars.

Tenant scoping is *server-side only*: the model never sees or sets a
``tenant_id``. The mapping from an inbound Twilio number to a ``tenant_id`` and
the owner/staff whitelist both live here, never in a prompt.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _split(value: str | None) -> list[str]:
    if not value:
        return []
    return [v.strip() for v in value.split(",") if v.strip()]


def _normalize_wa(number: str) -> str:
    """Twilio sends WhatsApp numbers as ``whatsapp:+E164``. Normalize so that a
    bare ``+E164`` in config still matches an inbound ``whatsapp:+E164``."""
    number = number.strip()
    if not number:
        return number
    if number.startswith("whatsapp:"):
        return number
    return f"whatsapp:{number}"


@dataclass(frozen=True)
class Tenant:
    """A single Destination-Pakistan-style tenant.

    ``twilio_number`` is the WhatsApp line the owner texts; it is how we resolve
    ``tenant_id`` on every inbound webhook. ``whitelist`` is the fail-closed set
    of owner/staff numbers allowed to talk to the agent.
    """

    tenant_id: str
    name: str
    twilio_number: str
    whitelist: frozenset[str]

    def is_authorized(self, sender: str) -> bool:
        return _normalize_wa(sender) in self.whitelist


# --- Default tenant (Destination Pakistan) ---------------------------------
# Twilio's WhatsApp sandbox number is +14155238886; override with env in prod.
_DP_NUMBER = _normalize_wa(os.getenv("DP_TWILIO_NUMBER", "+14155238886"))
_DP_OWNERS = _split(os.getenv("DP_OWNER_NUMBERS", "+923001112233,+923004445566"))

DESTINATION_PAKISTAN = Tenant(
    tenant_id="destination-pakistan",
    name="Destination Pakistan",
    twilio_number=_DP_NUMBER,
    whitelist=frozenset(_normalize_wa(n) for n in _DP_OWNERS),
)

# A second seeded tenant exists only to prove tenant isolation in tests. It is
# never reachable unless its Twilio number is configured.
_OTHER_NUMBER = _normalize_wa(os.getenv("OTHER_TWILIO_NUMBER", "+14155230000"))
_OTHER_OWNERS = _split(os.getenv("OTHER_OWNER_NUMBERS", "+10000000000"))

NORTHERN_TREKS = Tenant(
    tenant_id="northern-treks",
    name="Northern Treks",
    twilio_number=_OTHER_NUMBER,
    whitelist=frozenset(_normalize_wa(n) for n in _OTHER_OWNERS),
)


@dataclass(frozen=True)
class Settings:
    # Model routing: Haiku classifies intent, Sonnet orchestrates + drafts.
    classifier_model: str = os.getenv("COS_CLASSIFIER_MODEL", "claude-haiku-4-5")
    orchestrator_model: str = os.getenv("COS_ORCHESTRATOR_MODEL", "claude-sonnet-4-6")
    anthropic_api_key: str | None = os.getenv("ANTHROPIC_API_KEY")

    twilio_account_sid: str | None = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_auth_token: str | None = os.getenv("TWILIO_AUTH_TOKEN")

    apify_token: str | None = os.getenv("APIFY_TOKEN")
    apify_instagram_actor: str = os.getenv("APIFY_IG_ACTOR", "apify/instagram-scraper")

    # Pending-action token time-to-live, in minutes.
    pending_ttl_minutes: int = int(os.getenv("COS_PENDING_TTL_MINUTES", "30"))

    # Asaanpay deposit-link generation is not wired yet (open dependency). While
    # this is False, draft_broadcast forces include_deposit_link off and the
    # orchestrator tells the owner the follow-up has no pay link yet.
    asaanpay_enabled: bool = os.getenv("COS_ASAANPAY_ENABLED", "false").lower() == "true"

    @property
    def anthropic_live(self) -> bool:
        """Live mode requires a key AND the SDK installed. Otherwise we run the
        deterministic mock so the service is fully exercisable offline."""
        if not self.anthropic_api_key:
            return False
        try:  # pragma: no cover - import guard
            import anthropic  # noqa: F401
        except Exception:  # pragma: no cover
            return False
        return True

    @property
    def twilio_live(self) -> bool:
        return bool(self.twilio_account_sid and self.twilio_auth_token)

    @property
    def apify_live(self) -> bool:
        return bool(self.apify_token)


SETTINGS = Settings()

TENANTS: dict[str, Tenant] = {
    DESTINATION_PAKISTAN.tenant_id: DESTINATION_PAKISTAN,
    NORTHERN_TREKS.tenant_id: NORTHERN_TREKS,
}

# Index for O(1) inbound-number -> tenant resolution.
_BY_NUMBER: dict[str, Tenant] = {t.twilio_number: t for t in TENANTS.values()}


def tenant_for_number(twilio_to: str | None) -> Tenant | None:
    """Resolve the tenant from the Twilio number the message arrived on.

    This is the only place ``tenant_id`` originates. Returns None for an
    unknown number (the route then fail-closes with an empty 200)."""
    if not twilio_to:
        return None
    return _BY_NUMBER.get(_normalize_wa(twilio_to))


def normalize_wa(number: str) -> str:
    return _normalize_wa(number)
