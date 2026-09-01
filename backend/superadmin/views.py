import csv
import time
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import connection
from django.db.models import (
    Avg,
    Count,
    Max,
    Q,
    Sum,
)
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ai.models import AIHistory
from accounts.models import Profile
from notes.models import Note
from productivity.focus_models import FocusSession
from productivity.models import ProductivityLog
from quiz.models import Quiz
from study.models import Exam, StudyTask, Subject

from .models import AuditLog
from .permissions import IsSuperAdmin
from .serializers import AdminUserListSerializer, AuditLogSerializer

User = get_user_model()

now = timezone.now
today = timezone.localdate


def _log_admin_action(admin_user, action, target_user=None, detail=None):
    AuditLog.objects.create(
        admin=admin_user,
        action=action,
        target_user=target_user,
        detail=detail or {},
    )


def _active_on_day(day):
    """Distinct users active on a given date."""
    return (
        User.objects.filter(
            Q(productivity_logs__date=day)
            | Q(focus_sessions__date=day)
            | Q(last_login__date=day)
        ).distinct()
    )


def _active_since(day):
    """Distinct users active on or after a given date."""
    return (
        User.objects.filter(
            Q(productivity_logs__date__gte=day)
            | Q(focus_sessions__date__gte=day)
            | Q(last_login__date__gte=day)
        ).distinct()
    )


def _compute_current_streak(user_id):
    """Current streak in days, counting consecutive days ending today or yesterday."""
    log_dates = list(
        ProductivityLog.objects.filter(user_id=user_id)
        .values_list("date", flat=True)
        .order_by("-date")
    )
    if not log_dates:
        return 0

    today_date = today()
    anchor = today_date
    # A streak still counts if the user studied yesterday but not yet today.
    if log_dates[0] == today_date - timedelta(days=1):
        anchor = today_date - timedelta(days=1)
    elif log_dates[0] != today_date:
        return 0

    streak = 0
    for log_date in log_dates:
        if log_date > anchor:
            continue
        if log_date == anchor:
            streak += 1
            anchor -= timedelta(days=1)
        else:
            break
    return streak


# ── Overview ────────────────────────────────────────────────────


