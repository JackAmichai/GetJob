"""FastAPI entry point: dashboard API + scheduler attachment."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings, reload_settings
from app.database import apply_persisted_overrides, get_session, init_models
from app.models import Job, Portal, UserSetting
from app.scheduler import run_pipeline, start_scheduler
from app.schemas import (
    JobActionIn,
    JobOut,
    PortalIn,
    PortalOut,
    SettingsIn,
    SettingsOut,
    StatsOut,
    TriggerResponse,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_models()
    await apply_persisted_overrides()
    scheduler = start_scheduler()
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


app = FastAPI(title="GetJob API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------- jobs


@app.get("/api/jobs", response_model=list[JobOut])
async def list_jobs(
    session: AsyncSession = Depends(get_session),
    min_score: int = Query(default=0, ge=0, le=100),
    include_dismissed: bool = False,
    limit: int = Query(default=200, le=1000),
) -> list[Job]:
    stmt = select(Job).order_by(
        Job.relevance_score.desc().nulls_last(),
        Job.scraped_at.desc(),
    )
    if min_score:
        stmt = stmt.where(Job.relevance_score >= min_score)
    if not include_dismissed:
        stmt = stmt.where(Job.dismissed.is_(False))
    stmt = stmt.limit(limit)
    return list((await session.execute(stmt)).scalars().all())


@app.patch("/api/jobs/{job_id}", response_model=JobOut)
async def update_job(
    job_id: int,
    payload: JobActionIn,
    session: AsyncSession = Depends(get_session),
) -> Job:
    job = await session.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    if payload.starred is not None:
        job.starred = payload.starred
    if payload.dismissed is not None:
        job.dismissed = payload.dismissed
    await session.commit()
    await session.refresh(job)
    return job


# --------------------------------------------------------------------- portals


@app.get("/api/portals", response_model=list[PortalOut])
async def list_portals(session: AsyncSession = Depends(get_session)) -> list[Portal]:
    stmt = select(Portal).order_by(Portal.name)
    return list((await session.execute(stmt)).scalars().all())


@app.post("/api/portals", response_model=PortalOut, status_code=201)
async def create_portal(
    payload: PortalIn, session: AsyncSession = Depends(get_session)
) -> Portal:
    portal = Portal(**payload.model_dump())
    session.add(portal)
    try:
        await session.commit()
    except Exception as exc:  # likely unique-constraint violation
        await session.rollback()
        raise HTTPException(400, f"Portal create failed: {exc}") from exc
    await session.refresh(portal)
    return portal


@app.delete("/api/portals/{portal_id}", status_code=204)
async def delete_portal(
    portal_id: int, session: AsyncSession = Depends(get_session)
) -> None:
    portal = await session.get(Portal, portal_id)
    if portal is None:
        raise HTTPException(404, "Portal not found")
    await session.delete(portal)
    await session.commit()


# --------------------------------------------------------------------- settings


@app.get("/api/settings", response_model=SettingsOut)
async def read_settings(session: AsyncSession = Depends(get_session)) -> SettingsOut:
    s = get_settings()
    overrides = await _load_overrides(session)
    return SettingsOut(
        default_location=overrides.get("default_location", s.default_location),
        default_email=overrides.get("default_email", s.default_email),
        relevance_threshold=int(overrides.get("relevance_threshold", s.relevance_threshold)),
        scan_cron=overrides.get("scan_cron", s.scan_cron),
        llm_provider=s.llm_provider,
    )


@app.patch("/api/settings", response_model=SettingsOut)
async def update_settings(
    payload: SettingsIn, session: AsyncSession = Depends(get_session)
) -> SettingsOut:
    updates = payload.model_dump(exclude_none=True)
    for key, value in updates.items():
        await _upsert_setting(session, key, value)
    await session.commit()

    # Mirror persisted overrides back into runtime settings cache.
    runtime = reload_settings()
    for key, value in updates.items():
        if hasattr(runtime, key):
            setattr(runtime, key, value)
    return await read_settings(session)


async def _load_overrides(session: AsyncSession) -> dict:
    stmt = select(UserSetting)
    rows = (await session.execute(stmt)).scalars().all()
    return {r.key: r.value.get("value") for r in rows if isinstance(r.value, dict)}


async def _upsert_setting(session: AsyncSession, key: str, value) -> None:
    existing = await session.get(UserSetting, key)
    if existing is None:
        session.add(UserSetting(key=key, value={"value": value}))
    else:
        existing.value = {"value": value}
        existing.updated_at = datetime.now(tz=timezone.utc)


# --------------------------------------------------------------------- ops


@app.post("/api/trigger-scan", response_model=TriggerResponse)
async def trigger_scan() -> TriggerResponse:
    report = await run_pipeline()
    return TriggerResponse(status="ok", **report.__dict__)


@app.get("/api/stats", response_model=StatsOut)
async def stats(session: AsyncSession = Depends(get_session)) -> StatsOut:
    settings = get_settings()
    total = await session.scalar(select(func.count(Job.id)))
    scored = await session.scalar(
        select(func.count(Job.id)).where(Job.relevance_score.is_not(None))
    )
    high = await session.scalar(
        select(func.count(Job.id)).where(
            Job.relevance_score >= settings.relevance_threshold
        )
    )
    active_portals = await session.scalar(
        select(func.count(Portal.id)).where(Portal.is_active.is_(True))
    )
    last_scan = await session.scalar(select(func.max(Portal.last_scanned_at)))
    return StatsOut(
        total_jobs=total or 0,
        scored_jobs=scored or 0,
        high_match_jobs=high or 0,
        portals_active=active_portals or 0,
        last_scan_at=last_scan,
    )


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "time": datetime.now(tz=timezone.utc).isoformat()}
