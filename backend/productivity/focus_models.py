from django.conf import settings
from django.db import models

class FocusSession(models.Model):
    MOOD_CHOICES = [
        ("terrible", "Terrible"),
        ("bad", "Bad"),
        ("difficult", "Difficult"),
        ("okay", "Okay"),
        ("good", "Good"),
        ("great", "Great"),
        ("excellent", "Excellent"),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="focus_sessions")
    subject = models.ForeignKey("study.Subject", on_delete=models.SET_NULL, null=True, blank=True, related_name="focus_sessions")
    task = models.ForeignKey("study.StudyTask", on_delete=models.SET_NULL, null=True, blank=True, related_name="focus_sessions")
    duration_minutes = models.PositiveIntegerField(default=50)
    completed = models.BooleanField(default=True)
    mood = models.CharField(max_length=10, choices=MOOD_CHOICES, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    date = models.DateField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"FocusSession({self.user} - {self.duration_minutes}min)"
