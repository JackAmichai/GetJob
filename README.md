# GetJob — Self-Hosted Daily Career Scanner

Zero-cost pipeline that scrapes Workday / Greenhouse / Lever boards every morning, semantically scores each role against your CV, and emails you a digest of high-relevance matches.

## Quick start

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
cp .env.example .env  # then fill in ANTHROPIC_API_KEY + RESEND_API_KEY
uvicorn app.main:app --reload

# Frontend
cd ../frontend
npm install
npm run dev
```

## Running the pipeline manually
```bash
cd backend
python -m app.scheduler --once        # full pipeline
python -m app.scheduler --scrape-only # just scrape
python -m app.scheduler --analyze-only
python -m app.scheduler --notify-only
```

## Deployment (free tier)
- **Scheduler**: `.github/workflows/daily-scan.yml` runs `python -m app.scheduler --once` at ~10:00 Asia/Jerusalem.
- **API + dashboard**: deploy `backend/` to Render free tier and `frontend/` to Vercel.
- **DB**: SQLite by default; swap `DATABASE_URL` to a Supabase / Neon Postgres URL for hosted persistence.

## How it works
1. `scraper.py` loads every active `Portal`, dispatches an ATS-specific handler (Workday API capture, Greenhouse REST, Lever REST) with Playwright stealth, and upserts results.
2. `analyzer.py` scores every unanalyzed job against `CV_DATA` along three vectors (tech / experience / geography), validated by Pydantic.
3. `notifier.py` compiles every match ≥ `RELEVANCE_THRESHOLD` into a markdown + HTML digest and sends it via Resend (or SMTP fallback).
