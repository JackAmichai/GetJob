"""Daily pipeline orchestrator: scrape → analyze → notify.

Two execution modes:
  • In-process: APScheduler runs the pipeline at SCAN_CRON. Used when
    the FastAPI server is the long-lived process.
  • One-shot: `python -m app.scheduler --once` runs a single pipeline
    iteration and exits. Used by GitHub Actions / cron / serverless.

Either mode shares the same `run_pipeline()` coroutine, so behavior is
identical regardless of how it's invoked.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from dataclasses import asdict, dataclass

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.analyzer import run_analyzer
from app.config import get_settings
from app.database import apply_persisted_overrides, init_models
from app.notifier import send_digest
from app.scraper import run_scraper

logger = logging.getLogger(__name__)


@dataclass
class PipelineReport:
    portals_scraped: int
    scrape_errors: int
    jobs_scored: int
    digest_recipients_notified: int
    digest_jobs_included: int


async def run_pipeline() -> PipelineReport:
    """Single end-to-end execution. Safe to call ad-hoc or on cron."""
    await init_models()
    await apply_persisted_overrides()
    settings = get_settings()
    logger.info(
        "Starting pipeline · location=%s · threshold=%d · provider=%s",
        settings.default_location, settings.relevance_threshold, settings.llm_provider,
    )

    # 1. Scrape
    try:
        outcomes = await run_scraper()
        scrape_errors = sum(1 for o in outcomes if o.error)
        portals = len(outcomes)
    except Exception:  # noqa: BLE001 — keep going to analyze stale data if possible
        logger.exception("Scrape phase crashed; continuing to analyzer with existing data")
        outcomes, scrape_errors, portals = [], 0, 0

    # 2. Analyze
    try:
        scored = await run_analyzer()
    except Exception:  # noqa: BLE001
        logger.exception("Analyze phase crashed; attempting to notify on previously-scored jobs")
        scored = 0

    # 3. Notify
    digest_count = 0
    recipients_notified = 0
    try:
        digest_count = await send_digest()
        recipients_notified = 1 if digest_count > 0 else 0
    except Exception:  # noqa: BLE001
        logger.exception("Notification phase failed — digest will retry next run")

    report = PipelineReport(
        portals_scraped=portals,
        scrape_errors=scrape_errors,
        jobs_scored=scored,
        digest_recipients_notified=recipients_notified,
        digest_jobs_included=digest_count,
    )
    logger.info("Pipeline complete: %s", asdict(report))
    return report


def start_scheduler() -> AsyncIOScheduler:
    """Attach APScheduler to the current event loop."""
    settings = get_settings()
    scheduler = AsyncIOScheduler(timezone="Asia/Jerusalem")
    scheduler.add_job(
        run_pipeline,
        CronTrigger.from_crontab(settings.scan_cron, timezone="Asia/Jerusalem"),
        id="daily_scan",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )
    scheduler.start()
    logger.info("Scheduler started with cron '%s' (Asia/Jerusalem)", settings.scan_cron)
    return scheduler


def _cli() -> int:
    parser = argparse.ArgumentParser(description="GetJob pipeline runner")
    parser.add_argument("--once", action="store_true", help="Run pipeline once and exit")
    parser.add_argument("--scrape-only", action="store_true")
    parser.add_argument("--analyze-only", action="store_true")
    parser.add_argument("--notify-only", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    async def _main() -> int:
        await init_models()
        if args.scrape_only:
            outcomes = await run_scraper()
            print(f"Scraped {len(outcomes)} portals; errors: {sum(1 for o in outcomes if o.error)}")
            return 0
        if args.analyze_only:
            n = await run_analyzer()
            print(f"Scored {n} jobs")
            return 0
        if args.notify_only:
            n = await send_digest()
            print(f"Digest dispatched with {n} jobs")
            return 0
        report = await run_pipeline()
        print(asdict(report))
        return 0

    return asyncio.run(_main())


if __name__ == "__main__":
    sys.exit(_cli())
