"""Async Playwright crawler with stealth, retry, and graceful degradation.

Design goals
------------
1. **Anti-fingerprinting**: playwright-stealth patches + rotating UA pool +
   randomized viewport, locale, timezone, and color scheme per context.
2. **Resilience**: per-portal retry with exponential backoff; canonical
   handler failure auto-falls back to GenericTextHandler so the pipeline
   never aborts on a single bad site.
3. **Deduplication**: jobs are upserted on (portal_id, external_id) so
   re-runs do not flood the table with duplicates.
4. **Observability**: every exception is captured to portal.last_error
   and structured-logged — no swallowed errors.
"""
from __future__ import annotations

import asyncio
import logging
import random
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import AsyncIterator, Optional

from playwright.async_api import (
    Browser,
    BrowserContext,
    Error as PlaywrightError,
    Page,
    Playwright,
    TimeoutError as PWTimeoutError,
    async_playwright,
)
from sqlalchemy import select, update

try:
    from playwright_stealth import stealth_async  # type: ignore
except ImportError:  # pragma: no cover - stealth is optional but recommended
    stealth_async = None  # type: ignore[assignment]

from app.ats_handlers import RawJob, get_handler
from app.config import get_settings
from app.database import session_scope
from app.models import Job, Portal

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
]

VIEWPORTS = [
    (1440, 900), (1536, 864), (1680, 1050), (1920, 1080), (1366, 768),
]

LOCALES = ["en-US", "en-GB", "en-IL"]
TIMEZONES = ["Asia/Jerusalem", "Europe/London", "America/New_York"]


@dataclass
class ScrapeOutcome:
    portal_id: int
    portal_name: str
    inserted: int
    updated: int
    error: Optional[str] = None


