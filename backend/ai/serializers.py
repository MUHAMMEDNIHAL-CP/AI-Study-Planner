from rest_framework import serializers

from .models import AIHistory


class AIHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AIHistory
        fields = ["id", "feature", "provider", "prompt", "response", "created_at"]
        read_only_fields = ["id", "created_at"]