class AdminOverviewView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        today_date = today()
        seven_days_ago = today_date - timedelta(days=7)
        thirty_days_ago = today_date - timedelta(days=30)
        week_start = today_date - timedelta(days=today_date.weekday())

        total_users = User.objects.count()

        active_today = _active_on_day(today_date).count()
        active_week = _active_since(seven_days_ago).count()
        active_month = _active_since(thirty_days_ago).count()

        studying_today = (
            User.objects.filter(focus_sessions__date=today_date).distinct().count()
        )

        new_today = User.objects.filter(date_joined__date=today_date).count()
        new_this_week = User.objects.filter(date_joined__date__gte=seven_days_ago).count()
        new_this_month = User.objects.filter(date_joined__date__gte=thirty_days_ago).count()

        # Weekly retention: active last week who are also active this week
        last_week_start = week_start - timedelta(days=7)
        last_week_active = set(
            _active_since(last_week_start)
            .filter(productivity_logs__date__lt=week_start)
            .values_list("id", flat=True)
        )
        last_week_active |= set(
            User.objects.filter(
                Q(focus_sessions__date__gte=last_week_start)
                & Q(focus_sessions__date__lt=week_start)
            ).values_list("id", flat=True)
        )
        this_week_active = set(
            _active_since(week_start).values_list("id", flat=True)
        )
        retained = len(last_week_active & this_week_active)
        retention_rate = round(retained / len(last_week_active) * 100, 1) if last_week_active else 0

        today_logs = ProductivityLog.objects.filter(date=today_date)
        total_study_minutes_today = today_logs.aggregate(s=Sum("minutes_studied"))["s"] or 0
        focus_today = FocusSession.objects.filter(date=today_date)
        total_focus_today = focus_today.count()
        completed_focus_today = focus_today.filter(completed=True).count()

        tasks_created_today = StudyTask.objects.filter(created_at__date=today_date).count()
        tasks_completed_today = StudyTask.objects.filter(
            status="done", updated_at__date=today_date
        ).count()
        overdue_tasks = StudyTask.objects.filter(
            due_date__lt=today_date, status__in=["todo", "doing"]
        ).count()

        quizzes_today = Quiz.objects.filter(created_at__date=today_date).count()
        ai_today = AIHistory.objects.filter(created_at__date=today_date).count()
        notes_today = Note.objects.filter(created_at__date=today_date).count()
        upcoming_exams = Exam.objects.filter(date__gte=today_date).count()

        # Most used features over the last 7 days
        feature_counts = [
            {"name": "Focus Sessions", "count": FocusSession.objects.filter(date__gte=seven_days_ago).count()},
            {"name": "Tasks", "count": StudyTask.objects.filter(created_at__date__gte=seven_days_ago).count()},
            {"name": "Quizzes", "count": Quiz.objects.filter(created_at__date__gte=seven_days_ago).count()},
            {"name": "AI Messages", "count": AIHistory.objects.filter(created_at__date__gte=seven_days_ago).count()},
            {"name": "Notes", "count": Note.objects.filter(created_at__date__gte=seven_days_ago).count()},
            {"name": "Subjects", "count": Subject.objects.filter(created_at__date__gte=seven_days_ago).count()},
            {"name": "Exams", "count": Exam.objects.filter(created_at__date__gte=seven_days_ago).count()},
        ]
        total_activity = sum(f["count"] for f in feature_counts) or 1
        for f in feature_counts:
            f["pct"] = round(f["count"] / total_activity * 100)
        feature_counts.sort(key=lambda x: x["count"], reverse=True)

        # User growth: last 30 days
        growth_data = [
            {
                "date": (today_date - timedelta(days=i)).isoformat(),
                "count": User.objects.filter(
                    date_joined__date=today_date - timedelta(days=i)
                ).count(),
            }
            for i in range(29, -1, -1)
        ]

        platform_activity = {
            "sessions": feature_counts[0]["count"] if feature_counts else 0,
            "quizzes": quizzes_today,
            "tasks": tasks_created_today,
            "ai_messages": ai_today,
            "notes": notes_today,
        }

        return Response({
            "total_users": total_users,
            "active_today": active_today,
            "studying_today": studying_today,
            "retention_rate": retention_rate,
            "new_today": new_today,
            "new_this_week": new_this_week,
            "new_this_month": new_this_month,
            "active_week": active_week,
            "active_month": active_month,
            "total_study_minutes_today": total_study_minutes_today,
            "focus_sessions_today": total_focus_today,
            "completed_focus_today": completed_focus_today,
            "tasks_created_today": tasks_created_today,
            "tasks_completed_today": tasks_completed_today,
            "overdue_tasks": overdue_tasks,
            "quizzes_today": quizzes_today,
            "ai_today": ai_today,
            "notes_today": notes_today,
            "upcoming_exams": upcoming_exams,
            "most_used_features": feature_counts,
            "platform_activity": platform_activity,
            "user_growth": growth_data,
            "funnel": {
                "registered": total_users,
                "active_this_month": active_month,
                "studied_this_week": active_week,
                "studied_today": studying_today,
                "retention_rate": retention_rate,
            },
        })


# ── Users ───────────────────────────────────────────────────────


