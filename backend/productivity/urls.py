from django.urls import path

from .focus_views import FocusSessionListCreateView, FocusSessionDetailView
from .views import AnalyticsView, ProductivityLogDetailView, ProductivityLogListCreateView

urlpatterns = [
    path("logs/", ProductivityLogListCreateView.as_view(), name="productivity-logs"),
    path("logs/<int:pk>/", ProductivityLogDetailView.as_view(), name="productivity-log-detail"),
    path("analytics/", AnalyticsView.as_view(), name="analytics"),
    path("focus-sessions/", FocusSessionListCreateView.as_view(), name="focus-sessions"),
    path("focus-sessions/<int:pk>/", FocusSessionDetailView.as_view(), name="focus-session-detail"),
]
