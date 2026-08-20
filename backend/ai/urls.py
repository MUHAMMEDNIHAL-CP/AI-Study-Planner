from django.urls import path

from .chat import ChatBotView
from .views import AIHistoryListView, AIStatusView, ExplainTopicView, FocusCoachView, TutorView

urlpatterns = [
    path("status/", AIStatusView.as_view(), name="ai-status"),
    path("chat/", ChatBotView.as_view(), name="ai-chat"),
    path("tutor/", TutorView.as_view(), name="ai-tutor"),
    path("focus-coach/", FocusCoachView.as_view(), name="focus-coach"),
    path("explain/", ExplainTopicView.as_view(), name="explain-topic"),
    path("history/", AIHistoryListView.as_view(), name="ai-history"),
]
