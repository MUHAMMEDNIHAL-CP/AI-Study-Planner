from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AIHistory
from .serializers import AIHistorySerializer


class TutorView(APIView):
    def post(self, request):
        mode = request.data.get("mode", "explain")
        prompt = request.data.get("prompt") or request.data.get("question") or ""
        topic = request.data.get("topic") or "the topic"

        if mode == "flashcards":
            answer = {
                "title": f"Flashcards for {topic}",
                "flashcards": [
                    {"front": f"What is the core idea of {topic}?", "back": "Explain it in your own words, then test with one example."},
                    {"front": "What is a common mistake?", "back": "Skipping active recall; close notes and retrieve before rereading."},
                    {"front": "How should I revise this?", "back": "Use spaced repetition: today, tomorrow, three days later, and one week later."},
                ],
            }
        elif mode == "summary":
            answer = {
                "title": f"Summary of {topic}",
                "summary": [
                    f"Start with the definition and purpose of {topic}.",
                    "Break the material into 3-5 subtopics.",
                    "End by solving two questions without notes.",
                ],
            }
        else:
            answer = {
                "title": f"Explanation: {topic}",
                "explanation": (
                    f"Think of {topic} as a chain of small ideas. First identify the main rule, "
                    "then connect it to one example, then test yourself with a slightly different case."
                ),
                "next_steps": ["Write a 5-line summary.", "Solve 3 practice questions.", "Mark anything confusing for revision."],
            }

        history = AIHistory.objects.create(
            user=request.user,
            feature="tutor",
            prompt=prompt or topic,
            response=answer,
        )
        return Response({"history_id": history.id, "provider": "mock", **answer}, status=status.HTTP_201_CREATED)


class AIHistoryListView(APIView):
    def get(self, request):
        history = AIHistory.objects.filter(user=request.user)[:20]
        return Response(AIHistorySerializer(history, many=True).data)
