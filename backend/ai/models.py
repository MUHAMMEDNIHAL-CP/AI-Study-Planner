from django.conf import settings
from django.db import models


class AIHistory(models.Model):
    FEATURE_CHOICES = [
        ("planner", "Planner"),
        ("tutor", "Tutor"),
        ("quiz", "Quiz"),
        ("burnout", "Burnout"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_history")
    feature = models.CharField(max_length=20, choices=FEATURE_CHOICES)
    provider = models.CharField(max_length=40, default="mock")
    prompt = models.TextField()
    response = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.feature} - {self.created_at:%Y-%m-%d %H:%M}"
