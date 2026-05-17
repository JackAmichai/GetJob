"""ORM entities for the job-scanning pipeline.

`Job` is the canonical record: deduped by (portal_id, external_id).
`Portal` enumerates target ATS endpoints (Workday/Greenhouse/Lever boards).
`HistoricalScore` tracks score evolution per job over time (model drift,
re-runs after CV edits).
`UserSetting` is a singleton key/value store for runtime-mutable config.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Portal(Base):
    __tablename__ = "portals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    ats_type: Mapped[str] = mapped_column(String(32), nullable=False)  # workday | greenhouse | lever | generic
    board_url: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    company: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    last_scanned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    jobs: Mapped[list["Job"]] = relationship(back_populates="portal", cascade="all, delete-orphan")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        UniqueConstraint("portal_id", "external_id", name="uq_portal_external"),
        Index("ix_jobs_score", "relevance_score"),
        Index("ix_jobs_scraped", "scraped_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    portal_id: Mapped[int] = mapped_column(ForeignKey("portals.id", ondelete="CASCADE"))
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str] = mapped_column(String(120), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), default="")
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, default="")
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Scoring output (mirrors HistoricalScore latest entry for fast reads)
    relevance_score: Mapped[Optional[int]] = mapped_column(Integer)
    tech_score: Mapped[Optional[int]] = mapped_column(Integer)
    experience_score: Mapped[Optional[int]] = mapped_column(Integer)
    geography_score: Mapped[Optional[int]] = mapped_column(Integer)
    brief: Mapped[Optional[str]] = mapped_column(Text)
    analyzed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Lifecycle flags
    notified: Mapped[bool] = mapped_column(default=False)
    dismissed: Mapped[bool] = mapped_column(default=False)
    starred: Mapped[bool] = mapped_column(default=False)

    portal: Mapped[Portal] = relationship(back_populates="jobs")
    history: Mapped[list["HistoricalScore"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )


class HistoricalScore(Base):
    __tablename__ = "historical_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    relevance_score: Mapped[int] = mapped_column(Integer)
    tech_score: Mapped[int] = mapped_column(Integer)
    experience_score: Mapped[int] = mapped_column(Integer)
    geography_score: Mapped[int] = mapped_column(Integer)
    brief: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(64))
    scored_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    job: Mapped[Job] = relationship(back_populates="history")


class UserSetting(Base):
    """Key/value store for runtime-mutable configuration."""

    __tablename__ = "user_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
