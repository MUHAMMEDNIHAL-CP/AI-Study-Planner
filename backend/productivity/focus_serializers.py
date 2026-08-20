from rest_framework import serializers
from .models import FocusSession

class FocusSessionSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True, default=None)
    task_title = serializers.CharField(source="task.title", read_only=True, default=None)

    class Meta:
        model = FocusSession
        fields = ["id", "subject", "subject_name", "task", "task_title", "duration_minutes", "completed", "mood", "notes", "date", "created_at"]
        read_only_fields = ["id", "created_at", "subject_name", "task_title"]
