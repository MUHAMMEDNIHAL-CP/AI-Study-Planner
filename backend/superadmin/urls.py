from django.urls import path

from .views import (
    AdminAIView,
    AdminAuditLogView,
    AdminDeviceView,
    AdminEngagementView,
    AdminExamsView,
    AdminHealthView,
    AdminNotesView,
    AdminOverviewView,
    AdminQuizzesView,
    AdminReportExportView,
    AdminReportView,
    AdminStreaksView,
    AdminStudyActivityView,
    AdminTasksView,
    AdminUserDetailView,
    AdminUsersView,
)

urlpatterns = [
    path("overview/", AdminOverviewView.as_view(), name="admin_overview"),
    path("users/", AdminUsersView.as_view(), name="admin_users"),
    path("users/<int:user_id>/", AdminUserDetailView.as_view(), name="admin_user_detail"),
    path("engagement/", AdminEngagementView.as_view(), name="admin_engagement"),
    path("streaks/", AdminStreaksView.as_view(), name="admin_streaks"),
    path("study-activity/", AdminStudyActivityView.as_view(), name="admin_study_activity"),
    path("quizzes/", AdminQuizzesView.as_view(), name="admin_quizzes"),
    path("exams/", AdminExamsView.as_view(), name="admin_exams"),
    path("notes/", AdminNotesView.as_view(), name="admin_notes"),
    path("tasks/", AdminTasksView.as_view(), name="admin_tasks"),
    path("ai/", AdminAIView.as_view(), name="admin_ai"),
    path("devices/", AdminDeviceView.as_view(), name="admin_devices"),
    path("health/", AdminHealthView.as_view(), name="admin_health"),
    path("audit-logs/", AdminAuditLogView.as_view(), name="admin_audit_logs"),
    path("reports/", AdminReportView.as_view(), name="admin_reports"),
    path("reports/export/", AdminReportExportView.as_view(), name="admin_reports_export"),
]