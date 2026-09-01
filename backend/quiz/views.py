from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ai.gemini import generate_json
from ai.models import AIHistory
from productivity.models import record_study_activity

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


def build_gemini_questions(topic, difficulty, count):
    response = generate_json(
        "You are Flox AI. Generate an educational active-recall multiple-choice quiz. "
        "Return strict JSON with key questions. questions must be an array of objects with keys: "
        "id number, question string, options array of exactly 4 strings, answer_index number from 0 to 3, explanation string. "
        f"Topic: {topic}. Difficulty: {difficulty}. Count: {count}."
    )
    raw_questions = response.get("questions") if isinstance(response, dict) else None
    if not isinstance(raw_questions, list):
        return None

    questions = []
    for index, question in enumerate(raw_questions[:count]):
        options = question.get("options") if isinstance(question, dict) else None
        answer_index = question.get("answer_index") if isinstance(question, dict) else None
        if not isinstance(options, list) or len(options) != 4 or not isinstance(answer_index, int) or not 0 <= answer_index <= 3:
            return None
        questions.append(
            {
                "id": index + 1,
                "question": str(question.get("question") or f"Question {index + 1} about {topic}"),
                "options": [str(option) for option in options],
                "answer_index": answer_index,
                "explanation": str(question.get("explanation") or "Review the concept and try explaining why the correct option works."),
            }
        )
    return questions if len(questions) >= 3 else None


class QuizGenerateView(APIView):
    def post(self, request):
        topic = str(request.data.get("topic") or "your topic").strip() or "your topic"
        difficulty = str(request.data.get("difficulty") or "medium").strip().lower() or "medium"
        difficulty = difficulty if difficulty in {"easy", "medium", "hard"} else "medium"

        try:
            requested_count = int(request.data.get("count") or 5)
        except (TypeError, ValueError):
            requested_count = 5

        count = max(3, min(requested_count, 10))
        questions = build_gemini_questions(topic, difficulty, count)
        provider = "gemini" if questions else "mock"
        questions = questions or build_questions(topic, difficulty, count)
        quiz = Quiz.objects.create(
            user=request.user,
            topic=topic,
            difficulty=difficulty,
            questions=questions,
            total_questions=len(questions),
        )
        AIHistory.objects.create(
            user=request.user,
            feature="quiz",
            prompt=f"Generate a {difficulty} quiz with {count} questions about {topic}.",
            response={"quiz_id": quiz.id, "questions": questions},
            provider=provider,
        )
        data = QuizSerializer(quiz).data
        data["provider"] = provider
        record_study_activity(request.user)
        return Response(data, status=status.HTTP_201_CREATED)


class QuizSubmitView(APIView):
    def post(self, request, pk):
        try:
            quiz = Quiz.objects.get(pk=pk, user=request.user)
        except Quiz.DoesNotExist:
            return Response({"detail": "Quiz not found."}, status=status.HTTP_404_NOT_FOUND)

        answers = request.data.get("answers") or {}
        score = 0
        results = []
        for question in quiz.questions:
            selected = answers.get(str(question["id"]), answers.get(question["id"]))
            try:
                selected = int(selected)
            except (TypeError, ValueError):
                selected = None
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
        record_study_activity(request.user, minutes=10)
        return Response({"score": score, "total": quiz.total_questions, "results": results})


class QuizHistoryView(APIView):
    def get(self, request):
        quizzes = Quiz.objects.filter(user=request.user)[:20]
        return Response(QuizSerializer(quizzes, many=True).data)
