from django.contrib.auth import get_user_model
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient

from productivity.models import ProductivityLog
from study.streak import compute_streak_stats

User = get_user_model()


class StreakSetupActivityTests(TestCase):
    """Adding subjects/tasks/exams counts toward the streak immediately."""

    def setUp(self):
        self.user = User.objects.create_user(username="streakuser", password="testpass123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_single_activity_marks_a_study_day(self):
        self.client.post("/api/study/subjects/", {"name": "Math"}, format="json")
        stats = compute_streak_stats(self.user)
        self.assertEqual(stats["current_streak"], 1)
        self.assertTrue(stats["studied_today"])

    def test_multiple_activities_same_day_do_not_multiply_streak(self):
        for i in range(6):
            resp = self.client.post("/api/study/subjects/", {"name": f"Subject {i}"}, format="json")
            self.assertEqual(resp.status_code, 201)
        log = ProductivityLog.objects.get(user=self.user, date=timezone.localdate())
        self.assertGreaterEqual(log.minutes_studied, 30)
        stats = compute_streak_stats(self.user)
        self.assertEqual(stats["current_streak"], 1)
        self.assertTrue(stats["studied_today"])

    def test_all_resource_types_accumulate_minutes(self):
        self.client.post("/api/study/subjects/", {"name": "Physics"}, format="json")
        self.client.post("/api/study/exams/", {"title": "Midterm", "date": "2030-01-01"}, format="json")
        self.client.post("/api/study/tasks/", {"title": "Review chapter 3"}, format="json")
        log = ProductivityLog.objects.get(user=self.user, date=timezone.localdate())
        self.assertEqual(log.minutes_studied, 15)

    def test_completing_a_task_records_20_minutes(self):
        resp = self.client.post("/api/study/tasks/", {"title": "Revise calculus"}, format="json")
        task_id = resp.data["id"]
        self.client.patch(f"/api/study/tasks/{task_id}/", {"status": "done"}, format="json")
        log = ProductivityLog.objects.get(user=self.user, date=timezone.localdate())
        # 5 from creating the task + 20 from completing it
        self.assertEqual(log.minutes_studied, 25)