from django.conf import settings
from django.db import models


class BurnoutReport(models.Model):
    RISK_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="burnout_reports")
    score = models.PositiveIntegerField(default=25)
    risk_level = models.CharField(max_length=10, choices=RISK_CHOICES, default="low")
    signals = models.JSONField(default=dict)
    recommendations = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} - {self.risk_level}"
