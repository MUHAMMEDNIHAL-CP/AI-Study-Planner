from django.contrib.auth import get_user_model
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient

from productivity.models import ProductivityLog, record_study_activity

User = get_user_model()


class RecordStudyActivityTests(TestCase):
    """Multiple activities accumulate toward the 30-minute daily threshold."""

    def setUp(self):
        self.user = User.objects.create_user(username="produser", password="testpass123")

    def test_activities_accumulate_minutes(self):
        record_study_activity(self.user)
        record_study_activity(self.user)
        record_study_activity(self.user, minutes=20)
        log = ProductivityLog.objects.get(user=self.user, date=timezone.localdate())
        self.assertEqual(log.minutes_studied, 30)

    def test_repeat_calls_update_same_daily_log(self):
        record_study_activity(self.user)
        record_study_activity(self.user)
        self.assertEqual(ProductivityLog.objects.filter(user=self.user).count(), 1)


class FocusSessionStreakTests(TestCase):
    """Completed focus sessions always accumulate; incomplete sessions do not."""

    def setUp(self):
        self.user = User.objects.create_user(username="focususer", password="testpass123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_completed_session_accumulates_duration(self):
        resp = self.client.post(
            "/api/productivity/focus-sessions/",
            {"duration_minutes": 25, "completed": True, "date": timezone.localdate().isoformat()},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        log = ProductivityLog.objects.get(user=self.user, date=timezone.localdate())
        self.assertEqual(log.minutes_studied, 25)

    def test_short_completed_session_sums_toward_threshold(self):
        self.client.post(
            "/api/productivity/focus-sessions/",
            {"duration_minutes": 20, "completed": True, "date": timezone.localdate().isoformat()},
            format="json",
        )
        self.client.post(
            "/api/productivity/focus-sessions/",
            {"duration_minutes": 15, "completed": True, "date": timezone.localdate().isoformat()},
            format="json",
        )
        log = ProductivityLog.objects.get(user=self.user, date=timezone.localdate())
        self.assertEqual(log.minutes_studied, 35)

    def test_incomplete_session_does_not_count(self):
        self.client.post(
            "/api/productivity/focus-sessions/",
            {"duration_minutes": 40, "completed": False, "date": timezone.localdate().isoformat()},
            format="json",
        )
        self.assertFalse(ProductivityLog.objects.filter(user=self.user, date=timezone.localdate()).exists())

    def test_frontend_mood_values_are_accepted(self):
        for mood in ("difficult", "excellent", "great", "good", "okay"):
            resp = self.client.post(
                "/api/productivity/focus-sessions/",
                {
                    "duration_minutes": 30,
                    "completed": True,
                    "mood": mood,
                    "date": timezone.localdate().isoformat(),
                },
                format="json",
            )
            self.assertEqual(resp.status_code, 201, mood)
            self.assertEqual(resp.data["mood"], mood)

    def test_daily_log_accepts_excellent_mood(self):
        resp = self.client.post(
            "/api/productivity/logs/",
            {
                "date": timezone.localdate().isoformat(),
                "minutes_studied": 30,
                "mood": "excellent",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["mood"], "excellent")