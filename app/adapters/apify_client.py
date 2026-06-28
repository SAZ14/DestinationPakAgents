"""Competitor scraping via Apify (reuses the existing Instagram-scrape path).

Live mode runs the configured Apify actor; offline mode returns a deterministic
canned scrape so the intelligence lane is fully demoable without a token.
Returns a list of ``{competitor, package, price, duration, notes}`` dicts.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from ..config import Settings

logger = logging.getLogger("chief_of_staff.apify")


# Canned results keyed loosely by destination for the offline/mock path.
_MOCK_SCRAPES = {
    "hunza": [
        dict(competitor="Hunza Explorers", package="7-Day Hunza Cultural",
             price=1650, duration=7, notes="Undercuts us by ~$150; smaller group sizes."),
        dict(competitor="Apricot Tours", package="8-Day Hunza Heritage",
             price=1950, duration=8, notes="Premium positioning, includes Khunjerab Pass."),
    ],
    "skardu": [
        dict(competitor="Karakoram Tours", package="10-Day Skardu & Deosai",
             price=2250, duration=10, notes="Undercuts us by ~$150 on the same itinerary."),
    ],
    "k2": [
        dict(competitor="Karakoram Tours", package="18-Day K2 Base Camp",
             price=3300, duration=18, notes="Cheaper but uses shared porters."),
    ],
}

_DEFAULT_SCRAPE = [
    dict(competitor="Karakoram Tours", package="Northern Pakistan Highlights",
         price=2100, duration=9, notes="Generalist itinerary, broad marketing."),
]


@dataclass
class ApifyClient:
    settings: Settings

    @property
    def live(self) -> bool:
        return self.settings.apify_live

    def scrape_competitors(self, destination: str, handles: list[str] | None = None) -> list[dict]:
        if not self.live:
            key = (destination or "").strip().lower()
            results = _MOCK_SCRAPES.get(key, _DEFAULT_SCRAPE)
            logger.info("MOCK competitor_scan dest=%s -> %d results", destination, len(results))
            return [dict(r) for r in results]
        return self._run_actor(destination, handles)  # pragma: no cover - network

    def _run_actor(self, destination: str, handles: list[str] | None) -> list[dict]:  # pragma: no cover
        import httpx

        actor = self.settings.apify_instagram_actor.replace("/", "~")
        url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items"
        resp = httpx.post(
            url,
            params={"token": self.settings.apify_token},
            json={"directUrls": [f"https://instagram.com/{h.lstrip('@')}/" for h in (handles or [])]},
            timeout=120,
        )
        resp.raise_for_status()
        items = resp.json()
        # Normalize raw scrape items into our shape. Real parsing would extract
        # package/price from captions; left thin here intentionally.
        return [
            dict(competitor=it.get("ownerUsername", "unknown"),
                 package=it.get("caption", "")[:60], price=None,
                 duration=None, notes="Raw scrape; price/duration not parsed.")
            for it in items
        ]
