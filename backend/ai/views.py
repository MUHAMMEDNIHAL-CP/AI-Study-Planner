from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .gemini import generate_json, gemini_configured, sanitize_prompt
from .models import AIHistory
from .serializers import AIHistorySerializer


class AIThrottle(ScopedRateThrottle):
    scope = "ai"


def _clean_text(value, field, default="", max_chars=2000):
    """Return a sanitized string or the default if invalid/empty."""
    if value is None:
        return default
    text = str(value)
    try:
        return sanitize_prompt(text, max_chars=max_chars, default=default)
    except ValueError:
        return default


def fallback_tutor_answer(mode, topic):
    if mode == "flashcards":
        return {
            "title": f"Flashcards for {topic}",
            "flashcards": [
                {"front": f"What is the core idea of {topic}?", "back": "Explain it in your own words, then test with one example."},
                {"front": "What is a common mistake?", "back": "Skipping active recall; close notes and retrieve before rereading."},
                {"front": "How should I revise this?", "back": "Use spaced repetition: today, tomorrow, three days later, and one week later."},
            ],
        }
    if mode == "summary":
        return {
            "title": f"Summary of {topic}",
            "summary": [
                f"Start with the definition and purpose of {topic}.",
                "Break the material into 3-5 subtopics.",
                "End by solving two questions without notes.",
            ],
        }
    return {
        "title": f"Explanation: {topic}",
        "explanation": (
            f"Think of {topic} as a chain of small ideas. First identify the main rule, "
            "then connect it to one example, then test yourself with a slightly different case."
        ),
        "next_steps": ["Write a 5-line summary.", "Solve 3 practice questions.", "Mark anything confusing for revision."],
    }


class TutorView(APIView):
    throttle_classes = [AIThrottle]

    def post(self, request):
        mode = _clean_text(request.data.get("mode"), "mode", default="explain", max_chars=50)
        if mode not in {"explain", "summary", "flashcards"}:
            mode = "explain"

        prompt = _clean_text(
            request.data.get("prompt") or request.data.get("question"),
            "prompt",
            default="",
            max_chars=8000,
        )
        topic = _clean_text(request.data.get("topic"), "topic", default="the topic", max_chars=500)

        fallback = fallback_tutor_answer(mode, topic)
        gemini_answer, gemini_error = generate_json(
            "You are FocusFlow AI, a precise and friendly study tutor. "
            "Return strict JSON only. "
            "For mode explain use keys: title, explanation, next_steps array. "
            "For mode summary use keys: title, summary array. "
            "For mode flashcards use keys: title, flashcards array of objects with front and back. "
            f"Mode: {mode}. Topic: {topic}. Student prompt: {prompt or 'No extra prompt'}.",
            return_error=True,
        )
        answer = gemini_answer if isinstance(gemini_answer, dict) and gemini_answer.get("title") else fallback
        provider = "gemini" if answer is gemini_answer else "mock"
        if provider == "mock" and gemini_error:
            answer["ai_warning"] = gemini_error

        history = AIHistory.objects.create(
            user=request.user,
            feature="tutor",
            prompt=prompt or topic,
            response=answer,
            provider=provider,
        )
        return Response({"history_id": history.id, "provider": provider, **answer}, status=status.HTTP_201_CREATED)


