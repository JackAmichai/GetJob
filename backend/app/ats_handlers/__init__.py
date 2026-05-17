"""ATS-specific extraction strategies.

Each handler exposes an `extract(page, board_url) -> list[RawJob]` coroutine.
When the canonical selectors fail (ATS UI revision, A/B test, geo block),
the framework auto-falls back to GenericTextHandler.
"""
from __future__ import annotations

from app.ats_handlers.base import ATSHandler, GenericTextHandler, RawJob
from app.ats_handlers.greenhouse import GreenhouseHandler
from app.ats_handlers.lever import LeverHandler
from app.ats_handlers.workday import WorkdayHandler

HANDLERS: dict[str, type[ATSHandler]] = {
    "workday": WorkdayHandler,
    "greenhouse": GreenhouseHandler,
    "lever": LeverHandler,
    "generic": GenericTextHandler,
}


def get_handler(ats_type: str) -> ATSHandler:
    klass = HANDLERS.get(ats_type.lower(), GenericTextHandler)
    return klass()


__all__ = [
    "ATSHandler",
    "GenericTextHandler",
    "GreenhouseHandler",
    "LeverHandler",
    "RawJob",
    "WorkdayHandler",
    "HANDLERS",
    "get_handler",
]
