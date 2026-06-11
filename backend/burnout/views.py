from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ai.models import AIHistory

from .models import BurnoutReport
from .serializers import BurnoutReportSerializer


class BurnoutAnalyzeView(APIView):
    def post(self, request):
        sleep_hours = float(request.data.get("sleep_hours") or 7)
        study_hours = float(request.data.get("study_hours") or 4)
        stress = int(request.data.get("stress") or 5)
        breaks = int(request.data.get("breaks") or 2)

        score = min(100, max(0, int(stress * 9 + max(study_hours - 5, 0) * 8 + max(7 - sleep_hours, 0) * 10 - breaks * 4)))
        if score >= 70:
            risk = "high"
        elif score >= 40:
            risk = "medium"
        else:
            risk = "low"

        recommendations = [
            "Protect a fixed sleep window tonight.",
            "Use shorter 35-45 minute study blocks with real breaks.",
            "Move one low-priority task to tomorrow.",
        ]
        if risk == "high":
            recommendations.insert(0, "Do a recovery block before the next heavy study session.")
        elif risk == "low":
            recommendations.append("Maintain the current rhythm and keep breaks intentional.")

        report = BurnoutReport.objects.create(
            user=request.user,
            score=score,
            risk_level=risk,
            signals={
                "sleep_hours": sleep_hours,
                "study_hours": study_hours,
                "stress": stress,
                "breaks": breaks,
            },
            recommendations=recommendations,
        )
        AIHistory.objects.create(user=request.user, feature="burnout", prompt=str(request.data), response=BurnoutReportSerializer(report).data)
        return Response(BurnoutReportSerializer(report).data, status=status.HTTP_201_CREATED)


class BurnoutReportListView(APIView):
    def get(self, request):
        reports = BurnoutReport.objects.filter(user=request.user)[:10]
        return Response(BurnoutReportSerializer(reports, many=True).data)
