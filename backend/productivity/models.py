from django.conf import settings
from django.db import models


class ProductivityLog(models.Model):
    MOOD_CHOICES = [
        ("low", "Low"),
        ("okay", "Okay"),
        ("good", "Good"),
        ("great", "Great"),
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
