from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ai.models import AIHistory
from productivity.models import ProductivityLog

from .models import Exam, StudyTask, Subject
from .serializers import ExamSerializer, StudyTaskSerializer, SubjectSerializer


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

        streak = 0
        for offset in range(30):
            day = today - timedelta(days=offset)
            if logs.filter(date=day, minutes_studied__gt=0).exists():
                streak += 1
            else:
                break

        return Response(
            {
                "streak": streak,
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
        AIHistory.objects.create(user=request.user, feature="planner", prompt=str(request.data), response=response)
        return Response(response, status=status.HTTP_201_CREATED)
