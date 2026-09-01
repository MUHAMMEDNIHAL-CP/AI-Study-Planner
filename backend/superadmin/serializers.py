from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import AuditLog

User = get_user_model()


class AuditLogSerializer(serializers.ModelSerializer):
    admin_username = serializers.CharField(source="admin.username", read_only=True, default="")
    target_username = serializers.CharField(source="target_user.username", read_only=True, default="")

    class Meta:
        model = AuditLog
        fields = (
            "id", "admin_username", "target_username", "action",
            "detail", "created_at",
        )


class AdminUserListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="first_name", read_only=True)
    subject_count = serializers.SerializerMethodField()
    task_count = serializers.SerializerMethodField()
    quiz_count = serializers.SerializerMethodField()
    note_count = serializers.SerializerMethodField()
    focus_session_count = serializers.SerializerMethodField()
    last_active = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "full_name", "is_active",
            "is_staff", "is_superuser", "date_joined", "last_login",
            "subject_count", "task_count", "quiz_count", "note_count",
            "focus_session_count", "last_active",
        )

    def get_subject_count(self, obj):
        return getattr(obj, "_subject_count", 0)

    def get_task_count(self, obj):
        return getattr(obj, "_task_count", 0)

    def get_quiz_count(self, obj):
        return getattr(obj, "_quiz_count", 0)

    def get_note_count(self, obj):
        return getattr(obj, "_note_count", 0)

    def get_focus_session_count(self, obj):
        return getattr(obj, "_focus_session_count", 0)

    def get_last_active(self, obj):
        last = getattr(obj, "_last_active", None)
        return last.isoformat() if last else None