class AdminUsersView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = User.objects.all()
        search = request.query_params.get("search", "").strip()
        status_filter = request.query_params.get("status", "")
        sort = request.query_params.get("sort", "-date_joined")
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = min(int(request.query_params.get("page_size", 20)), 100)

        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
            )

        if status_filter == "active":
            qs = qs.filter(is_active=True, last_login__gte=now() - timedelta(days=7))
        elif status_filter == "suspended":
            qs = qs.filter(is_active=False)
        elif status_filter == "staff":
            qs = qs.filter(is_staff=True)
        elif status_filter == "superuser":
            qs = qs.filter(is_superuser=True)

        total = qs.count()

        allowed_sorts = {
            "date_joined": "date_joined",
            "-date_joined": "-date_joined",
            "last_login": "last_login",
            "-last_login": "-last_login",
            "username": "username",
            "-username": "-username",
        }
        qs = qs.order_by(allowed_sorts.get(sort, "-date_joined"))

        start = (page - 1) * page_size
        users = list(qs[start : start + page_size])

        # Activity counts and last active (most recent focus session or login)
        if users:
            user_ids = [u.id for u in users]
            count_annotations = {
                "subject_count": (Subject.objects.filter(user_id__in=user_ids)
                                  .values("user_id").annotate(c=Count("id"))),
                "task_count": (StudyTask.objects.filter(user_id__in=user_ids)
                               .values("user_id").annotate(c=Count("id"))),
                "quiz_count": (Quiz.objects.filter(user_id__in=user_ids)
                               .values("user_id").annotate(c=Count("id"))),
                "note_count": (Note.objects.filter(user_id__in=user_ids)
                               .values("user_id").annotate(c=Count("id"))),
                "focus_count": (FocusSession.objects.filter(user_id__in=user_ids)
                                .values("user_id").annotate(c=Count("id"))),
            }
            count_maps = {
                key: {r["user_id"]: r["c"] for r in rows}
                for key, rows in count_annotations.items()
            }
            last_focus_map = dict(
                FocusSession.objects.filter(user_id__in=user_ids)
                .values("user_id")
                .annotate(latest=Max("created_at"))
                .values_list("user_id", "latest")
            )
            for u in users:
                u._subject_count = count_maps["subject_count"].get(u.id, 0)
                u._task_count = count_maps["task_count"].get(u.id, 0)
                u._quiz_count = count_maps["quiz_count"].get(u.id, 0)
                u._note_count = count_maps["note_count"].get(u.id, 0)
                u._focus_session_count = count_maps["focus_count"].get(u.id, 0)
                u._last_active = last_focus_map.get(u.id) or u.last_login

        serializer = AdminUserListSerializer(users, many=True)
        return Response({
            "total": total,
            "page": page,
            "page_size": page_size,
            "results": serializer.data,
        })

    def post(self, request):
        user_id = request.data.get("user_id")
        action = request.data.get("action")
        if not user_id or action not in ("suspend", "unsuspend"):
            return Response(
                {"detail": "user_id and action (suspend/unsuspend) required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            target = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if target.is_superuser:
            return Response(
                {"detail": "Cannot suspend a superadmin."},
                status=status.HTTP_403_FORBIDDEN,
            )

        target.is_active = action == "unsuspend"
        target.save(update_fields=["is_active"])
        _log_admin_action(
            request.user,
            "suspended_user" if action == "suspend" else "unsuspended_user",
            target,
        )
        return Response({"ok": True, "is_active": target.is_active})


class AdminUserDetailView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request, user_id):
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        profile = Profile.objects.filter(user=user).first()
        today_date = today()
        last_7 = today_date - timedelta(days=7)
        last_30 = today_date - timedelta(days=30)

        focus_sessions = FocusSession.objects.filter(user=user)
        productivity_logs = ProductivityLog.objects.filter(user=user)
        last_focus = focus_sessions.order_by("-created_at").first()

        data = {
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.first_name,
                "date_joined": user.date_joined,
                "last_active": (last_focus.created_at if last_focus else user.last_login),
                "is_active": user.is_active,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
            },
            "profile": {
                "education_level": profile.education_level if profile else "",
                "college": profile.college if profile else "",
                "course": profile.course if profile else "",
                "semester": profile.semester if profile else None,
                "daily_study_goal": profile.daily_study_goal if profile else 4,
                "onboarding_completed": profile.onboarding_completed if profile else False,
            },
            "activity": {
                "current_streak": _compute_current_streak(user.id),
                "total_subjects": user.subjects.count(),
                "total_tasks": user.study_tasks.count(),
                "tasks_done": user.study_tasks.filter(status="done").count(),
                "total_quizzes": user.quizzes.count(),
                "total_notes": user.notes.count(),
                "focus_sessions": focus_sessions.count(),
                "focus_completed": focus_sessions.filter(completed=True).count(),
                "ai_history": user.ai_history.count(),
                "total_study_minutes": productivity_logs.aggregate(s=Sum("minutes_studied"))["s"] or 0,
                "study_days_30": productivity_logs.filter(
                    date__gte=last_30
                ).aggregate(s=Sum("minutes_studied"))["s"] or 0,
                "study_days_7": productivity_logs.filter(
                    date__gte=last_7
                ).aggregate(s=Sum("minutes_studied"))["s"] or 0,
            },
        }
        return Response(data)


