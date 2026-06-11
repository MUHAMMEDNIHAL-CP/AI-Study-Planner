from django.urls import path

from .views import AnalyticsView, ProductivityLogDetailView, ProductivityLogListCreateView

urlpatterns = [
    path("logs/", ProductivityLogListCreateView.as_view(), name="productivity-logs"),
    path("logs/<int:pk>/", ProductivityLogDetailView.as_view(), name="productivity-log-detail"),
    path("analytics/", AnalyticsView.as_view(), name="analytics"),
]
