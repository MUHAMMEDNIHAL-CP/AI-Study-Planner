from django.urls import path

from .views import QuizGenerateView, QuizHistoryView, QuizSubmitView

urlpatterns = [
    path("generate/", QuizGenerateView.as_view(), name="quiz-generate"),
    path("<int:pk>/submit/", QuizSubmitView.as_view(), name="quiz-submit"),
    path("history/", QuizHistoryView.as_view(), name="quiz-history"),
]
