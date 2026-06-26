from __future__ import annotations

import dataclasses
from datetime import date

import pytest

from app.adapters.anthropic_client import MockAnthropic
from app.adapters.apify_client import ApifyClient
from app.adapters.db import BASE_TODAY, seeded_database
from app.agent.runner import Agent
from app.config import SETTINGS
from app.tools.chief_of_staff.actions import PendingActionStore
from app.tools.chief_of_staff.context import ToolContext

TENANT = "destination-pakistan"
OWNER = "whatsapp:+923001112233"

# Force fully-mocked mode regardless of ambient credentials so the suite is
# hermetic and never touches the network.
MOCK_SETTINGS = dataclasses.replace(
    SETTINGS, anthropic_api_key=None, apify_token=None,
    twilio_account_sid=None, twilio_auth_token=None,
)


@pytest.fixture
def settings():
    return MOCK_SETTINGS


@pytest.fixture
def today() -> date:
    return BASE_TODAY


@pytest.fixture
def db():
    return seeded_database()


@pytest.fixture
def actions():
    return PendingActionStore(ttl_minutes=30)


@pytest.fixture
def agent(db, actions):
    return Agent(
        db=db,
        anthropic=MockAnthropic(MOCK_SETTINGS),
        apify=ApifyClient(MOCK_SETTINGS),
        actions=actions,
        settings=MOCK_SETTINGS,
    )


@pytest.fixture
def ctx(db, actions, today):
    c = ToolContext(
        tenant_id=TENANT, sender=OWNER, db=db, apify=ApifyClient(MOCK_SETTINGS),
        settings=MOCK_SETTINGS, actions=actions, today=today,
    )
    c.draft_copy = MockAnthropic(MOCK_SETTINGS).draft_copy
    return c
