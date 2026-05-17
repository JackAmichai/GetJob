"""Pydantic API schemas (request/response models for the dashboard)."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PortalIn(BaseModel):
    name: str
    ats_type: str = Field(pattern="^(workday|greenhouse|lever|generic)$")
    board_url: str
    company: str
    is_active: bool = True


class PortalOut(PortalIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    last_scanned_at: Optional[datetime]
    last_error: Optional[str]
    created_at: datetime


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company: str
    title: str
    location: str
    url: str
    scraped_at: datetime
    posted_at: Optional[datetime]
    relevance_score: Optional[int]
    tech_score: Optional[int]
    experience_score: Optional[int]
    geography_score: Optional[int]
    brief: Optional[str]
    analyzed_at: Optional[datetime]
    notified: bool
    dismissed: bool
    starred: bool


class JobActionIn(BaseModel):
    starred: Optional[bool] = None
    dismissed: Optional[bool] = None


class SettingsOut(BaseModel):
    default_location: str
    default_email: EmailStr
    relevance_threshold: int
    scan_cron: str
    llm_provider: str


class SettingsIn(BaseModel):
    default_location: Optional[str] = None
    default_email: Optional[EmailStr] = None
    relevance_threshold: Optional[int] = Field(default=None, ge=0, le=100)
    scan_cron: Optional[str] = None


class TriggerResponse(BaseModel):
    status: str
    portals_scraped: int = 0
    scrape_errors: int = 0
    jobs_scored: int = 0
    digest_jobs_included: int = 0


class StatsOut(BaseModel):
    total_jobs: int
    scored_jobs: int
    high_match_jobs: int
    portals_active: int
    last_scan_at: Optional[datetime]
