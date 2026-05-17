"""Lever ATS handler.

Lever's public postings API: `https://api.lever.co/v0/postings/{company}?mode=json`.
The DOM fallback parses the `.posting` cards on `jobs.lever.co/{company}`.
"""
from __future__ import annotations

import logging
import re
from typing import Optional
from urllib.parse import urlparse

from playwright.async_api import Page

from app.ats_handlers.base import ATSHandler, RawJob

logger = logging.getLogger(__name__)

_SLUG_RE = re.compile(r"jobs\.lever\.co/([a-z0-9_-]+)", re.IGNORECASE)


class LeverHandler(ATSHandler):
    name = "lever"
    wait_selector = ".posting, .postings-group"
    job_card_selector = ".posting a.posting-title, a.posting-title"

    def _slug(self, url: str) -> Optional[str]:
        m = _SLUG_RE.search(url)
        if m:
            return m.group(1).lower()
        parsed = urlparse(url)
        if parsed.hostname and parsed.hostname.endswith("lever.co"):
            parts = [p for p in parsed.path.split("/") if p]
            if parts:
                return parts[0].lower()
        return None

    async def extract(self, page: Page, board_url: str, company: str) -> list[RawJob]:
        slug = self._slug(board_url)
        if slug:
            jobs = await self._from_api(page, slug, company)
            if jobs:
                return jobs
        logger.info("Lever API empty for %s; falling back to DOM", board_url)
        return await self._from_dom(page, board_url, company)

    async def _from_api(self, page: Page, slug: str, company: str) -> list[RawJob]:
        api = f"https://api.lever.co/v0/postings/{slug}?mode=json"
        try:
            resp = await page.request.get(api, timeout=20_000)
            if resp.status != 200:
                return []
            data = await resp.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Lever API call failed for %s: %s", slug, exc)
            return []

        jobs: list[RawJob] = []
        for p in data:
            description = p.get("descriptionPlain") or p.get("description") or ""
            categories = p.get("categories", {}) or {}
            all_locations = categories.get("allLocations") or []
            location = (
                categories.get("location")
                or (all_locations[0] if all_locations else "")
                or ""
            )
            jobs.append(
                RawJob(
                    external_id=str(p.get("id", "")),
                    title=(p.get("text") or "").strip(),
                    location=location,
                    url=p.get("hostedUrl") or p.get("applyUrl") or "",
                    raw_text=re.sub(r"\s+", " ", description)[:12_000],
                    company=company,
                    posted_at=str(p.get("createdAt", "")),
                    meta={"strategy": "lever_api", "team": categories.get("team", "")},
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
                            const wrap = el.closest('.posting');
                            const loc = wrap?.querySelector('.sort-by-location, .location');
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
                        meta={"strategy": "lever_dom"},
                    )
                )
            except Exception as exc:  # noqa: BLE001
                logger.debug("Lever card parse skipped: %s", exc)
        return jobs
