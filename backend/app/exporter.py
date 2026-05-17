"""Export the latest scan results to a static JSON file the frontend reads.

After every pipeline run we dump:
  * settings (location, threshold, email, cron)
  * stats (totals, last_scan, error counts)
  * portals (with last_scanned_at + last_error)
  * jobs (all scored jobs ordered by relevance desc, capped to 500)

The output lands at `frontend/public/data.json` so it deploys with the
static site (Vercel auto-rebuilds when the GitHub Actions cron commits
this file back to the repo).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, select

from app.config import BASE_DIR, get_settings
from app.database import session_scope
from app.models import Job, Portal

logger = logging.getLogger(__name__)

DATA_JSON = BASE_DIR.parent / "frontend" / "public" / "data.json"
MAX_JOBS_EXPORTED = 500


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


async def export_to_json(path: Path = DATA_JSON) -> dict[str, Any]:
    settings = get_settings()
    async with session_scope() as session:
        portals = list(
            (await session.execute(select(Portal).order_by(Portal.name))).scalars().all()
        )

        jobs_stmt = (
            select(Job)
            .where(Job.relevance_score.is_not(None))
            .order_by(Job.relevance_score.desc().nulls_last(), Job.scraped_at.desc())
            .limit(MAX_JOBS_EXPORTED)
        )
        jobs = list((await session.execute(jobs_stmt)).scalars().all())

        total = await session.scalar(select(func.count(Job.id))) or 0
        scored = await session.scalar(
            select(func.count(Job.id)).where(Job.relevance_score.is_not(None))
        ) or 0
        high = await session.scalar(
            select(func.count(Job.id)).where(
                Job.relevance_score >= settings.relevance_threshold
            )
        ) or 0
        last_scan = await session.scalar(select(func.max(Portal.last_scanned_at)))
        active_portals = await session.scalar(
            select(func.count(Portal.id)).where(Portal.is_active.is_(True))
        ) or 0

    payload: dict[str, Any] = {
        "version": 1,
        "generated_at": _iso(datetime.now(tz=timezone.utc)),
        "settings": {
            "default_location": settings.default_location,
            "default_email": settings.default_email,
            "relevance_threshold": settings.relevance_threshold,
            "scan_cron": settings.scan_cron,
            "llm_provider": settings.llm_provider,
        },
        "stats": {
            "total_jobs": total,
            "scored_jobs": scored,
            "high_match_jobs": high,
            "portals_active": active_portals,
            "last_scan_at": _iso(last_scan),
        },
        "portals": [
            {
                "id": p.id,
                "name": p.name,
                "ats_type": p.ats_type,
                "board_url": p.board_url,
                "company": p.company,
                "is_active": p.is_active,
                "last_scanned_at": _iso(p.last_scanned_at),
                "last_error": p.last_error,
                "created_at": _iso(p.created_at),
            }
            for p in portals
        ],
        "jobs": [
            {
                "id": j.id,
                "company": j.company,
                "title": j.title,
                "location": j.location,
                "url": j.url,
                "scraped_at": _iso(j.scraped_at),
                "posted_at": _iso(j.posted_at),
                "relevance_score": j.relevance_score,
                "tech_score": j.tech_score,
                "experience_score": j.experience_score,
                "geography_score": j.geography_score,
                "brief": j.brief,
                "analyzed_at": _iso(j.analyzed_at),
                "notified": j.notified,
                "dismissed": j.dismissed,
                "starred": j.starred,
            }
            for j in jobs
        ],
    }

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    logger.info("Exported %d jobs + %d portals → %s", len(jobs), len(portals), path)
    return payload
