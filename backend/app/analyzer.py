"""Semantic scoring engine.

Scores each job along three orthogonal vectors:
  1. Technical Stack Match     (weight 0.45)
  2. Experience & Scope        (weight 0.35)
  3. Geographic Compliance     (weight 0.20)

The LLM is constrained to emit JSON conforming to `ScoringResult`. We
validate with Pydantic; on any validation/transport failure we record a
`SafeFallbackResult` so the pipeline never stalls and the UI surfaces
the error rather than silently dropping the job.

Supports both Anthropic Claude and OpenAI as drop-in backends.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, ValidationError, conint, conlist, field_validator
from sqlalchemy import select

from app.config import get_settings
from app.cv_data import CV_DATA, CVData
from app.database import session_scope
from app.models import HistoricalScore, Job

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------- schemas

ScoreInt = Annotated[int, Field(ge=0, le=100)]


class ScoringResult(BaseModel):
    """Strict JSON contract the LLM must satisfy."""

    relevance_score: ScoreInt
    tech_score: ScoreInt
    experience_score: ScoreInt
    geography_score: ScoreInt
    brief_points: conlist(str, min_length=2, max_length=6)  # type: ignore[valid-type]
    decision: Literal["strong_match", "match", "weak", "skip"]
    flags: list[str] = Field(default_factory=list)

    @field_validator("brief_points")
    @classmethod
    def _strip_bullets(cls, v: list[str]) -> list[str]:
        cleaned = [re.sub(r"^[\s\-*•]+", "", line).strip() for line in v if line.strip()]
        if len(cleaned) < 2:
            raise ValueError("brief_points needs at least two substantive entries")
        return cleaned

    def to_brief(self) -> str:
        return "\n".join(f"- {p}" for p in self.brief_points)


class SafeFallbackResult(BaseModel):
    """Emitted when LLM validation fails so we never persist null scores silently."""

    relevance_score: int = 0
    tech_score: int = 0
    experience_score: int = 0
    geography_score: int = 0
    brief_points: list[str] = Field(default_factory=lambda: [
        "Scoring failed: model output did not pass Pydantic validation.",
        "Job retained for manual review.",
    ])
    decision: str = "skip"
    flags: list[str] = Field(default_factory=lambda: ["fallback"])

    def to_brief(self) -> str:
        return "\n".join(f"- {p}" for p in self.brief_points)


# --------------------------------------------------------------------- prompt

SYSTEM_PROMPT = """You are a senior technical recruiter analyzing how well a candidate's CV matches a job posting.

You MUST respond with ONLY a single JSON object — no prose, no markdown fences,
no preface, no postscript. The JSON must match exactly this schema:

{
  "relevance_score":   integer 0-100,
  "tech_score":        integer 0-100,
  "experience_score":  integer 0-100,
  "geography_score":   integer 0-100,
  "brief_points":      array of 2-6 short strings (no bullet markers),
  "decision":          one of "strong_match" | "match" | "weak" | "skip",
  "flags":             array of strings (use [] when none)
}

Scoring rubric (apply rigorously, do not inflate):

1. tech_score — overlap between the candidate's languages/frameworks/infra/
   databases and what the role REQUIRES (not nice-to-haves). Penalize hard
   mismatches (e.g. CV is Python/AI, role is embedded C++).

2. experience_score — seniority and scope alignment. Reward roles whose
   ownership/architectural responsibility matches the candidate's level.
   Penalize roles that are too junior (waste) or too senior (stretch beyond
   plausible interview).

