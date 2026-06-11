from datetime import timedelta

from django.db.models import Avg, Sum
from django.utils import timezone
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ProductivityLog
from .serializers import ProductivityLogSerializer


class ProductivityLogListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductivityLogSerializer

    def get_queryset(self):
        return ProductivityLog.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ProductivityLogDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductivityLogSerializer

    def get_queryset(self):
        return ProductivityLog.objects.filter(user=self.request.user)


class AnalyticsView(APIView):
    def get(self, request):
        today = timezone.localdate()
        start = today - timedelta(days=13)
        logs = ProductivityLog.objects.filter(user=request.user, date__gte=start).order_by("date")
        summary = logs.aggregate(
            total_minutes=Sum("minutes_studied"),
            average_focus=Avg("focus_score"),
            completed_tasks=Sum("completed_tasks"),
        )
        return Response(
            {
                "total_minutes": summary["total_minutes"] or 0,
                "average_focus": round(summary["average_focus"] or 0),
                "completed_tasks": summary["completed_tasks"] or 0,
                "daily": ProductivityLogSerializer(logs, many=True).data,
            }
        )
