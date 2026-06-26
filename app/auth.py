"""Fail-closed, silent auth gate.

On every inbound webhook we (1) resolve the tenant from the Twilio number the
message arrived on and (2) verify the sender is on that tenant's owner/staff
whitelist BEFORE anything else runs. An unauthorized (or unknown-tenant)
message is logged and dropped with an empty 200 — we never confirm the number
is a live internal line.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from .config import Tenant, tenant_for_number

logger = logging.getLogger("chief_of_staff.auth")


@dataclass(frozen=True)
class AuthResult:
    authorized: bool
    tenant: Tenant | None
    sender: str | None
    reason: str


def authorize(*, twilio_to: str | None, twilio_from: str | None) -> AuthResult:
    tenant = tenant_for_number(twilio_to)
    if tenant is None:
        logger.warning("auth_drop unknown_tenant_number to=%s", twilio_to)
        return AuthResult(False, None, twilio_from, "unknown_tenant")

    if not twilio_from or not tenant.is_authorized(twilio_from):
        # Do NOT echo whether the number/tenant exists — silent drop.
        logger.warning(
            "auth_drop not_whitelisted tenant=%s from=%s", tenant.tenant_id, twilio_from
        )
        return AuthResult(False, tenant, twilio_from, "not_whitelisted")

    logger.info("auth_ok tenant=%s from=%s", tenant.tenant_id, twilio_from)
    return AuthResult(True, tenant, twilio_from, "ok")
