# GetJob — Daily Career Scanner

Static dashboard + scheduled scraper. **No backend server.** Every day at 10:00 (Asia/Jerusalem) a GitHub Action scrapes Workday / Greenhouse / Lever boards, scores each role against your CV with an LLM, emails the digest, and commits the fresh `data.json` back to the repo — Vercel auto-rebuilds.

## Architecture

```
┌──────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│ GitHub Actions   │     │ Pipeline (Python)    │     │ Vercel (static)  │
│ cron: 10:00 IL   ├────▶│ • sync portals       │     │ • reads data.json│
│                  │     │ • scrape (Playwright)│     │ • localStorage   │
│                  │     │ • score (Claude)     │     │   for star/dismiss│
│                  │     │ • email (Resend)     │     │                  │
│                  │     │ • export data.json   │     │                  │
└──────────────────┘     └──────────┬───────────┘     └─────────▲────────┘
                                    │                            │
                                    ▼                            │
                          ┌──────────────────────┐               │
                          │ git commit + push    │───────────────┘
                          │ frontend/public/     │   (auto-rebuild on push)
                          │ data.json            │
                          └──────────────────────┘
```

## Setup (one time)

1. **Configure portals**: edit [`config/portals.json`](config/portals.json) — list of ATS boards to scan.
2. **Update CV**: edit [`backend/app/cv_data.py`](backend/app/cv_data.py) — used by the LLM scorer.
3. **Set GitHub secrets** at https://github.com/JackAmichai/GetJob/settings/secrets/actions:
   - `ANTHROPIC_API_KEY` — for scoring
   - `RESEND_API_KEY` — for email digest ([resend.com](https://resend.com), free tier)
4. **Set GitHub variables** (optional) at the same page → "Variables" tab:
   - `DEFAULT_LOCATION` (default: `Israel`)
   - `DEFAULT_EMAIL` (default: `jackamichai@gmail.com`)
   - `RELEVANCE_THRESHOLD` (default: `75`)
5. **Connect Vercel to GitHub** (if not already): https://vercel.com/jackamichais-projects/frontend/settings/git — connect to `JackAmichai/GetJob` → root directory `frontend`. After this, every commit (including the daily `chore: refresh dashboard data`) triggers a redeploy.
6. **Trigger the first scan**: https://github.com/JackAmichai/GetJob/actions/workflows/daily-scan.yml → "Run workflow" → main.

## Daily flow

- 10:00 cron fires (`.github/workflows/daily-scan.yml`)
- `python -m app.scheduler --once` runs:
  - `sync_portals_from_file()` — reads `config/portals.json` into SQLite
  - `run_scraper()` — Playwright scrapes every active portal with stealth + retries
  - `run_analyzer()` — Claude scores each new job (tech/experience/geography)
  - `send_digest()` — Resend emails roles scoring ≥ threshold
  - `export_to_json()` — dumps everything to `frontend/public/data.json`
- Action commits the JSON back; Vercel auto-rebuilds; dashboard shows fresh data.

## Local development

```bash
# Backend (one-off scan into local SQLite + data.json)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
cp .env.example .env  # fill ANTHROPIC_API_KEY + RESEND_API_KEY
python -m app.scheduler --once

# Frontend (reads ../frontend/public/data.json directly)
cd ../frontend
npm install
npm run dev   # http://localhost:5173
```

CLI flags on `app.scheduler`:
- `--once` full pipeline
- `--scrape-only` just scrape
- `--analyze-only` just LLM scoring
- `--notify-only` re-send digest
- `--export-only` re-dump current DB to `data.json`

## File layout

```
GetJob/
├── config/portals.json                   # source of truth for ATS boards
├── backend/app/
│   ├── ats_handlers/                     # workday, greenhouse, lever, generic
│   ├── scraper.py    analyzer.py    sync.py   exporter.py
│   ├── notifier.py   scheduler.py   cv_data.py
│   ├── config.py     database.py    models.py
│   └── requirements.txt
├── frontend/                             # static React/Vite dashboard
│   ├── public/data.json                  # ← regenerated daily by cron
│   └── src/...
└── .github/workflows/daily-scan.yml      # the only "server"
```
