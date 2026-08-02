from datetime import timedelta

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

        # Duolingo-style unlimited streak stats (current, longest, total days, heatmap...).
        streak_stats = compute_streak_stats(request.user)

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
            "You are FocusFlow AI, a study planner for students. Return strict JSON with keys: "
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
