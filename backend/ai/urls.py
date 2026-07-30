from django.urls import path

from .views import AIHistoryListView, AIStatusView, ExplainTopicView, FocusCoachView, TutorView

urlpatterns = [
    path("status/", AIStatusView.as_view(), name="ai-status"),
    path("tutor/", TutorView.as_view(), name="ai-tutor"),
    path("focus-coach/", FocusCoachView.as_view(), name="focus-coach"),
    path("explain/", ExplainTopicView.as_view(), name="explain-topic"),
    path("history/", AIHistoryListView.as_view(), name="ai-history"),
]
