from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ai.models import AIHistory

from .models import Quiz
from .serializers import QuizSerializer


def build_questions(topic, difficulty, count):
    questions = []
    stems = [
        "Which statement best describes",
        "What is the first step when solving",
        "Which revision method works best for",
        "What mistake should you avoid in",
        "How can you test understanding of",
    ]
    for index in range(count):
        questions.append(
            {
                "id": index + 1,
                "question": f"{stems[index % len(stems)]} {topic}?",
                "options": [
                    f"Use the main concept of {topic} with an example",
                    "Memorize every sentence without practice",
                    "Skip mistakes and only read notes",
                    "Study only on the exam morning",
                ],
                "answer_index": 0,
                "explanation": f"The strongest answer applies {topic} actively and checks understanding.",
            }
        )
    return questions


class QuizGenerateView(APIView):
    def post(self, request):
        topic = request.data.get("topic") or "your topic"
        difficulty = request.data.get("difficulty") or "medium"
        count = min(max(int(request.data.get("count") or 5), 3), 10)
        questions = build_questions(topic, difficulty, count)
        quiz = Quiz.objects.create(
            user=request.user,
            topic=topic,
            difficulty=difficulty,
            questions=questions,
            total_questions=len(questions),
        )
        AIHistory.objects.create(user=request.user, feature="quiz", prompt=str(request.data), response={"quiz_id": quiz.id, "questions": questions})
        return Response(QuizSerializer(quiz).data, status=status.HTTP_201_CREATED)


class QuizSubmitView(APIView):
    def post(self, request, pk):
        quiz = Quiz.objects.get(pk=pk, user=request.user)
        answers = request.data.get("answers") or {}
        score = 0
        results = []
        for question in quiz.questions:
            selected = answers.get(str(question["id"]), answers.get(question["id"]))
            correct = selected == question["answer_index"]
            score += 1 if correct else 0
            results.append(
                {
                    "id": question["id"],
                    "correct": correct,
                    "selected": selected,
                    "answer_index": question["answer_index"],
                    "explanation": question["explanation"],
                }
            )
        quiz.score = score
        quiz.save(update_fields=["score"])
        return Response({"score": score, "total": quiz.total_questions, "results": results})


class QuizHistoryView(APIView):
    def get(self, request):
        quizzes = Quiz.objects.filter(user=request.user)[:20]
        return Response(QuizSerializer(quizzes, many=True).data)
