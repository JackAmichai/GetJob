"""Workday ATS handler.

Workday surfaces its job board via a backing JSON API that the SPA
hits on load (`/wday/cxs/{tenant}/{site}/jobs`). We capture those
responses during navigation and decode them after — far more robust
than DOM scraping. If interception misses, we fall back to selector-
based extraction of `<a data-automation-id='jobTitle'>` cards.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from playwright.async_api import Page, Response

from app.ats_handlers.base import ATSHandler, RawJob

logger = logging.getLogger(__name__)


class WorkdayHandler(ATSHandler):
    name = "workday"
    wait_selector = "[data-automation-id='jobResults'], section[data-automation-id='jobResults']"
    job_card_selector = "a[data-automation-id='jobTitle']"

    async def extract(self, page: Page, board_url: str, company: str) -> list[RawJob]:
        captured: list[Response] = []

        def _on_response(resp: Response) -> None:
            url = resp.url
            if "/wday/cxs/" in url and url.endswith("/jobs"):
                captured.append(resp)

        page.on("response", _on_response)
        try:
            await self.prepare(page, board_url)
            # Trigger lazy load — Workday renders ~20 cards per fetch
            for _ in range(3):
                await page.mouse.wheel(0, 1_500)
                await page.wait_for_timeout(800)
        finally:
            page.remove_listener("response", _on_response)

        payloads: list[dict[str, Any]] = []
        for resp in captured:
            try:
                body = await resp.text()
                payloads.append(json.loads(body))
            except Exception as exc:  # noqa: BLE001 — bad response → skip
                logger.debug("Workday response decode failed: %s", exc)

        if payloads:
            return self._from_api(payloads, board_url, company)

        logger.info("Workday API capture empty for %s; falling back to DOM", board_url)
        return await self._from_dom(page, board_url, company)

    def _from_api(self, payloads: list[dict[str, Any]], board_url: str, company: str) -> list[RawJob]:
        jobs: list[RawJob] = []
        seen: set[str] = set()
        for payload in payloads:
            postings = payload.get("jobPostings") or []
            for p in postings:
                ext_path = p.get("externalPath") or ""
                url = self._absolute(board_url, ext_path)
                if url in seen:
                    continue
                seen.add(url)
                bullets = p.get("bulletFields") or []
                ext_id = (bullets[0] if bullets else "") or ext_path or url
                jobs.append(
                    RawJob(
                        external_id=str(ext_id),
                        title=(p.get("title") or "").strip(),
                        location=(p.get("locationsText") or "").strip(),
                        url=url,
                        raw_text=f"{p.get('title', '')}\n{p.get('locationsText', '')}\n{p.get('postedOn', '')}",
                        company=company,
                        posted_at=p.get("postedOn"),
                        meta={"strategy": "workday_api"},
                    )
                )
        return jobs

    async def _from_dom(self, page: Page, board_url: str, company: str) -> list[RawJob]:
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
                            const wrapper = el.closest('li, div[data-automation-id]');
                            const loc = wrapper?.querySelector(
                                "[data-automation-id='locations'], dd[data-automation-id='locations']"
                            );
                            return loc ? loc.innerText.trim() : '';
                        }"""
                    )
                except Exception:  # noqa: BLE001
                    pass
                jobs.append(
                    RawJob(
                        external_id=self._safe_id(url),
                        title=title,
                        location=re.sub(r"\s+", " ", location),
                        url=url,
                        raw_text=f"{title}\n{location}",
                        company=company,
                        meta={"strategy": "workday_dom"},
                    )
                )
            except Exception as exc:  # noqa: BLE001 — per-card resilience
                logger.debug("Workday card parse skipped: %s", exc)
        return jobs
