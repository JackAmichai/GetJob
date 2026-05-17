"""Centralized application configuration with dynamic override support.

Values originate from environment variables but are mirrored into the
UserSetting table at boot so they can be mutated at runtime from the
dashboard without a process restart.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import EmailStr, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Operational defaults (overridable from dashboard) ---
    default_location: str = Field(default="Israel", description="Geographic filter zone")
    default_email: EmailStr = Field(default="jackamichai@gmail.com")
    scan_cron: str = Field(default="0 10 * * *", description="10:00 daily")
    relevance_threshold: int = Field(default=75, ge=0, le=100)

    # --- LLM provider ---
    llm_provider: Literal["anthropic", "openai"] = "anthropic"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-7"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # --- Notification provider ---
    resend_api_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""

    # --- Storage ---
    database_url: str = f"sqlite+aiosqlite:///{DATA_DIR / 'jobs.db'}"

    # --- Scraper tuning ---
    scraper_concurrency: int = Field(default=3, ge=1, le=10)
    scraper_max_retries: int = Field(default=3, ge=1, le=8)
    scraper_request_timeout_ms: int = 25_000
    scraper_headless: bool = True

    @field_validator("scan_cron")
    @classmethod
    def _validate_cron(cls, value: str) -> str:
        if len(value.split()) != 5:
            raise ValueError("scan_cron must be a 5-field crontab expression")
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def reload_settings() -> Settings:
    get_settings.cache_clear()
    return get_settings()
