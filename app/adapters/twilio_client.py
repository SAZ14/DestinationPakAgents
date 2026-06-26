"""Outbound WhatsApp via Twilio.

The two-message pattern means the *real* answer is sent as a separate outbound
message (not TwiML). Live mode posts to Twilio's REST API; offline mode records
sends in memory so the whole flow is assertable in tests and the curl demo.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from ..config import Settings

logger = logging.getLogger("chief_of_staff.twilio")


@dataclass
class SentMessage:
    to: str
    from_: str
    body: str


class TwilioClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.sent: list[SentMessage] = []  # mock outbox (also handy for logs)

    @property
    def live(self) -> bool:
        return self.settings.twilio_live

    def send_whatsapp(self, *, to: str, from_: str, body: str) -> SentMessage:
        msg = SentMessage(to=to, from_=from_, body=body)
        self.sent.append(msg)
        if not self.live:
            logger.info("MOCK send_whatsapp to=%s body=%r", to, body)
            return msg
        self._post(msg)  # pragma: no cover - network
        return msg

    def _post(self, msg: SentMessage) -> None:  # pragma: no cover - network
        import httpx

        sid = self.settings.twilio_account_sid
        url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
        resp = httpx.post(
            url,
            data={"To": msg.to, "From": msg.from_, "Body": msg.body},
            auth=(sid, self.settings.twilio_auth_token or ""),
            timeout=15,
        )
        resp.raise_for_status()
        logger.info("twilio send ok to=%s", msg.to)
