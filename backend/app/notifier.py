"""Email delivery layer.

Prefers Resend (free tier, great deliverability); transparently falls
back to SMTP when RESEND_API_KEY is absent. Composes a single markdown
digest of all jobs scoring at or above `relevance_threshold` that have
not yet been notified, then marks them notified atomically.
"""
from __future__ import annotations

import logging
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Optional

import httpx
from sqlalchemy import select, update

from app.config import get_settings
from app.database import session_scope
from app.models import Job

logger = logging.getLogger(__name__)


class NotificationError(RuntimeError):
    pass


async def send_digest(recipient: Optional[str] = None) -> int:
    """Compile + send the daily digest. Returns number of jobs included."""
    settings = get_settings()
    recipient = recipient or settings.default_email

    async with session_scope() as session:
        stmt = (
            select(Job)
            .where(
                Job.relevance_score.is_not(None),
                Job.relevance_score >= settings.relevance_threshold,
                Job.notified.is_(False),
                Job.dismissed.is_(False),
            )
            .order_by(Job.relevance_score.desc(), Job.scraped_at.desc())
        )
        jobs = list((await session.execute(stmt)).scalars().all())
        if not jobs:
            logger.info("No jobs above threshold %d — skipping digest", settings.relevance_threshold)
            return 0

        markdown = _render_markdown(jobs, settings.relevance_threshold)
        html = _render_html(jobs, settings.relevance_threshold)
        subject = f"[GetJob] {len(jobs)} new role{'s' if len(jobs) != 1 else ''} above {settings.relevance_threshold}%"

        try:
            await _dispatch(subject, markdown, html, recipient)
        except NotificationError as exc:
            logger.exception("Notification dispatch failed: %s", exc)
            raise

        ids = [j.id for j in jobs]
        await session.execute(
            update(Job).where(Job.id.in_(ids)).values(notified=True)
        )
        return len(jobs)


# ----------------------------------------------------------------- dispatchers


async def _dispatch(subject: str, markdown: str, html: str, recipient: str) -> None:
    settings = get_settings()
    if settings.resend_api_key:
        await _send_resend(subject, markdown, html, recipient, settings.resend_api_key)
        return
    if settings.smtp_host:
        _send_smtp(subject, markdown, html, recipient)
        return
    raise NotificationError(
        "No notification backend configured: set RESEND_API_KEY or SMTP_HOST"
    )


async def _send_resend(
    subject: str, markdown: str, html: str, recipient: str, api_key: str
) -> None:
    payload = {
        "from": "GetJob <onboarding@resend.dev>",
        "to": [recipient],
        "subject": subject,
        "html": html,
        "text": markdown,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if resp.status_code >= 300:
        raise NotificationError(f"Resend returned {resp.status_code}: {resp.text}")


def _send_smtp(subject: str, markdown: str, html: str, recipient: str) -> None:
    settings = get_settings()
    msg = EmailMessage()
    msg["From"] = settings.smtp_user or recipient
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.set_content(markdown)
    msg.add_alternative(html, subtype="html")

    ctx = ssl.create_default_context()
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.starttls(context=ctx)
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        raise NotificationError(f"SMTP send failed: {exc}") from exc


# ----------------------------------------------------------------- renderers


def _color_band(score: int) -> str:
    if score >= 85:
        return "🟢"
    if score >= 75:
        return "🟡"
    return "🟠"


def _render_markdown(jobs: list[Job], threshold: int) -> str:
    today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
    lines = [
        f"# GetJob Daily Digest — {today}",
        "",
        f"**{len(jobs)} role(s) scored ≥ {threshold}%.**",
        "",
    ]
    for j in jobs:
        lines += [
            f"## {_color_band(j.relevance_score or 0)} {j.relevance_score}% — {j.title}",
            f"**{j.company}** · {j.location or 'Location unspecified'}",
            f"[Open posting]({j.url})",
            "",
            (j.brief or "_No brief available._"),
            "",
            f"_Sub-scores: tech {j.tech_score} · experience {j.experience_score} · geography {j.geography_score}_",
            "",
            "---",
            "",
        ]
    return "\n".join(lines)


def _render_html(jobs: list[Job], threshold: int) -> str:
    today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
    rows = []
    for j in jobs:
        score = j.relevance_score or 0
        color = "#16a34a" if score >= 85 else ("#ca8a04" if score >= 75 else "#ea580c")
        brief_html = "<br>".join(
            f"• {line.lstrip('- ').strip()}"
            for line in (j.brief or "").splitlines()
            if line.strip()
        ) or "<em>No brief available.</em>"
        rows.append(f"""
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:14px 12px;vertical-align:top;">
            <div style="font-size:20px;font-weight:700;color:{color};">{score}%</div>
            <div style="font-size:11px;color:#6b7280;">T:{j.tech_score} · X:{j.experience_score} · G:{j.geography_score}</div>
          </td>
          <td style="padding:14px 12px;vertical-align:top;">
            <div style="font-size:15px;font-weight:600;color:#111827;">{_html_escape(j.title)}</div>
            <div style="font-size:13px;color:#374151;">{_html_escape(j.company)} · {_html_escape(j.location or 'Unspecified')}</div>
            <div style="margin-top:8px;font-size:13px;color:#1f2937;line-height:1.5;">{brief_html}</div>
            <a href="{j.url}" style="display:inline-block;margin-top:10px;padding:6px 12px;background:#111827;color:#fff;text-decoration:none;border-radius:6px;font-size:12px;">Open posting →</a>
          </td>
        </tr>
        """)

    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:720px;margin:0 auto;padding:24px;background:#f9fafb;">
      <h1 style="font-size:22px;color:#111827;margin:0 0 6px;">GetJob Daily Digest</h1>
      <div style="color:#6b7280;font-size:13px;margin-bottom:20px;">{today} · {len(jobs)} role(s) ≥ {threshold}%</div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.05);">
        {''.join(rows)}
      </table>
      <div style="margin-top:24px;font-size:11px;color:#9ca3af;text-align:center;">
        Sent by GetJob · adjust threshold in dashboard
      </div>
    </div>
    """


def _html_escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