# ── Engagement ──────────────────────────────────────────────────


class AdminEngagementView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        today_date = today()
        seven_days_ago = today_date - timedelta(days=7)
        thirty_days_ago = today_date - timedelta(days=30)
        sixty_days_ago = today_date - timedelta(days=60)

        dau = _active_on_day(today_date).count()
        wau = _active_since(seven_days_ago).count()
        mau = _active_since(thirty_days_ago).count()
        total = User.objects.count()

        dau_trend = [
            {
                "date": (today_date - timedelta(days=i)).isoformat(),
                "dau": _active_on_day(today_date - timedelta(days=i)).count(),
            }
            for i in range(13, -1, -1)
        ]

        new_today = User.objects.filter(date_joined__date=today_date).count()
        returning_today = _active_on_day(today_date).exclude(
            date_joined__date=today_date
        ).count()

        activated = Profile.objects.filter(onboarding_completed=True).count()
        activation_rate = round(activated / total * 100, 1) if total else 0

        # Churn: active in the 30-60 day window, inactive in last 30 days
        was_active = set(
            User.objects.filter(
                Q(productivity_logs__date__gte=sixty_days_ago, productivity_logs__date__lt=thirty_days_ago)
                | Q(focus_sessions__date__gte=sixty_days_ago, focus_sessions__date__lt=thirty_days_ago)
            ).values_list("id", flat=True)
        )
        still_active = set(
            _active_since(thirty_days_ago).values_list("id", flat=True)
        )
        churned = len(was_active - still_active)
        churn_rate = round(churned / len(was_active) * 100, 1) if was_active else 0

        return Response({
            "dau": dau,
            "wau": wau,
            "mau": mau,
            "total_users": total,
            "dau_trend": dau_trend,
            "new_today": new_today,
            "returning_today": returning_today,
            "activation_rate": activation_rate,
            "churn_rate": churn_rate,
            "churned_users": churned,
        })


# ── Streaks ─────────────────────────────────────────────────────


class AdminStreaksView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        today_date = today()
        user_ids = (
            ProductivityLog.objects.values_list("user_id", flat=True).distinct()
        )

        streaks = []
        for user_id in user_ids:
            streaks.append(_compute_current_streak(user_id))

        if not streaks:
            return Response({
                "average_streak": 0,
                "active_streak_users": 0,
                "streak_7plus": 0,
                "streak_30plus": 0,
                "longest_streak": 0,
                "distribution": [{"range": r, "count": 0} for r in ["0", "1-3", "4-7", "8-30", "30+"]],
                "completed_30min_today": 0,
                "completed_30min_pct": 0,
                "total_users_with_logs": 0,
            })

        avg_streak = round(sum(streaks) / len(streaks), 1)
        active_streak_users = sum(1 for s in streaks if s > 0)
        streak_7plus = sum(1 for s in streaks if s >= 7)
        streak_30plus = sum(1 for s in streaks if s >= 30)

        buckets = {"0": 0, "1-3": 0, "4-7": 0, "8-30": 0, "30+": 0}
        for s in streaks:
            if s == 0:
                buckets["0"] += 1
            elif s <= 3:
                buckets["1-3"] += 1
            elif s <= 7:
                buckets["4-7"] += 1
            elif s <= 30:
                buckets["8-30"] += 1
            else:
                buckets["30+"] += 1
        distribution = [{"range": k, "count": v} for k, v in buckets.items()]

        completed_30 = ProductivityLog.objects.filter(
            date=today_date, minutes_studied__gte=30
        ).count()
        total_active_today = (
            ProductivityLog.objects.filter(date=today_date)
            .values("user_id").distinct().count()
        )
        completed_pct = round(completed_30 / total_active_today * 100, 1) if total_active_today else 0

        return Response({
            "average_streak": avg_streak,
            "active_streak_users": active_streak_users,
            "streak_7plus": streak_7plus,
            "streak_30plus": streak_30plus,
            "longest_streak": max(streaks),
            "distribution": distribution,
            "completed_30min_today": completed_30,
            "completed_30min_pct": completed_pct,
            "total_users_with_logs": len(streaks),
        })