3. geography_score — hard filter on LOCATION_FILTER. Score 100 if the role
   is located in the filter zone OR explicitly remote-open to it. Score 0
   if the role explicitly excludes it (e.g. "US only", "must work from NYC
   office"). Score 50 if ambiguous/unspecified.

relevance_score is your weighted overall: 0.45*tech + 0.35*experience + 0.20*geography,
rounded to the nearest integer. Recompute, do not eyeball.

brief_points must be 2-6 concrete observations (e.g. "Strong Python+FastAPI
match", "Requires 10y of Kubernetes — candidate has 4y", "Role is Tel Aviv
hybrid — fits filter"). No fluff, no encouragement, no marketing language.

decision: strong_match (>=85) | match (75-84) | weak (50-74) | skip (<50).

flags: free-form short tags useful to the reviewer (e.g. "stale_posting",
"location_ambiguous", "stack_mismatch"). [] is valid.
"""


USER_TEMPLATE = """LOCATION_FILTER: {location_filter}

CANDIDATE_CV:
{cv_json}

JOB_POSTING:
Company: {company}
Title: {title}
Location: {location}
URL: {url}

DESCRIPTION:
{description}
"""


# --------------------------------------------------------------------- backend


class LLMBackend:
    async def complete(self, system: str, user: str) -> str:  # pragma: no cover
        raise NotImplementedError


class AnthropicBackend(LLMBackend):
    def __init__(self, api_key: str, model: str) -> None:
        from anthropic import AsyncAnthropic  # local import to keep optional

        self._client = AsyncAnthropic(api_key=api_key)
        self._model = model

    async def complete(self, system: str, user: str) -> str:
        resp = await self._client.messages.create(
            model=self._model,
            max_tokens=1_024,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        parts = [b.text for b in resp.content if getattr(b, "type", "") == "text"]
        return "".join(parts).strip()


class OpenAIBackend(LLMBackend):
    def __init__(self, api_key: str, model: str) -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model

    async def complete(self, system: str, user: str) -> str:
        resp = await self._client.chat.completions.create(
            model=self._model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=1_024,
        )
        return (resp.choices[0].message.content or "").strip()


def _make_backend() -> LLMBackend:
    settings = get_settings()
    if settings.llm_provider == "anthropic":
        if not settings.anthropic_api_key:
            raise RuntimeError("anthropic_api_key not set")
        return AnthropicBackend(settings.anthropic_api_key, settings.anthropic_model)
    if not settings.openai_api_key:
        raise RuntimeError("openai_api_key not set")
    return OpenAIBackend(settings.openai_api_key, settings.openai_model)


# --------------------------------------------------------------------- analyzer


_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json(text: str) -> Optional[dict]:
    """Forgive minor LLM output noise (stray prose, markdown fences)."""
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = _JSON_RE.search(text)
        if not m:
            return None
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            return None


class Analyzer:
    def __init__(self, cv: CVData = CV_DATA) -> None:
        self.cv = cv
        self.settings = get_settings()
        self._backend: Optional[LLMBackend] = None
        self._sem = asyncio.Semaphore(4)  # gentle rate limit

    def _get_backend(self) -> LLMBackend:
        if self._backend is None:
            self._backend = _make_backend()
        return self._backend

    async def score_job(self, job: Job, location_filter: str) -> ScoringResult | SafeFallbackResult:
        description = job.raw_text or f"{job.title}\n{job.location}"
        user = USER_TEMPLATE.format(
            location_filter=location_filter,
            cv_json=self.cv.model_dump_json(indent=2),
            company=job.company,
            title=job.title,
            location=job.location or "Unspecified",
            url=job.url,
            description=description[:10_000],
        )
        try:
            async with self._sem:
                raw = await self._get_backend().complete(SYSTEM_PROMPT, user)
        except Exception as exc:  # noqa: BLE001 — transport must never crash pipeline
            logger.exception("LLM call failed for job %s: %s", job.id, exc)
            return SafeFallbackResult(
                brief_points=[
                    f"LLM transport error: {type(exc).__name__}",
                    "Job retained for retry on next scan.",
                ],
                flags=["llm_error"],
            )

        payload = _extract_json(raw)
        if payload is None:
            logger.warning("Job %s: unable to extract JSON from model output", job.id)
            return SafeFallbackResult(
                brief_points=["Model returned non-JSON output.", "Manual review suggested."],
                flags=["parse_error"],
            )
        try:
            return ScoringResult.model_validate(payload)
        except ValidationError as exc:
            logger.warning("Job %s: validation failed: %s", job.id, exc.errors())
            return SafeFallbackResult(
                brief_points=[
                    "LLM output failed schema validation.",
                    f"First error: {exc.errors()[0].get('msg', 'unknown')[:140]}",
                ],
                flags=["validation_error"],
            )

    async def score_pending(self, limit: Optional[int] = None) -> int:
        """Score every job that has not yet been analyzed. Returns count."""
        settings = get_settings()
        location_filter = settings.default_location
        async with session_scope() as session:
            stmt = select(Job).where(Job.analyzed_at.is_(None))
            if limit:
                stmt = stmt.limit(limit)
            jobs = list((await session.execute(stmt)).scalars().all())

        if not jobs:
            return 0

        scored = 0
        for job in jobs:
            result = await self.score_job(job, location_filter)
            await self._persist(job.id, result)
            scored += 1
        return scored

    async def _persist(
        self, job_id: int, result: ScoringResult | SafeFallbackResult
    ) -> None:
        now = datetime.now(tz=timezone.utc)
        async with session_scope() as session:
            job = await session.get(Job, job_id)
            if job is None:
                return
            job.relevance_score = result.relevance_score
            job.tech_score = result.tech_score
            job.experience_score = result.experience_score
            job.geography_score = result.geography_score
            job.brief = result.to_brief()
            job.analyzed_at = now

            session.add(
                HistoricalScore(
                    job_id=job.id,
                    relevance_score=result.relevance_score,
                    tech_score=result.tech_score,
                    experience_score=result.experience_score,
                    geography_score=result.geography_score,
                    brief=job.brief,
                    model=(
                        get_settings().anthropic_model
                        if get_settings().llm_provider == "anthropic"
                        else get_settings().openai_model
                    ),
                    scored_at=now,
                )
            )


async def run_analyzer(limit: Optional[int] = None) -> int:
    return await Analyzer().score_pending(limit=limit)
