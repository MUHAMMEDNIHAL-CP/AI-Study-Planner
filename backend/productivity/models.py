from django.conf import settings
from django.db import models
from django.utils import timezone


class ProductivityLog(models.Model):
    MOOD_CHOICES = [
        ("low", "Low"),
        ("okay", "Okay"),
        ("good", "Good"),
        ("great", "Great"),
        ("excellent", "Excellent"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="productivity_logs")
    date = models.DateField()
    minutes_studied = models.PositiveIntegerField(default=0)
    focus_score = models.PositiveIntegerField(default=70)
    completed_tasks = models.PositiveIntegerField(default=0)
    breaks_taken = models.PositiveIntegerField(default=0)
    mood = models.CharField(max_length=10, choices=MOOD_CHOICES, default="good")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]
        unique_together = ("user", "date")

    def __str__(self):
        return f"{self.user} - {self.date}"


def record_study_activity(user, *, minutes=5):
    """Log a study activity for today, accumulating minutes toward the daily threshold.

    Multiple activities (adding subjects, tasks, notes, quizzes, AI interactions,
    etc.) each contribute minutes. A study day counts once total minutes reach 30+.
    """
    today = timezone.localdate()
    log, _ = ProductivityLog.objects.get_or_create(user=user, date=today)
    log.minutes_studied += minutes
    log.save(update_fields=["minutes_studied"])
    return log


from .focus_models import FocusSession
