from django.conf import settings
from django.db import models


class Subject(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subjects")
    name = models.CharField(max_length=120)
    color = models.CharField(max_length=20, default="#8b5cf6")
    weekly_goal_hours = models.PositiveIntegerField(default=5)
    weak_topics = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("user", "name")

    def __str__(self):
        return self.name


class Exam(models.Model):
    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="exams")
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True, related_name="exams")
    title = models.CharField(max_length=160)
    date = models.DateField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="medium")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date", "title"]

    def __str__(self):
        return self.title


class StudyTask(models.Model):
    STATUS_CHOICES = [
        ("todo", "To do"),
        ("doing", "Doing"),
        ("done", "Done"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_tasks")
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks")
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    due_date = models.DateField(null=True, blank=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(default=45)
    priority = models.CharField(max_length=10, choices=Exam.PRIORITY_CHOICES, default="medium")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="todo")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status", "due_date", "-created_at"]

    def __str__(self):
        return self.title
