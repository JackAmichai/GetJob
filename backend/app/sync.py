"""Sync the canonical portals list (config/portals.json) into the DB.

The JSON file is the source of truth — the dashboard and CI pipeline
both read it. This sync step runs at the start of every cron pipeline:
  * inserts portals new to the file
  * updates ats_type / company / board_url for existing portals
  * deactivates portals removed from the file (soft delete; preserves
    historical jobs for audit)
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from sqlalchemy import select

from app.config import BASE_DIR
from app.database import session_scope
from app.models import Portal

logger = logging.getLogger(__name__)

PORTALS_JSON = BASE_DIR.parent / "config" / "portals.json"


async def sync_portals_from_file(path: Path = PORTALS_JSON) -> tuple[int, int, int]:
    """Returns (added, updated, deactivated)."""
    if not path.exists():
        logger.warning("Portals config missing at %s — skipping sync", path)
        return 0, 0, 0

    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError(f"{path} must contain a JSON array of portal objects")

    desired: dict[str, dict] = {}
    for entry in raw:
        url = entry.get("board_url")
        if not url:
            continue
        desired[url.strip()] = {
            "name": entry.get("name", entry.get("company", url))[:120],
            "ats_type": (entry.get("ats_type") or "generic").lower(),
            "company": (entry.get("company") or entry.get("name") or "")[:120],
            "board_url": url.strip()[:512],
            "is_active": bool(entry.get("is_active", True)),
        }

    added = updated = deactivated = 0
    async with session_scope() as session:
        existing = list((await session.execute(select(Portal))).scalars().all())
        existing_by_url = {p.board_url: p for p in existing}

        for url, values in desired.items():
            current = existing_by_url.get(url)
            if current is None:
                session.add(Portal(**values))
                added += 1
            else:
                changed = False
                for key, value in values.items():
                    if getattr(current, key) != value:
                        setattr(current, key, value)
                        changed = True
                if changed:
                    updated += 1

        for url, portal in existing_by_url.items():
            if url not in desired and portal.is_active:
                portal.is_active = False
                deactivated += 1

    logger.info(
        "Portal sync: +%d added, ~%d updated, -%d deactivated",
        added, updated, deactivated,
    )
    return added, updated, deactivated
