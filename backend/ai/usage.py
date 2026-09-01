import os
from datetime import date

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from .models import AIProjectUsage, AIUsage

# ── Per-user daily FLOX allowance ────────────────────────────
DAILY_FREE_LIMIT = int(os.getenv("FLOX_DAILY_LIMIT", "5"))
DAILY_AD_CAP = int(os.getenv("FLOX_AD_DAILY_CAP", "5"))
AD_REWARD = int(os.getenv("FLOX_AD_REWARD", "3"))

# ── Project-level Gemini quota ───────────────────────────────
PROJECT_RPD = int(os.getenv("FLOX_PROJECT_RPD", "500"))
PROJECT_TPD = int(os.getenv("FLOX_PROJECT_TPD", "250000"))
PROJECT_RPM = int(os.getenv("FLOX_PROJECT_RPM", "15"))


def today_for(user):
    """Server-local date that backs the per-user daily allowance."""
    return timezone.localdate()


def effective_project_limit(row, field, env_default):
    """DB override wins over env; null/0 falls back to the env default."""
    value = getattr(row, field, None)
    return value if value else env_default


# ── Per-user allowance ───────────────────────────────────────

def allowance(user, ref_date=None):
    """Return the current per-user allowance snapshot for a user."""
    if ref_date is None:
        ref_date = today_for(user)
    usage = AIUsage.usage_for(user, ref_date)
    free_remaining = max(0, DAILY_FREE_LIMIT - usage.free_used)
    # Only ad credits that were actually earned (via watching an ad) count.
    ad_remaining = usage.ad_remaining
    available = free_remaining + ad_remaining
    return {
        "free_limit": DAILY_FREE_LIMIT,
        "ad_cap": DAILY_AD_CAP,
        "ad_reward": AD_REWARD,
        "used": usage.total_used,
        "free_used": usage.free_used,
        "ad_used": usage.ad_used,
        "ad_earned": usage.ad_earned,
        "remaining": available,
        "free_remaining": free_remaining,
        "ad_remaining": ad_remaining,
        "reset": ref_date.isoformat(),
        "watch_ad_gives": AD_REWARD if usage.ad_earned < DAILY_AD_CAP else 0,
        "blocked": available <= 0,
    }


def limited(user, ref_date=None):
    """True if the user has exhausted today's personal allowance."""
    data = allowance(user, ref_date)
    return data["blocked"], data


# ── Project quota preflight/reserve ──────────────────────────

def project_status(ref_date=None):
    """Return the project-level quota snapshot with warning level.

    warning: 'ok' | 'approaching' (>=80%) | 'critical' (>=95%) | 'exhausted' (>=100%)
    """
    if ref_date is None:
        ref_date = timezone.localdate()
    row = AIProjectUsage.row_for(ref_date)
    req_limit = effective_project_limit(row, "requests_limit", PROJECT_RPD)
    tok_limit = effective_project_limit(row, "tokens_limit", PROJECT_TPD)
    requests_used = row.requests_used
    tokens_used = row.tokens_used
    req_pct = (requests_used / req_limit * 100) if req_limit else 0
    tok_pct = (tokens_used / tok_limit * 100) if tok_limit else 0
    pct = max(req_pct, tok_pct)
    if pct >= 100 or requests_used >= req_limit or tokens_used >= tok_limit:
        warning = "exhausted"
    elif pct >= 95:
        warning = "critical"
    elif pct >= 80:
        warning = "approaching"
    else:
        warning = "ok"
    return {
        "requests_used": requests_used,
        "requests_limit": req_limit,
        "tokens_used": tokens_used,
        "tokens_limit": tok_limit,
        "requests_pct": round(requests_used / req_limit * 100, 1) if req_limit else 0,
        "tokens_pct": round(tokens_used / tok_limit * 100, 1) if tok_limit else 0,
        "combined_pct": round(pct, 1),
        "warning": warning,
        "date": ref_date.isoformat(),
    }


def project_available(ref_date=None):
    """Can we still make one more Gemini request against the project quota?"""
    status = project_status(ref_date)
    return status["warning"] != "exhausted", status


def reserve_project(ref_date=None, *, tokens=0):
    """Atomically record a Gemini request against the project budget."""
    if ref_date is None:
        ref_date = timezone.localdate()
    return AIProjectUsage.reserve(ref_date, requests=1, tokens=tokens)


# ── Preflight + settlement (shared by the AI views) ───────────

def settle_success(user, ref_date=None, *, ad=False, tokens=0):
    """Charge a user credit and record project usage for a successful reply.

    Defaults to consuming a free credit; pass ad=True to consume an ad-earned
    credit instead.
    """
    if ref_date is None:
        ref_date = timezone.localdate()
    usage = AIUsage.usage_for(user, ref_date)
    use_ad = ad or (usage.free_used >= DAILY_FREE_LIMIT and usage.ad_remaining > 0)
    AIUsage.consume(user, ref_date, ad=use_ad, tokens=tokens)
    reserve_project(ref_date, tokens=tokens)
    return allowance(user, ref_date)


def daily_limit_response(user, ref_date=None):
    """DRF Response for a user hitting their daily FLOX allowance."""
    allowance_data = allowance(user, ref_date)
    return Response(
        {
            "error": "DAILY_LIMIT",
            "message": "You've reached your daily FLOX limit.",
            "details": allowance_data,
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def quota_unavailable_response(ref_date=None):
    """DRF Response when the shared project Gemini quota is exhausted.

    Never leaks raw Gemini errors; the frontend shows a friendly notice and
    disables FLOX for a short period. No user credit is charged.
    """
    status_data = project_status(ref_date)
    return Response(
        {
            "error": "AI_QUOTA_EXCEEDED",
            "message": "FLOX is temporarily unavailable. Please try again later.",
            "details": status_data,
        },
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


def preflight_user(user):
    """Return (response_or_None, allowance). Shortcut for the views."""
    blocked, allowance_data = limited(user)
    if blocked:
        return daily_limit_response(user), allowance_data
    return None, allowance_data