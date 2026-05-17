"""ATS handler protocol + generic fallback.

Every handler must return a list of `RawJob` records. When canonical
selectors fail, the orchestrator falls back to GenericTextHandler, which
extracts full-page text + best-effort link discovery so downstream
semantic scoring can still operate.
"""
from __future__ import annotations

import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urljoin, urlparse

from playwright.async_api import Error as PlaywrightError, Page, TimeoutError as PWTimeoutError

logger = logging.getLogger(__name__)


@dataclass
class RawJob:
    external_id: str
    title: str
    location: str
    url: str
    raw_text: str
    company: str = ""
    posted_at: Optional[str] = None
    meta: dict = field(default_factory=dict)


class ATSHandler(ABC):
    name: str = "generic"
    wait_selector: Optional[str] = None
    job_card_selector: Optional[str] = None

    async def prepare(self, page: Page, board_url: str) -> None:
        """Navigate + wait for the listing surface to render."""
        await page.goto(board_url, wait_until="domcontentloaded", timeout=45_000)
        if self.wait_selector:
            try:
                await page.wait_for_selector(self.wait_selector, timeout=15_000)
            except PWTimeoutError:
                logger.warning("Wait selector %s missing on %s", self.wait_selector, board_url)
        # Allow client-side hydration to settle
        await page.wait_for_timeout(1_500)

    @abstractmethod
    async def extract(self, page: Page, board_url: str, company: str) -> list[RawJob]:
        ...

    @staticmethod
    def _absolute(base: str, href: str) -> str:
        if not href:
            return base
        if href.startswith(("http://", "https://")):
            return href
        return urljoin(base, href)

    @staticmethod
    def _safe_id(url: str) -> str:
        parsed = urlparse(url)
        slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", parsed.path).strip("-")
        return slug or url


class GenericTextHandler(ATSHandler):
    """Final-resort handler: dump the rendered DOM as text + scan anchors.

    Activated when a specific ATS handler raises or returns zero rows. We
    accept lower precision in exchange for never breaking the pipeline.
    """

    name = "generic"

    async def extract(self, page: Page, board_url: str, company: str) -> list[RawJob]:
        # Idempotent — if a canonical handler already navigated to this URL
        # Playwright's same-URL goto is a cheap re-render. Required when
        # GenericTextHandler is the primary handler (ats_type='generic').
        if page.url != board_url:
            try:
                await self.prepare(page, board_url)
            except (PlaywrightError, PWTimeoutError) as exc:
                logger.warning("Generic prepare failed for %s: %s", board_url, exc)
                return []
        try:
            full_text = await page.inner_text("body", timeout=10_000)
        except (PlaywrightError, PWTimeoutError) as exc:
            logger.warning("Generic body extraction failed for %s: %s", board_url, exc)
            full_text = ""

        # Heuristic anchor discovery: hrefs whose text matches job-like phrases
        anchors = await page.eval_on_selector_all(
            "a[href]",
            """els => els.map(e => ({
                href: e.getAttribute('href') || '',
                text: (e.innerText || '').trim()
            }))""",
        )

        jobs: list[RawJob] = []
        seen: set[str] = set()
        job_kw = re.compile(
            r"\b(engineer|developer|architect|scientist|manager|lead|director|analyst|designer|"
            r"product|devops|sre|qa|backend|frontend|fullstack|full-stack|staff|principal|senior)\b",
            re.IGNORECASE,
        )

        for a in anchors:
            text = (a.get("text") or "").strip()
            href = (a.get("href") or "").strip()
            if not text or not href or len(text) < 4 or len(text) > 200:
                continue
            if not job_kw.search(text):
                continue
            url = self._absolute(board_url, href)
            if url in seen:
                continue
            seen.add(url)
            jobs.append(
                RawJob(
                    external_id=self._safe_id(url),
                    title=text,
                    location="",  # unknown from generic discovery
                    url=url,
                    raw_text=full_text[:8_000],
                    company=company,
                    meta={"strategy": "generic_fallback"},
                )
            )

        if not jobs and full_text:
            # Last resort: a single synthetic record holding raw text so the
            # analyzer can still surface a relevance signal for the board.
            jobs.append(
                RawJob(
                    external_id=self._safe_id(board_url),
                    title=f"{company} careers (unstructured)",
                    location="",
                    url=board_url,
                    raw_text=full_text[:8_000],
                    company=company,
                    meta={"strategy": "generic_fallback_dump"},
                )
            )
        return jobs
