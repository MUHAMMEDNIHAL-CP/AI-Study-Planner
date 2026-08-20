from datetime import date
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import FocusSession, ProductivityLog
from .focus_serializers import FocusSessionSerializer

class FocusSessionListCreateView(generics.ListCreateAPIView):
    serializer_class = FocusSessionSerializer

    def get_queryset(self):
        return FocusSession.objects.filter(user=self.request.user).select_related("subject", "task")

    def perform_create(self, serializer):
        session = serializer.save(user=self.request.user)
        today = session.date or date.today()
        log, _ = ProductivityLog.objects.get_or_create(user=self.request.user, date=today)
        log.minutes_studied += session.duration_minutes
        log.focus_score = max(0, min(100, log.focus_score + 5 if session.completed else log.focus_score - 3))
        log.save(update_fields=["minutes_studied", "focus_score"])

class FocusSessionDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = FocusSessionSerializer

    def get_queryset(self):
        return FocusSession.objects.filter(user=self.request.user).select_related("subject", "task")
