from django.urls import path

from .views import BurnoutAnalyzeView, BurnoutReportListView

urlpatterns = [
    path("analyze/", BurnoutAnalyzeView.as_view(), name="burnout-analyze"),
    path("reports/", BurnoutReportListView.as_view(), name="burnout-reports"),
]
