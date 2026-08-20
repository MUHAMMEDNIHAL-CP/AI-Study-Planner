from datetime import timedelta

from django.db import models
from django.db.models import Sum
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ai.gemini import generate_json
from ai.models import AIHistory
from productivity.models import ProductivityLog

from .models import Exam, StudyTask, Subject
from .serializers import ExamSerializer, StudyTaskSerializer, SubjectSerializer
from .streak import compute_streak_stats


class OwnedQuerysetMixin:
    serializer_class = None

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SubjectListCreateView(OwnedQuerysetMixin, generics.ListCreateAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer


class SubjectDetailView(OwnedQuerysetMixin, generics.RetrieveUpdateDestroyAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer


class ExamListCreateView(OwnedQuerysetMixin, generics.ListCreateAPIView):
    queryset = Exam.objects.select_related("subject")
    serializer_class = ExamSerializer


class ExamDetailView(OwnedQuerysetMixin, generics.RetrieveUpdateDestroyAPIView):
    queryset = Exam.objects.select_related("subject")
    serializer_class = ExamSerializer


class ExamDetailEnrichedView(APIView):
    def get(self, request, pk):
        try:
            exam = Exam.objects.select_related("subject").get(pk=pk, user=request.user)
        except Exam.DoesNotExist:
            return Response({"detail": "Exam not found"}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.localdate()
        days_left = max(0, (exam.date - today).days)

        if exam.modules:
            completed = sum(1 for m in exam.modules if m.get("completed"))
            preparation_pct = round((completed / len(exam.modules)) * 100) if exam.modules else 0
        elif exam.subject and exam.subject.total_topics > 0:
            preparation_pct = round((exam.subject.topics_completed / exam.subject.total_topics) * 100)
        else:
            preparation_pct = 0

        weak_areas = []
        if exam.subject and exam.subject.weak_topics:
            weak_areas = [t.strip() for t in exam.subject.weak_topics.split(",") if t.strip()]

        upcoming_sessions = []
        if exam.subject:
            sessions = StudyTask.objects.filter(
                user=request.user,
                subject=exam.subject,
                status="todo",
                due_date__gte=today,
            ).order_by("due_date")[:10]
            upcoming_sessions = [
                {
                    "id": s.id,
                    "title": s.title,
                    "due_date": str(s.due_date) if s.due_date else None,
                    "duration_minutes": s.duration_minutes,
                    "priority": s.priority,
                }
                for s in sessions
            ]

        today_sessions = StudyTask.objects.filter(
            user=request.user,
            subject=exam.subject,
            scheduled_for__date=today,
        ) if exam.subject else StudyTask.objects.none()

        tomorrow = today + timedelta(days=1)
        tomorrow_sessions = StudyTask.objects.filter(
            user=request.user,
            subject=exam.subject,
            scheduled_for__date=tomorrow,
        ) if exam.subject else StudyTask.objects.none()

        today_minutes = sum(s.duration_minutes for s in today_sessions)
        tomorrow_minutes = sum(s.duration_minutes for s in tomorrow_sessions)

        subject_info = None
        if exam.subject:
            s = exam.subject
            subject_info = {
                "id": s.id,
                "name": s.name,
                "color": s.color,
                "topics_completed": s.topics_completed,
                "total_topics": s.total_topics,
                "weak_topics": s.weak_topics,
                "subject_code": s.subject_code,
            }

        return Response({
            "id": exam.id,
            "title": exam.title,
            "date": str(exam.date),
            "priority": exam.priority,
            "notes": exam.notes,
            "subject": subject_info,
            "modules": exam.modules or [],
            "preparation_pct": preparation_pct,
            "days_left": days_left,
            "weak_areas": weak_areas,
            "upcoming_sessions": upcoming_sessions,
            "today_plan": {
                "sessions": today_sessions.count(),
                "minutes": today_minutes,
            },
            "tomorrow_plan": {
                "sessions": tomorrow_sessions.count(),
                "minutes": tomorrow_minutes,
            },
        })


class StudyTaskListCreateView(OwnedQuerysetMixin, generics.ListCreateAPIView):
    queryset = StudyTask.objects.select_related("subject")
    serializer_class = StudyTaskSerializer


class StudyTaskDetailView(OwnedQuerysetMixin, generics.RetrieveUpdateDestroyAPIView):
    queryset = StudyTask.objects.select_related("subject")
    serializer_class = StudyTaskSerializer


class DashboardView(APIView):
    def get(self, request):
        today = timezone.localdate()
        week_start = today - timedelta(days=6)
        logs = ProductivityLog.objects.filter(user=request.user, date__gte=week_start).order_by("date")
        tasks = StudyTask.objects.filter(user=request.user)
        upcoming_exams = Exam.objects.filter(user=request.user, date__gte=today).select_related("subject")[:5]
        completed = tasks.filter(status="done").count()
        total_tasks = tasks.count()
        minutes = logs.aggregate(total=Sum("minutes_studied"))["total"] or 0

        streak_stats = compute_streak_stats(request.user)

        today_tasks = tasks.filter(
            models.Q(due_date=today) | models.Q(scheduled_for__date=today)
        ).select_related("subject")[:10]

        subjects = Subject.objects.filter(user=request.user)
        subjects_summary = [
            {
                "name": s.name,
                "color": s.color,
                "topics_completed": s.topics_completed,
                "total_topics": s.total_topics,
                "weekly_goal_hours": s.weekly_goal_hours,
            }
            for s in subjects
        ]

        total_study_hours = round(minutes / 60, 1)
        total_completed_tasks = completed

        from productivity.focus_models import FocusSession
        total_focus_sessions = FocusSession.objects.filter(user=request.user).count()

        today_log = ProductivityLog.objects.filter(user=request.user, date=today).first()
        today_minutes = today_log.minutes_studied if today_log else 0

        return Response(
            {
                **streak_stats,
                "week_minutes": minutes,
                "completion_rate": round((completed / total_tasks) * 100) if total_tasks else 0,
                "open_tasks": total_tasks - completed,
                "upcoming_exams": ExamSerializer(upcoming_exams, many=True).data,
                "recent_logs": [
                    {
                        "date": log.date,
                        "minutes_studied": log.minutes_studied,
                        "focus_score": log.focus_score,
                        "completed_tasks": log.completed_tasks,
                    }
                    for log in logs
                ],
                "today_tasks": [
                    {
                        "id": t.id,
                        "title": t.title,
                        "subject": t.subject.name if t.subject else None,
                        "status": t.status,
                        "priority": t.priority,
                        "due_date": t.due_date,
                    }
                    for t in today_tasks
                ],
                "subjects_summary": subjects_summary,
                "total_study_hours": total_study_hours,
                "total_completed_tasks": total_completed_tasks,
                "total_focus_sessions": total_focus_sessions,
                "today_minutes": today_minutes,
            }
        )


class GeneratePlanView(APIView):
    def post(self, request):
        subjects = request.data.get("subjects") or []
        weak_topics = request.data.get("weak_topics") or ""
        daily_hours = max(float(request.data.get("daily_hours") or 2), 0.5)
        exam_date = request.data.get("exam_date") or "your next exam"
        goal = request.data.get("goal") or "steady progress"

        if isinstance(subjects, str):
            subjects = [item.strip() for item in subjects.split(",") if item.strip()]
        if not subjects:
            subjects = list(Subject.objects.filter(user=request.user).values_list("name", flat=True)[:4])
        if not subjects:
            subjects = ["Core subject", "Revision", "Practice"]

        block_minutes = 50 if daily_hours >= 2 else 35
        blocks = max(1, int((daily_hours * 60) // block_minutes))
        plan = []
        for index in range(blocks):
            subject = subjects[index % len(subjects)]
            plan.append(
                {
                    "time": f"Session {index + 1}",
                    "subject": subject,
                    "duration_minutes": block_minutes,
                    "task": "Revise weak topics" if index == 0 and weak_topics else "Concept study + active recall",
                }
            )

        response = {
            "provider": "mock",
            "goal": goal,
            "exam_date": exam_date,
            "daily_hours": daily_hours,
            "plan": plan,
            "revision_schedule": [
                "Day 1: Learn and summarize priority concepts.",
                "Day 2: Solve mixed practice questions.",
                "Day 3: Review mistakes and make flashcards.",
                "Day 4: Timed mock test and light recovery.",
            ],
            "focus_tip": "Use 50/10 focus cycles and finish each session by writing one next action.",
        }
        gemini_response = generate_json(
            "You are Flox AI, a study planner for students. Return strict JSON with keys: "
            "goal string, exam_date string, daily_hours number, plan array, revision_schedule array, focus_tip string. "
            "Each plan item must contain time, subject, duration_minutes, task. "
            "Build a practical hourly active-recall timetable with spaced revision and breaks. "
            f"Subjects: {subjects}. Weak topics: {weak_topics}. Daily hours: {daily_hours}. "
            f"Exam date: {exam_date}. Goal: {goal}."
        )
        if isinstance(gemini_response, dict) and isinstance(gemini_response.get("plan"), list):
            response = {**gemini_response, "provider": "gemini"}

        AIHistory.objects.create(
            user=request.user,
            feature="planner",
            prompt=str(request.data),
            response=response,
            provider=response["provider"],
        )
        return Response(response, status=status.HTTP_201_CREATED)


class AdjustTimetableView(APIView):
    def post(self, request):
        fatigue = int(request.data.get("fatigue") or 5)
        productivity = int(request.data.get("productivity") or 5)
        screen_time = float(request.data.get("screen_time") or 4)
        missed_tasks = int(request.data.get("missed_tasks") or 0)
        timetable = request.data.get("timetable") or []
        gemini_payload = {
            "fatigue": fatigue,
            "productivity": productivity,
            "screen_time": screen_time,
            "missed_tasks": missed_tasks,
            "timetable": timetable,
        }

        energy_score = max(5, min(100, 100 - fatigue * 7 - screen_time * 3 - missed_tasks * 8 + productivity * 4))
        should_recover = energy_score < 55 or fatigue >= 7 or missed_tasks >= 3
        adjusted = []
        replaced_count = 0

        for index, slot in enumerate(timetable):
            updated = dict(slot)
            is_heavy = updated.get("type") in ["revision", "retrieval"] and int(updated.get("duration", 0) or 0) >= 45
            if should_recover and is_heavy and replaced_count < 2 and index % 2 == 0:
                updated.update(
                    {
                        "subject": "Mental Recharge" if replaced_count == 0 else "Active Recovery Walk",
                        "topic": "Breathing, hydration, and a short reset before returning to recall",
                        "duration": 25,
                        "type": "wellness",
                        "completed": False,
                    }
                )
                replaced_count += 1
            adjusted.append(updated)

        coaching = (
            "Your current load looks intense, so I softened the next hard blocks and protected momentum with recovery. "
            "This is not a step backward; it is how you keep the brain available for tomorrow."
            if should_recover
            else "Your energy is stable. Keep the timetable, but finish each block with two minutes of active recall."
        )
        gemini_response = generate_json(
            "You are an empathetic academic focus coach. Return strict JSON with keys: "
            "energy_score number, diagnosis string, adjusted_timetable array, changes_made number. "
            "Rewrite only the next exhausting study blocks into wellness slots when fatigue is high. "
            f"Student data: {gemini_payload}"
        )

        response = gemini_response or {
            "energy_score": round(energy_score),
            "diagnosis": coaching,
            "adjusted_timetable": adjusted,
            "changes_made": replaced_count,
        }
        if not isinstance(response, dict) or not isinstance(response.get("adjusted_timetable"), list):
            response = {
                "energy_score": round(energy_score),
                "diagnosis": coaching,
                "adjusted_timetable": adjusted,
                "changes_made": replaced_count,
            }
        response["provider"] = "gemini" if response is gemini_response else "mock"
        AIHistory.objects.create(
            user=request.user,
            feature="burnout",
            prompt=str(request.data),
            response=response,
            provider=response["provider"],
        )
        return Response(response, status=status.HTTP_201_CREATED)