# ── Study Activity ──────────────────────────────────────────────


class AdminStudyActivityView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        today_date = today()
        seven_days_ago = today_date - timedelta(days=7)

        total_today = ProductivityLog.objects.filter(
            date=today_date
        ).aggregate(s=Sum("minutes_studied"))["s"] or 0
        total_week = ProductivityLog.objects.filter(
            date__gte=seven_days_ago
        ).aggregate(s=Sum("minutes_studied"))["s"] or 0

        focus_today = FocusSession.objects.filter(date=today_date)
        focus_count = focus_today.count()
        focus_completed = focus_today.filter(completed=True).count()
        avg_session = focus_today.aggregate(a=Avg("duration_minutes"))["a"]
        avg_session = round(avg_session, 1) if avg_session else 0

        completed_30 = ProductivityLog.objects.filter(
            date=today_date, minutes_studied__gte=30
        ).count()
        total_active = (
            ProductivityLog.objects.filter(date=today_date)
            .values("user_id").distinct().count()
        )
        goal_pct = round(completed_30 / total_active * 100, 1) if total_active else 0

        popular_subjects = list(
            Subject.objects.values("name")
            .annotate(
                user_count=Count("user", distinct=True),
                session_count=Count("focus_sessions"),
            )
            .order_by("-user_count", "-session_count")[:10]
        )

        daily_study = [
            {
                "date": (today_date - timedelta(days=i)).isoformat(),
                "minutes": ProductivityLog.objects.filter(
                    date=today_date - timedelta(days=i)
                ).aggregate(s=Sum("minutes_studied"))["s"] or 0,
            }
            for i in range(6, -1, -1)
        ]

        return Response({
            "total_study_minutes_today": total_today,
            "total_study_minutes_week": total_week,
            "focus_sessions_today": focus_count,
            "completed_sessions_today": focus_completed,
            "average_session_minutes": avg_session,
            "completed_30min_goal": completed_30,
            "goal_completion_pct": goal_pct,
            "popular_subjects": popular_subjects,
            "daily_study": daily_study,
        })


# ── Quizzes ─────────────────────────────────────────────────────


class AdminQuizzesView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        today_date = today()
        seven_days_ago = today_date - timedelta(days=7)

        created_today = Quiz.objects.filter(created_at__date=today_date).count()
        created_week = Quiz.objects.filter(created_at__date__gte=seven_days_ago).count()

        scored = Quiz.objects.filter(score__isnull=False)
        avg_score = scored.aggregate(a=Avg("score"))["a"]
        avg_score = round(avg_score, 1) if avg_score else 0

        total_quizzes = Quiz.objects.count()
        ai_generated = Quiz.objects.count() - Quiz.objects.filter(questions=[]).count()
        ai_pct = round(ai_generated / total_quizzes * 100, 1) if total_quizzes else 0

        difficulty_stats = list(
            Quiz.objects.values("difficulty")
            .annotate(
                count=Count("id"),
                avg_score=Avg("score"),
                total_questions=Sum("total_questions"),
            )
        )

        top_topics = list(
            Quiz.objects.values("topic")
            .annotate(count=Count("id"))
            .order_by("-count")[:10]
        )

        quiz_daily = [
            {
                "date": (today_date - timedelta(days=i)).isoformat(),
                "count": Quiz.objects.filter(
                    created_at__date=today_date - timedelta(days=i)
                ).count(),
            }
            for i in range(6, -1, -1)
        ]

        return Response({
            "created_today": created_today,
            "created_this_week": created_week,
            "total_quizzes": total_quizzes,
            "average_score": avg_score,
            "ai_generated_pct": ai_pct,
            "ai_generated_count": ai_generated,
            "difficulty_stats": difficulty_stats,
            "top_topics": top_topics,
            "quiz_daily": quiz_daily,
        })


