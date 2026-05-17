"""Async SQLAlchemy engine + session factory.

SQLite by default for zero-cost local/CI runs. Swap DATABASE_URL to a
Postgres connection string (Supabase/Neon) without changing application code.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings
from app.models import Base

_settings = get_settings()

engine = create_async_engine(
    _settings.database_url,
    echo=False,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def init_models() -> None:
    """Create tables at boot. Idempotent."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Transactional scope for background tasks (scraper, scheduler)."""
    session = AsyncSessionLocal()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency."""
    async with AsyncSessionLocal() as session:
        yield session


async def apply_persisted_overrides() -> None:
    """Merge runtime overrides from the `user_settings` table into the
    in-process Settings instance.

    Call at FastAPI startup AND at the top of every cron pipeline run —
    APScheduler runs in the API process (so overrides survive in-memory),
    but the GitHub Actions cron spawns a fresh Python process and must
    hydrate the cache from disk first.
    """
    from sqlalchemy import select  # local to avoid cycle at module load

    from app.config import get_settings
    from app.models import UserSetting

    settings = get_settings()
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(UserSetting))).scalars().all()
    for row in rows:
        if not isinstance(row.value, dict):
            continue
        value = row.value.get("value")
        if value is None or not hasattr(settings, row.key):
            continue
        try:
            setattr(settings, row.key, value)
        except Exception:  # noqa: BLE001 — bad override shouldn't crash boot
            continue