class FocusCoachView(APIView):
    throttle_classes = [AIThrottle]

    def post(self, request):
        prompt = _clean_text(
            request.data.get("prompt") or request.data.get("message"),
            "prompt",
            default="I feel distracted and need help starting.",
            max_chars=8000,
        )
        context = request.data.get("context") or {}
        fatigue = _clean_text(context.get("fatigue"), "fatigue", default="unknown", max_chars=100)
        productivity = _clean_text(context.get("productivity"), "productivity", default="unknown", max_chars=100)

        if not prompt:
            prompt = "I feel distracted and need help starting."

        fallback = {
            "provider": "mock",
            "reply": (
                "You are not behind; you are just carrying too many open loops. "
                f"Because your fatigue is {fatigue} and productivity is {productivity}, start with one tiny, visible win: "
                "set a 10-minute timer, close unrelated tabs, and write the first answer from memory before rereading."
            ),
            "action_steps": [
                "Name the single task you will finish in the next focus block.",
                "Use one slow breath cycle before pressing start.",
                "After 10 minutes, mark progress even if the block is not perfect.",
            ],
            "breathing_cue": "Breathe in for 4, hold for 2, breathe out for 6.",
        }
        gemini_response, gemini_error = generate_json(
            "You are FocusFlow AI, an empathetic but practical student focus coach. "
            "Return strict JSON with keys: reply string, action_steps array of 3 short steps, breathing_cue string. "
            f"Student message: {prompt}. Current context: fatigue={fatigue}, productivity={productivity}.",
            return_error=True,
        )
        response = gemini_response if isinstance(gemini_response, dict) and gemini_response.get("reply") else fallback
        response["provider"] = "gemini" if response is gemini_response else "mock"
        if response["provider"] == "mock" and gemini_error:
            response["ai_warning"] = gemini_error
        history = AIHistory.objects.create(
            user=request.user,
            feature="tutor",
            prompt=prompt,
            response=response,
            provider=response["provider"],
        )
        return Response({"history_id": history.id, **response}, status=status.HTTP_201_CREATED)


class ExplainTopicView(APIView):
    throttle_classes = [AIThrottle]

    def post(self, request):
        topic = _clean_text(request.data.get("topic"), "topic", default="this topic", max_chars=500) or "this topic"
        level = _clean_text(request.data.get("level"), "level", default="kid", max_chars=20)
        if level not in {"kid", "exam", "research"}:
            level = "kid"

        if level == "exam":
            explanation = (
                f"For exams, treat {topic} as a repeatable pattern: define the principle, identify the given data, "
                "choose the rule, solve one step at a time, then check the units or assumptions."
            )
            analogy = "Like using a recipe: ingredients first, method second, taste-check at the end."
        elif level == "research":
            explanation = (
                f"At a deeper level, {topic} is best understood by separating its assumptions, mechanism, "
                "limitations, and measurable outcomes. Compare edge cases to see where the model breaks."
            )
            analogy = "Like auditing a system: inputs, transformations, outputs, and failure modes."
        else:
            explanation = (
                f"Imagine {topic} as a simple machine. One part goes in, something happens inside, "
                "and a useful result comes out. Learn what each part does before memorizing big words."
            )
            analogy = "Like a vending machine: input, process, output."

        fallback = {
            "provider": "mock",
            "topic": topic,
            "level": level,
            "explanation": explanation,
            "analogy": analogy,
            "steps": [
                "Write the idea in one sentence.",
                "Draw or imagine one example.",
                "Answer one question without notes.",
            ],
            "check_question": f"What is the most important cause-and-effect relationship in {topic}?",
        }
        gemini_response, gemini_error = generate_json(
            "You are FocusFlow AI. Explain academic topics clearly for students. "
            "Return strict JSON with keys: topic, level, explanation, analogy, steps array, check_question. "
            f"Topic: {topic}. Level: {level}.",
            return_error=True,
        )
        response = gemini_response if isinstance(gemini_response, dict) and gemini_response.get("explanation") else fallback
        response["provider"] = "gemini" if response is gemini_response else "mock"
        if response["provider"] == "mock" and gemini_error:
            response["ai_warning"] = gemini_error
        history = AIHistory.objects.create(
            user=request.user,
            feature="tutor",
            prompt=f"{level}: {topic}",
            response=response,
            provider=response["provider"],
        )
        return Response({"history_id": history.id, **response}, status=status.HTTP_201_CREATED)


class AIHistoryListView(APIView):
    def get(self, request):
        history = AIHistory.objects.filter(user=request.user)[:20]
        return Response(AIHistorySerializer(history, many=True).data)


class AIStatusView(APIView):
    def get(self, request):
        return Response(
            {
                "gemini_configured": gemini_configured(),
                "provider": "gemini" if gemini_configured() else "mock",
            }
        )

