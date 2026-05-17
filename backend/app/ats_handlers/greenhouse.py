"""Greenhouse ATS handler.

Greenhouse exposes a public, unauthenticated REST API at
`https://boards-api.greenhouse.io/v1/boards/{board}/jobs`. We use it
directly via the Playwright request context (which inherits stealth
fingerprinting) rather than scraping the SPA. If the board slug can't
be inferred from the URL, falls back to DOM scraping of the public
`/job_board` page.
"""
from __future__ import annotations

import logging
import re
from typing import Optional
from urllib.parse import urlparse

from playwright.async_api import Page

from app.ats_handlers.base import ATSHandler, RawJob

logger = logging.getLogger(__name__)

_BOARD_SLUG_RE = re.compile(r"boards\.greenhouse\.io/([a-z0-9_-]+)", re.IGNORECASE)
_EMBED_SLUG_RE = re.compile(r"greenhouse\.io/embed/job_board\?for=([a-z0-9_-]+)", re.IGNORECASE)


class GreenhouseHandler(ATSHandler):
    name = "greenhouse"
    wait_selector = "section.level-0, div.opening, .job-post"
    job_card_selector = "div.opening a, .job-post a"

    def _board_slug(self, url: str) -> Optional[str]:
        for regex in (_BOARD_SLUG_RE, _EMBED_SLUG_RE):
            m = regex.search(url)
            if m:
                return m.group(1).lower()
        parsed = urlparse(url)
        if parsed.hostname and parsed.hostname.endswith("greenhouse.io"):
            parts = [p for p in parsed.path.split("/") if p]
            if parts:
                return parts[0].lower()
        return None

    async def extract(self, page: Page, board_url: str, company: str) -> list[RawJob]:
        slug = self._board_slug(board_url)
        if slug:
            jobs = await self._from_api(page, slug, company)
            if jobs:
                return jobs
        logger.info("Greenhouse API empty for %s; falling back to DOM", board_url)
        return await self._from_dom(page, board_url, company)

    async def _from_api(self, page: Page, slug: str, company: str) -> list[RawJob]:
        api = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
        try:
            resp = await page.request.get(api, timeout=20_000)
            if resp.status != 200:
                logger.info("Greenhouse API %s returned %s", api, resp.status)
                return []
            data = await resp.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Greenhouse API call failed for %s: %s", slug, exc)
            return []

        jobs: list[RawJob] = []
        for j in data.get("jobs", []):
            content_html = j.get("content") or ""
            # Strip naive HTML — analyzer only needs plain text
            content_text = re.sub(r"<[^>]+>", " ", content_html)
            content_text = re.sub(r"\s+", " ", content_text).strip()
            jobs.append(
                RawJob(
                    external_id=str(j.get("id")),
                    title=(j.get("title") or "").strip(),
                    location=(j.get("location") or {}).get("name", "").strip(),
                    url=j.get("absolute_url", ""),
                    raw_text=content_text[:12_000],
                    company=company,
                    posted_at=j.get("updated_at"),
                    meta={"strategy": "greenhouse_api"},
                )
            )
        return jobs

    async def _from_dom(self, page: Page, board_url: str, company: str) -> list[RawJob]:
        await self.prepare(page, board_url)
        cards = await page.query_selector_all(self.job_card_selector)
        jobs: list[RawJob] = []
        for card in cards:
            try:
                title = (await card.inner_text()).strip()
                href = await card.get_attribute("href") or ""
                url = self._absolute(board_url, href)
                location = ""
                try:
                    location = await card.evaluate(
                        """el => {
                            const wrap = el.closest('.opening, .job-post');
                            const loc = wrap?.querySelector('.location');
                            return loc ? loc.innerText.trim() : '';
                        }"""
                    )
                except Exception:  # noqa: BLE001
                    pass
                jobs.append(
                    RawJob(
                        external_id=self._safe_id(url),
                        title=title,
                        location=location,
                        url=url,
                        raw_text=f"{title}\n{location}",
                        company=company,
                        meta={"strategy": "greenhouse_dom"},
                    )
                )
            except Exception as exc:  # noqa: BLE001
                logger.debug("Greenhouse card parse skipped: %s", exc)
        return jobs
