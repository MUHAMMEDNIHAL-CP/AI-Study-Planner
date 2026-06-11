from rest_framework import serializers

from .models import ProductivityLog


class ProductivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductivityLog
        fields = [
            "id",
            "date",
            "minutes_studied",
            "focus_score",
            "completed_tasks",
            "breaks_taken",
            "mood",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