# ── Exams ───────────────────────────────────────────────────────


class AdminExamsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        today_date = today()
        seven_days_ago = today_date - timedelta(days=7)

        upcoming = Exam.objects.filter(date__gte=today_date).count()
        added_week = Exam.objects.filter(created_at__date__gte=seven_days_ago).count()
        total_exams = Exam.objects.count()

        upcoming_by_subject = list(
            Exam.objects.filter(
                date__gte=today_date,
                date__lte=today_date + timedelta(days=7),
            )
            .values("subject__name")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        for e in upcoming_by_subject:
            e["subject"] = e.pop("subject__name")

        priority_breakdown = list(
            Exam.objects.values("priority").annotate(count=Count("id"))
        )

        exams_per_user = Exam.objects.values("user_id").annotate(count=Count("id"))
        avg_exams = round(sum(e["count"] for e in exams_per_user) / len(exams_per_user), 1) if exams_per_user else 0

        return Response({
            "upcoming": upcoming,
            "added_this_week": added_week,
            "total_exams": total_exams,
            "upcoming_by_subject": upcoming_by_subject,
            "priority_breakdown": priority_breakdown,
            "average_exams_per_user": avg_exams,
        })


# ── Notes ───────────────────────────────────────────────────────


class AdminNotesView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        today_date = today()
        seven_days_ago = today_date - timedelta(days=7)

        created_today = Note.objects.filter(created_at__date=today_date).count()
        created_week = Note.objects.filter(created_at__date__gte=seven_days_ago).count()
        active_users = (
            Note.objects.filter(created_at__date__gte=seven_days_ago)
            .values("user").distinct().count()
        )
        total_notes = Note.objects.count()

        avg_per_user = round(total_notes / active_users, 1) if active_users else 0

        daily = [
            {
                "date": (today_date - timedelta(days=i)).isoformat(),
                "count": Note.objects.filter(
                    created_at__date=today_date - timedelta(days=i)
                ).count(),
            }
            for i in range(6, -1, -1)
        ]

        return Response({
            "created_today": created_today,
            "created_this_week": created_week,
            "active_note_users": active_users,
            "total_notes": total_notes,
            "average_per_user": avg_per_user,
            "daily_trend": daily,
        })


# ── Tasks ───────────────────────────────────────────────────────


class AdminTasksView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        today_date = today()

        created_today = StudyTask.objects.filter(created_at__date=today_date).count()
        completed_today = StudyTask.objects.filter(
            status="done", updated_at__date=today_date
        ).count()
        total_tasks = StudyTask.objects.count()
        overdue = StudyTask.objects.filter(
            due_date__lt=today_date, status__in=["todo", "doing"]
        ).count()
        completion_rate = round(completed_today / created_today * 100, 1) if created_today else 0

        by_status = list(
            StudyTask.objects.values("status").annotate(count=Count("id"))
        )
        by_priority = list(
            StudyTask.objects.values("priority").annotate(count=Count("id"))
        )

        daily = [
            {
                "date": (today_date - timedelta(days=i)).isoformat(),
                "created": StudyTask.objects.filter(
                    created_at__date=today_date - timedelta(days=i)
                ).count(),
                "completed": StudyTask.objects.filter(
                    status="done",
                    updated_at__date=today_date - timedelta(days=i),
                ).count(),
            }
            for i in range(6, -1, -1)
        ]

        return Response({
            "created_today": created_today,
            "completed_today": completed_today,
            "total_tasks": total_tasks,
            "overdue": overdue,
            "completion_rate": completion_rate,
            "by_status": list(by_status),
            "by_priority": list(by_priority),
            "daily_trend": daily,
        })


# ── AI / FLOX ──────────────────────────────────────────────────


class AdminAIView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        today_date = today()
        seven_days_ago = today_date - timedelta(days=7)

        conversations_today = AIHistory.objects.filter(
            created_at__date=today_date
        ).count()
        active_ai_users = (
            AIHistory.objects.filter(created_at__date=today_date)
            .values("user").distinct().count()
        )
        total_ai = AIHistory.objects.count()
        avg_msgs = round(conversations_today / active_ai_users, 1) if active_ai_users else 0

        feature_breakdown = list(
            AIHistory.objects.values("feature")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        total_features = sum(f["count"] for f in feature_breakdown) or 1
        for f in feature_breakdown:
            f["pct"] = round(f["count"] / total_features * 100, 1)

        provider_breakdown = list(
            AIHistory.objects.values("provider")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        daily = [
            {
                "date": (today_date - timedelta(days=i)).isoformat(),
                "count": AIHistory.objects.filter(
                    created_at__date=today_date - timedelta(days=i)
                ).count(),
            }
            for i in range(6, -1, -1)
        ]

        return Response({
            "conversations_today": conversations_today,
            "active_ai_users": active_ai_users,
            "total_conversations": total_ai,
            "average_messages_per_user": avg_msgs,
            "feature_breakdown": feature_breakdown,
            "provider_breakdown": provider_breakdown,
            "daily_usage": daily,
        })


# ── Devices ─────────────────────────────────────────────────────


class AdminDeviceView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        sessions = FocusSession.objects.all().count()
        return Response({
            "platform": {
                "mobile": 0,
                "desktop": 0,
                "tablet": 0,
            },
            "browser": {
                "Chrome": 0,
                "Safari": 0,
                "Edge": 0,
                "Other": 0,
            },
            "total_sessions": sessions,
            "note": "Device analytics require user-agent tracking middleware.",
        })


# ── System Health ───────────────────────────────────────────────


class AdminHealthView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        now_ts = time.time()

        # Database
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            health = {
                "database": {"status": "healthy", "response_ms": round((time.time() - now_ts) * 1000, 1)}
            }
        except Exception as exc:
            health = {"database": {"status": "critical", "error": str(exc)}}

        health["api"] = {"status": "healthy", "response_ms": round((time.time() - now_ts) * 1000, 1)}

        try:
            User.objects.exists()
            health["authentication"] = {"status": "healthy"}
        except Exception as exc:
            health["authentication"] = {"status": "critical", "error": str(exc)}

        try:
            provider_name = getattr(
                __import__("ai.providers", fromlist=["get_provider"]), "get_provider", lambda: "mock"
            )()
            health["ai_service"] = {"status": "healthy", "provider": str(provider_name)}
        except Exception:
            health["ai_service"] = {"status": "warning", "provider": "mock"}

        health["notifications"] = {"status": "healthy"}

        statuses = [v.get("status") for v in health.values()]
        if "critical" in statuses:
            overall = "critical"
        elif "warning" in statuses:
            overall = "warning"
        else:
            overall = "healthy"

        return Response({
            "overall": overall,
            "services": health,
            "counts": {
                "users": User.objects.count(),
                "subjects": Subject.objects.count(),
                "tasks": StudyTask.objects.count(),
                "quizzes": Quiz.objects.count(),
                "notes": Note.objects.count(),
                "focus_sessions": FocusSession.objects.count(),
                "ai_conversations": AIHistory.objects.count(),
                "exams": Exam.objects.count(),
            },
        })


# ── Audit Logs ──────────────────────────────────────────────────


class AdminAuditLogView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = AuditLog.objects.select_related("admin", "target_user")
        page = max(int(request.query_params.get("page", 1)), 1)
        page_size = min(int(request.query_params.get("page_size", 50)), 100)
        total = qs.count()
        start = (page - 1) * page_size
        logs = qs[start : start + page_size]
        return Response({
            "total": total,
            "page": page,
            "page_size": page_size,
            "results": AuditLogSerializer(logs, many=True).data,
        })

    def post(self, request):
        action = (request.data.get("action") or "").strip()
        target_id = request.data.get("target_user_id")
        detail = request.data.get("detail") or {}
        if not action:
            return Response({"detail": "action is required."}, status=status.HTTP_400_BAD_REQUEST)
        target_user = None
        if target_id:
            try:
                target_user = User.objects.get(pk=target_id)
            except User.DoesNotExist:
                return Response({"detail": "Target user not found."}, status=status.HTTP_404_NOT_FOUND)
        _log_admin_action(request.user, action, target_user, detail)
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


# ── Reports ─────────────────────────────────────────────────────


class AdminReportView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        report_type = request.query_params.get("type", "overview")
        days = min(int(request.query_params.get("days", 30)), 365)
        start_date = today() - timedelta(days=days)

        if report_type == "users":
            data = {
                "total": User.objects.count(),
                "new_users": User.objects.filter(date_joined__date__gte=start_date).count(),
                "active_users": User.objects.filter(
                    Q(last_login__date__gte=start_date)
                    | Q(productivity_logs__date__gte=start_date)
                ).distinct().count(),
            }
        elif report_type == "study":
            data = {
                "total_study_minutes": ProductivityLog.objects.filter(
                    date__gte=start_date
                ).aggregate(s=Sum("minutes_studied"))["s"] or 0,
                "total_focus_sessions": FocusSession.objects.filter(
                    created_at__date__gte=start_date
                ).count(),
                "completed_sessions": FocusSession.objects.filter(
                    created_at__date__gte=start_date, completed=True
                ).count(),
            }
        elif report_type == "quizzes":
            data = {
                "quizzes_created": Quiz.objects.filter(
                    created_at__date__gte=start_date
                ).count(),
                "average_score": Quiz.objects.filter(
                    created_at__date__gte=start_date, score__isnull=False
                ).aggregate(a=Avg("score"))["a"] or 0,
            }
        elif report_type == "ai":
            data = {
                "total_conversations": AIHistory.objects.filter(
                    created_at__date__gte=start_date
                ).count(),
                "active_users": AIHistory.objects.filter(
                    created_at__date__gte=start_date
                ).values("user").distinct().count(),
            }
        else:
            data = {
                "total_users": User.objects.count(),
                "total_subjects": Subject.objects.count(),
                "total_tasks": StudyTask.objects.count(),
                "total_quizzes": Quiz.objects.count(),
                "total_notes": Note.objects.count(),
                "total_focus_sessions": FocusSession.objects.count(),
                "total_ai": AIHistory.objects.count(),
            }

        _log_admin_action(request.user, "generated_report", detail={"type": report_type, "days": days})
        return Response({"type": report_type, "days": days, "data": data})


class AdminReportExportView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        report_type = request.query_params.get("type", "users")
        days = min(int(request.query_params.get("days", 30)), 365)
        start_date = today() - timedelta(days=days)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{report_type}_report.csv"'
        writer = csv.writer(response)

        if report_type == "study":
            writer.writerow(["Date", "User", "Minutes Studied", "Focus Score"])
            for log in ProductivityLog.objects.filter(
                date__gte=start_date
            ).select_related("user").order_by("-date")[:5000]:
                writer.writerow([log.date, log.user.username, log.minutes_studied, log.focus_score])
        elif report_type == "quizzes":
            writer.writerow(["ID", "Topic", "Difficulty", "Score", "Total Qs", "Created"])
            for q in Quiz.objects.filter(
                created_at__date__gte=start_date
            ).order_by("-created_at")[:5000]:
                writer.writerow([q.id, q.topic, q.difficulty, q.score, q.total_questions, q.created_at.isoformat()])
        elif report_type == "tasks":
            writer.writerow(["ID", "Title", "Status", "Priority", "Due Date", "Created"])
            for t in StudyTask.objects.all().order_by("-created_at")[:5000]:
                writer.writerow([
                    t.id, t.title, t.status, t.priority,
                    t.due_date.isoformat() if t.due_date else "",
                    t.created_at.isoformat(),
                ])
        else:
            writer.writerow(["ID", "Username", "Email", "Joined", "Last Login", "Active"])
            for u in User.objects.all().order_by("-date_joined")[:5000]:
                writer.writerow([
                    u.id, u.username, u.email,
                    u.date_joined.isoformat() if u.date_joined else "",
                    u.last_login.isoformat() if u.last_login else "",
                    u.is_active,
                ])

        _log_admin_action(request.user, "exported_report", detail={"type": report_type, "days": days})
        return response