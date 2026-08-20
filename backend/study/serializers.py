from rest_framework import serializers

from .models import Exam, StudyTask, Subject


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name", "subject_code", "teacher", "color", "weekly_goal_hours", "weak_topics", "total_topics", "topics_completed", "target_grade", "created_at"]
        read_only_fields = ["id", "created_at"]


class ExamSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    preparation_pct = serializers.SerializerMethodField()
    days_left = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = ["id", "subject", "subject_name", "title", "date", "priority", "notes", "modules", "preparation_pct", "days_left", "created_at"]
        read_only_fields = ["id", "created_at", "subject_name", "preparation_pct", "days_left"]

    def get_preparation_pct(self, obj):
        if not obj.modules:
            if obj.subject and obj.subject.total_topics > 0:
                return round((obj.subject.topics_completed / obj.subject.total_topics) * 100)
            return 0
        completed = sum(1 for m in obj.modules if m.get("completed"))
        return round((completed / len(obj.modules)) * 100) if obj.modules else 0

    def get_days_left(self, obj):
        from django.utils import timezone
        delta = obj.date - timezone.localdate()
        return max(0, delta.days)


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