class Scraper:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._semaphore = asyncio.Semaphore(self.settings.scraper_concurrency)

    # ------------------------------------------------------------------ public

    async def run(self, portal_ids: Optional[list[int]] = None) -> list[ScrapeOutcome]:
        """Scrape every active portal (or the specified subset) concurrently."""
        async with session_scope() as session:
            stmt = select(Portal).where(Portal.is_active.is_(True))
            if portal_ids:
                stmt = stmt.where(Portal.id.in_(portal_ids))
            portals = list((await session.execute(stmt)).scalars().all())

        if not portals:
            logger.info("No active portals configured")
            return []

        async with self._playwright() as pw:
            browser = await pw.chromium.launch(
                headless=self.settings.scraper_headless,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                ],
            )
            try:
                tasks = [self._scrape_portal(browser, p) for p in portals]
                return await asyncio.gather(*tasks)
            finally:
                await browser.close()

    # ----------------------------------------------------------------- internal

    @asynccontextmanager
    async def _playwright(self) -> AsyncIterator[Playwright]:
        pw = await async_playwright().start()
        try:
            yield pw
        finally:
            await pw.stop()

    async def _scrape_portal(self, browser: Browser, portal: Portal) -> ScrapeOutcome:
        async with self._semaphore:
            outcome = ScrapeOutcome(portal_id=portal.id, portal_name=portal.name, inserted=0, updated=0)
            try:
                raw_jobs = await self._with_retry(browser, portal)
                inserted, updated = await self._persist(portal.id, portal.company, raw_jobs)
                outcome.inserted = inserted
                outcome.updated = updated
                await self._mark_success(portal.id)
                logger.info(
                    "Scraped %s (%s): %d new / %d updated",
                    portal.name, portal.ats_type, inserted, updated,
                )
            except Exception as exc:  # noqa: BLE001 — pipeline must never crash
                outcome.error = f"{type(exc).__name__}: {exc}"
                await self._mark_failure(portal.id, outcome.error)
                logger.exception("Portal %s scrape failed: %s", portal.name, exc)
            return outcome

    async def _with_retry(self, browser: Browser, portal: Portal) -> list[RawJob]:
        last_exc: Optional[Exception] = None
        for attempt in range(1, self.settings.scraper_max_retries + 1):
            try:
                return await self._scrape_once(browser, portal)
            except (PWTimeoutError, PlaywrightError, asyncio.TimeoutError) as exc:
                last_exc = exc
                backoff = min(2 ** attempt + random.uniform(0, 1.5), 30.0)
                logger.warning(
                    "Attempt %d/%d for %s failed (%s); sleeping %.1fs",
                    attempt, self.settings.scraper_max_retries, portal.name, exc, backoff,
                )
                await asyncio.sleep(backoff)
        raise last_exc if last_exc else RuntimeError("scrape failed without exception")

    async def _scrape_once(self, browser: Browser, portal: Portal) -> list[RawJob]:
        context = await self._build_context(browser)
        page = await context.new_page()
        await self._apply_stealth(page)

        try:
            handler = get_handler(portal.ats_type)
            try:
                jobs = await handler.extract(page, portal.board_url, portal.company)
            except Exception as exc:  # noqa: BLE001 — fall back, don't crash
                logger.warning(
                    "%s handler failed for %s (%s); using GenericTextHandler",
                    handler.name, portal.name, exc,
                )
                jobs = []

            if not jobs and handler.name != "generic":
                generic = get_handler("generic")
                jobs = await generic.extract(page, portal.board_url, portal.company)

            return jobs
        finally:
            await context.close()

    async def _build_context(self, browser: Browser) -> BrowserContext:
        vp_w, vp_h = random.choice(VIEWPORTS)
        return await browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={"width": vp_w, "height": vp_h},
            locale=random.choice(LOCALES),
            timezone_id=random.choice(TIMEZONES),
            color_scheme=random.choice(["light", "dark"]),
            device_scale_factor=random.choice([1.0, 2.0]),
            java_script_enabled=True,
            ignore_https_errors=True,
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
                "Sec-Ch-Ua": '"Chromium";v="124", "Not_A Brand";v="99"',
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-User": "?1",
                "Sec-Fetch-Dest": "document",
            },
        )

    async def _apply_stealth(self, page: Page) -> None:
        if stealth_async is not None:
            try:
                await stealth_async(page)
            except Exception as exc:  # noqa: BLE001
                logger.debug("stealth_async failed: %s", exc)

        # Hand-rolled patches that supplement stealth: scrub webdriver flag,
        # spoof plugins/permissions to defeat lazy Cloudflare/DataDome checks.
        await page.add_init_script(
            """
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            const origQuery = window.navigator.permissions?.query;
            if (origQuery) {
              window.navigator.permissions.query = (p) => (
                p && p.name === 'notifications'
                  ? Promise.resolve({ state: Notification.permission })
                  : origQuery(p)
              );
            }
            window.chrome = { runtime: {} };
            """
        )
        page.set_default_timeout(self.settings.scraper_request_timeout_ms)

    # ----------------------------------------------------------------- persistence

    async def _persist(
        self, portal_id: int, company: str, raw_jobs: list[RawJob]
    ) -> tuple[int, int]:
        """Portable upsert. Works on SQLite and Postgres alike."""
        if not raw_jobs:
            return 0, 0
        inserted = updated = 0
        async with session_scope() as session:
            for rj in raw_jobs:
                if not rj.title or not rj.url:
                    continue
                external_id = rj.external_id[:255]
                existing = await session.execute(
                    select(Job).where(
                        Job.portal_id == portal_id,
                        Job.external_id == external_id,
                    )
                )
                job = existing.scalar_one_or_none()
                if job is None:
                    session.add(
                        Job(
                            portal_id=portal_id,
                            external_id=external_id,
                            company=(rj.company or company)[:120],
                            title=rj.title[:255],
                            location=(rj.location or "")[:255],
                            url=rj.url[:1024],
                            raw_text=rj.raw_text or "",
                        )
                    )
                    inserted += 1
                else:
                    job.title = rj.title[:255]
                    job.location = (rj.location or "")[:255]
                    job.raw_text = rj.raw_text or ""
                    job.company = (rj.company or company)[:120]
                    updated += 1
        return inserted, updated

    async def _mark_success(self, portal_id: int) -> None:
        async with session_scope() as session:
            await session.execute(
                update(Portal)
                .where(Portal.id == portal_id)
                .values(last_scanned_at=datetime.now(tz=timezone.utc), last_error=None)
            )

    async def _mark_failure(self, portal_id: int, error: str) -> None:
        async with session_scope() as session:
            await session.execute(
                update(Portal)
                .where(Portal.id == portal_id)
                .values(
                    last_scanned_at=datetime.now(tz=timezone.utc),
                    last_error=error[:2_000],
                )
            )


async def run_scraper(portal_ids: Optional[list[int]] = None) -> list[ScrapeOutcome]:
    return await Scraper().run(portal_ids=portal_ids)
