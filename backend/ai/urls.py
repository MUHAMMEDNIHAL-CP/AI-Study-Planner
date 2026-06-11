from django.urls import path

from .views import AIHistoryListView, TutorView

urlpatterns = [
    path("tutor/", TutorView.as_view(), name="ai-tutor"),
    path("history/", AIHistoryListView.as_view(), name="ai-history"),
]
