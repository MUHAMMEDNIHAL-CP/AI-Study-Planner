from django.urls import path

from .views import (
    DashboardView,
    ExamDetailView,
    ExamListCreateView,
    GeneratePlanView,
    StudyTaskDetailView,
    StudyTaskListCreateView,
    SubjectDetailView,
    SubjectListCreateView,
)

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("subjects/", SubjectListCreateView.as_view(), name="subjects"),
    path("subjects/<int:pk>/", SubjectDetailView.as_view(), name="subject-detail"),
    path("exams/", ExamListCreateView.as_view(), name="exams"),
    path("exams/<int:pk>/", ExamDetailView.as_view(), name="exam-detail"),
    path("tasks/", StudyTaskListCreateView.as_view(), name="study-tasks"),
    path("tasks/<int:pk>/", StudyTaskDetailView.as_view(), name="study-task-detail"),
    path("plan/generate/", GeneratePlanView.as_view(), name="generate-plan"),
]
