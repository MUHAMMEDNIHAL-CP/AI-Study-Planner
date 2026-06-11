from rest_framework import serializers

from .models import BurnoutReport


class BurnoutReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = BurnoutReport
        fields = ["id", "score", "risk_level", "signals", "recommendations", "created_at"]
        read_only_fields = ["id", "created_at"]
