from datetime import timedelta

from django.db.models import Avg, Sum
from django.utils import timezone
from rest_framework import generics, status
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

    def create(self, request, *args, **kwargs):
        date = request.data.get("date")
        instance = ProductivityLog.objects.filter(user=request.user, date=date).first() if date else None
        if instance:
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)


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
