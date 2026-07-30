from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()


class QuizAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="quiztester", password="pwd123")
        self.client.force_authenticate(user=self.user)

    def test_generate_quiz_with_invalid_count_falls_back_to_default(self):
        response = self.client.post(
            "/api/quiz/generate/",
            {"topic": "Python", "difficulty": "easy", "count": "not-a-number"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["topic"], "Python")
        self.assertGreaterEqual(len(response.data["questions"]), 3)
        self.assertEqual(response.data["total_questions"], len(response.data["questions"]))
