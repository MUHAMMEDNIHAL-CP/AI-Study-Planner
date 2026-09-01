from datetime import date, timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone

from productivity.models import ProductivityLog

User = get_user_model()

# Milestones a user can unlock with consecutive study days.
STREAK_MILESTONES = (7, 30, 50, 100, 200, 365)


def _study_dates(user) -> list[date]:
    """Return all distinct calendar days where the user logged study activity.

    Any qualifying activity (adding a subject/exam/task/note, generating a quiz,
    an AI interaction, or a completed focus session) marks the day as a study day.
    """
    return list(
        ProductivityLog.objects.filter(user=user, minutes_studied__gt=0)
        .values_list("date", flat=True)
        .distinct()
        .order_by("date")
    )


def _consecutive_run(dates: list[date], *, starting: date) -> int:
    """Count consecutive days going backwards from `starting` given a sorted date list."""
    wanted = starting
    count = 0
    studied = set(dates)
    while wanted in studied:
        count += 1
        wanted -= timedelta(days=1)
    return count


def _longest_streak(dates: list[date]) -> int:
    """Scan sorted unique dates for the longest run of consecutive days (unlimited)."""
    if not dates:
        return 0

    longest = 1
    current = 1
    for previous, current_day in zip(dates, dates[1:]):
        if current_day - previous == timedelta(days=1):
            current += 1
            longest = max(longest, current)
        else:
            current = 1
    return longest


def _next_milestone(streak: int) -> dict[str, Any] | None:
    """Return the next streak milestone the user is closing in on."""
    for milestone in STREAK_MILESTONES:
        if streak < milestone:
            progress = round((streak / milestone) * 100)
            remaining = milestone - streak
            return {
                "target": milestone,
                "progress": progress,
                "remaining": remaining,
            }
    return None


def _heatmap(dates: set[date], *, days: int = 119) -> list[dict[str, Any]]:
    """Return the last `days` calendar cells (oldest → newest) for a GitHub-style heatmap.

    Each cell includes the ISO date, whether the user studied that day, and the day-of-week
    index (Monday=0) so the frontend can lay the cells out in vertical week columns.
    """
    today = timezone.localdate()
    start = today - timedelta(days=days - 1)
    return [
        {
            "date": day.isoformat(),
            "studied": day in dates,
            "dow": day.weekday(),
        }
        for day in (start + timedelta(days=index) for index in range(days))
    ]


def compute_streak_stats(user) -> dict[str, Any]:
    """Compute Duolingo-style streak statistics for a user.

    The current streak uses the standard Duolingo grace rule: if the user has not
    studied *today* yet, the streak is still considered alive as long as they
    studied yesterday.
    """
    dates = _study_dates(user)
    today = timezone.localdate()

    studied_today = today in dates
    # If the user already studied today, count back from today. Otherwise count
    # back from yesterday so an unfinished today does not kill the streak.
    anchor = today if studied_today else today - timedelta(days=1)
    current_streak = _consecutive_run(dates, starting=anchor) if dates else 0

    last_study_date = dates[-1] if dates else None

    return {
        "current_streak": current_streak,
        "longest_streak": _longest_streak(dates),
        "total_study_days": len(dates),
        "last_study_date": last_study_date.isoformat() if last_study_date else None,
        "studied_today": studied_today,
        "next_milestone": _next_milestone(current_streak),
        "heatmap": _heatmap(set(dates)),
        # Backwards-compatible key used by existing callers.
        "streak": current_streak,
    }


def study_day_counts(user, *, since: date) -> list[dict[str, Any]]:
    """Return per-day minutes studied since a given date (used by analytics)."""
    rows = (
        ProductivityLog.objects.filter(user=user, date__gte=since, minutes_studied__gt=0)
        .values("date")
        .annotate(total_minutes=Sum("minutes_studied"))
        .order_by("date")
    )
    return [
        {
            "date": row["date"].isoformat(),
            "minutes": row["total_minutes"],
        }
        for row in rows
    ]

