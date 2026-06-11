from rest_framework import serializers

from .models import Exam, StudyTask, Subject


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name", "color", "weekly_goal_hours", "weak_topics", "created_at"]
        read_only_fields = ["id", "created_at"]


class ExamSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = Exam
        fields = ["id", "subject", "subject_name", "title", "date", "priority", "notes", "created_at"]
        read_only_fields = ["id", "created_at", "subject_name"]


class StudyTaskSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = StudyTask
        fields = [
            "id",
            "subject",
            "subject_name",
            "title",
            "description",
            "due_date",
            "scheduled_for",
            "duration_minutes",
            "priority",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "subject_name"]
