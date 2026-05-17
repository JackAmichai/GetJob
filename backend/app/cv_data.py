"""User CV payload consumed by the semantic analyzer.

Edit this file to update the profile used by the scoring engine. The
structure is intentionally schema-validated so the analyzer prompt is
deterministic across runs.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class CVExperience(BaseModel):
    company: str
    role: str
    years: float
    highlights: list[str]


class CVData(BaseModel):
    full_name: str
    headline: str
    summary: str
    primary_languages: list[str]
    frameworks: list[str]
    infrastructure: list[str]
    databases: list[str]
    domains: list[str] = Field(default_factory=list)
    total_years_experience: float
    seniority: str  # e.g. "Senior", "Staff", "Principal"
    preferred_locations: list[str]
    open_to_remote: bool = True
    experience: list[CVExperience]


CV_DATA = CVData(
    full_name="Jack Amichai",
    headline="Senior Full-Stack & AI Systems Engineer",
    summary=(
        "Senior engineer specializing in distributed Python services, "
        "LLM-powered RAG/agent pipelines, and resilient browser automation. "
        "Track record building production AI infrastructure end-to-end: "
        "from semantic retrieval and prompt engineering to evaluation harnesses "
        "and observability."
    ),
    primary_languages=["Python", "TypeScript", "Go", "SQL"],
    frameworks=[
        "FastAPI", "React", "Next.js", "Playwright", "LangChain",
        "LangGraph", "Pydantic", "SQLAlchemy", "Tailwind CSS",
    ],
    infrastructure=[
        "Docker", "Kubernetes", "GitHub Actions", "AWS Lambda",
        "Vercel", "Cloudflare Workers", "Redis", "Kafka",
    ],
    databases=["PostgreSQL", "SQLite", "Redis", "Pinecone", "Weaviate", "Qdrant"],
    domains=[
        "LLM agents", "RAG pipelines", "web scraping",
        "anti-bot evasion", "developer tooling", "data engineering",
    ],
    total_years_experience=8.0,
    seniority="Senior",
    preferred_locations=["Israel", "Remote (EMEA)", "Tel Aviv"],
    open_to_remote=True,
    experience=[
        CVExperience(
            company="Confidential AI Startup",
            role="Senior AI Engineer",
            years=3.0,
            highlights=[
                "Designed multi-agent RAG pipeline serving 50k QPS",
                "Built Playwright-based ingestion crawler bypassing enterprise WAFs",
                "Owned eval harness measuring semantic groundedness + latency",
            ],
        ),
        CVExperience(
            company="Fintech Scale-up",
            role="Full-Stack Engineer",
            years=3.0,
            highlights=[
                "Migrated monolith to event-driven microservices on Kafka",
                "Led React/TypeScript dashboard rebuild used by 200+ ops users",
            ],
        ),
        CVExperience(
            company="Early-stage SaaS",
            role="Software Engineer",
            years=2.0,
            highlights=[
                "Shipped first production Postgres + FastAPI stack",
                "Implemented OAuth2/OIDC across services",
            ],
        ),
    ],
)
