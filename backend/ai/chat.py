from datetime import timedelta

from django.db import models
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from productivity.focus_models import FocusSession
from productivity.models import ProductivityLog
from study.models import Exam, StudyTask, Subject
from study.streak import compute_streak_stats

from .gemini import QUOTA_EXHAUSTED, generate_json, sanitize_prompt
from .models import AIHistory
from .usage import (
    daily_limit_response,
    limited,
    project_available,
    quota_unavailable_response,
    settle_success,
)

PAGE_FALLBACKS = {
    "dashboard": "Welcome back! You have {open_tasks} tasks due. Ready to start a focus session?",
    "subjects": "You have {subject_count} subjects. Focus on your weakest ones first.",
    "planner": "Your next exam is in {days_to_exam} days. Let's plan your study blocks.",
    "tasks": "You have {open_tasks} open tasks. Start with the highest priority one.",
    "focus": "Ready for a focus session? Pick a task and start the timer.",
    "progress": "Your streak is {streak} days. Keep it going!",
    "notes": "Take notes on what you're learning. Active writing helps retention.",
}


class ChatBotView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai"

    def post(self, request):
        message = str(request.data.get("message") or "").strip()
        context = request.data.get("context") or {}
        page = str(context.get("page") or "default").strip()

        if not message:
            return Response(
                {"detail": "message is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        blocked, allowance_data = limited(request.user)
        if blocked:
            return daily_limit_response(request.user)

        available, _ = project_available()
        if not available:
            return quota_unavailable_response()

        ctx = self._gather_context(request.user)

        prompt = self._build_prompt(message, page, ctx)

        gemini_response, gemini_error, tokens = generate_json(
            prompt, timeout=20, return_error=True, return_usage=True
        )

        parsed = gemini_response if isinstance(gemini_response, dict) else None
        reply = parsed.get("reply") if parsed else None
        suggestions = parsed.get("suggestions") if parsed and isinstance(parsed.get("suggestions"), list) else None
        action = parsed.get("action") if parsed and isinstance(parsed.get("action"), dict) else None

        if not reply:
            reply = self._fallback_reply(page, ctx)

        if suggestions is None:
            suggestions = self._default_suggestions(page, ctx)

        result = {"reply": reply, "suggestions": suggestions, "action": action}

        history = AIHistory.objects.create(
            user=request.user,
            feature="tutor",
            prompt=message,
            response=result,
            provider="gemini" if parsed else "mock",
        )

        if parsed:
            settle_success(request.user, tokens=tokens)
        elif gemini_error == QUOTA_EXHAUSTED:
            # Project quota hit mid-flight — do NOT charge the user's credit.
            history.delete()
            return quota_unavailable_response()
        else:
            # Served a local fallback because Gemini failed for a non-quota
            # reason. Still counts as a served reply, so charge the credit.
            settle_success(request.user, tokens=0)

        return Response(result, status=status.HTTP_200_OK)

    def _gather_context(self, user):
        today = timezone.localdate()
        subjects = list(Subject.objects.filter(user=user).values(
            "name", "weak_topics", "topics_completed", "total_topics"
        ))

        open_tasks = list(
            StudyTask.objects.filter(user=user)
            .exclude(status="done")
            .select_related("subject")
            .order_by("due_date", "-priority")[:10]
            .values("title", "due_date", "priority", "subject__name")
        )

        upcoming_exams = list(
            Exam.objects.filter(user=user, date__gte=today)
            .select_related("subject")
            .order_by("date")[:5]
            .values("title", "date", "subject__name")
        )

        streak_stats = compute_streak_stats(user)
        today_log = ProductivityLog.objects.filter(user=user, date=today).first()
        total_tasks = StudyTask.objects.filter(user=user).count()
        completed_tasks = StudyTask.objects.filter(user=user, status="done").count()

        recent_sessions = list(
            FocusSession.objects.filter(user=user)
            .select_related("subject")
            .order_by("-created_at")[:5]
            .values("duration_minutes", "completed", "mood", "date", "subject__name")
        )

        return {
            "subjects": subjects,
            "open_tasks": open_tasks,
            "upcoming_exams": upcoming_exams,
            "streak": streak_stats.get("streak", 0),
            "today_minutes": today_log.minutes_studied if today_log else 0,
            "completion_rate": round((completed_tasks / total_tasks) * 100) if total_tasks else 0,
            "open_task_count": len(open_tasks),
            "recent_sessions": recent_sessions,
            "days_to_exam": (
                (upcoming_exams[0]["date"] - today).days
                if upcoming_exams else None
            ),
            "subject_count": len(subjects),
        }

    def _build_prompt(self, message, page, ctx):
        subjects_text = ""
        if ctx["subjects"]:
            parts = []
            for s in ctx["subjects"]:
                progress = f"{s['topics_completed']}/{s['total_topics']}" if s["total_topics"] else "N/A"
                weak = s.get("weak_topics", "") or ""
                part = f"  - {s['name']}: progress {progress}"
                if weak:
                    part += f", weak areas: {weak}"
                parts.append(part)
            subjects_text = "\n".join(parts)

        tasks_text = ""
        if ctx["open_tasks"]:
            parts = []
            for t in ctx["open_tasks"]:
                subject = t["subject__name"] or "General"
                due = t["due_date"] or "no due date"
                parts.append(f"  - {t['title']} ({subject}) due {due} [{t['priority']}]")
            tasks_text = "\n".join(parts)

        exams_text = ""
        if ctx["upcoming_exams"]:
            parts = []
            for e in ctx["upcoming_exams"]:
                subject = e["subject__name"] or "General"
                parts.append(f"  - {e['title']} ({subject}) on {e['date']}")
            exams_text = "\n".join(parts)

        sessions_text = ""
        if ctx["recent_sessions"]:
            parts = []
            for s in ctx["recent_sessions"]:
                status_label = "completed" if s["completed"] else "incomplete"
                subject = s["subject__name"] or "General"
                parts.append(f"  - {s['duration_minutes']}min {subject} ({status_label}) on {s['date']}")
            sessions_text = "\n".join(parts)

        return (
            "You are Flox AI, a friendly and concise study assistant.\n"
            "Rules:\n"
            "- Keep replies SHORT (2-3 sentences max).\n"
            "- Be context-aware: use the student's data to give relevant advice.\n"
            "- Suggest practical actions when appropriate.\n"
            "- Return STRICT JSON only, no markdown.\n\n"
            "JSON schema:\n"
            '{"reply": "your short message", "suggestions": ["short suggestion 1", "short suggestion 2", "short suggestion 3"], "action": {"label": "button text", "route": "frontend route"}}\n'
            '"action" can be null if no specific action applies.\n'
            "Routes: /dashboard, /subjects, /planner, /tasks, /focus, /progress, /notes\n\n"
            f"Current page: {page}\n\n"
            f"--- Student Data ---\n"
            f"Subjects:\n{subjects_text or '  None yet'}\n\n"
            f"Open tasks:\n{tasks_text or '  None'}\n\n"
            f"Upcoming exams:\n{exams_text or '  None scheduled'}\n\n"
            f"Streak: {ctx['streak']} days\n"
            f"Today's study time: {ctx['today_minutes']} minutes\n"
            f"Completion rate: {ctx['completion_rate']}%\n"
            f"Days to next exam: {ctx['days_to_exam'] if ctx['days_to_exam'] is not None else 'N/A'}\n\n"
            f"Recent focus sessions:\n{sessions_text or '  None yet'}\n\n"
            f"--- End Data ---\n\n"
            f"Student message: {message}\n\n"
            "Respond now with JSON."
        )

    def _fallback_reply(self, page, ctx):
        template = PAGE_FALLBACKS.get(page, PAGE_FALLBACKS["dashboard"])
        try:
            return template.format(**ctx)
        except KeyError:
            return "How can I help with your studies today?"

    def _default_suggestions(self, page, ctx):
        if page == "focus":
            return ["Start a 25-min session", "Review flashcards", "Take a break"]
        if page == "tasks":
            return ["Add a new task", "Sort by priority", "Focus on due-soon"]
        if page == "subjects":
            return ["Add a subject", "View weakest topics", "Set weekly goal"]
        if page == "planner":
            return ["Generate a plan", "Add an exam", "Schedule study blocks"]
        if page == "progress":
            return ["View streak details", "Compare this week", "Set a milestone"]
        return ["Start a focus session", "View my tasks", "Plan my week"]
