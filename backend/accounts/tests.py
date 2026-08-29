from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.social_auth import InvalidTokenError, UnverifiedEmailError

User = get_user_model()

GOOGLE_CLAIMS = {
    "sub": "google-sub-123",
    "email": "google.user@example.com",
    "email_verified": True,
    "name": "Google User",
}

APPLE_CLAIMS = {
    "sub": "apple-sub-123",
    "email": "apple.user@example.com",
    "email_verified": True,
    "name": "Apple User",
    "nonce": "abc123",
}


class SocialLoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_google_signup_creates_user_and_returns_tokens(self):
        with patch("accounts.views.verify_google_id_token", return_value=GOOGLE_CLAIMS):
            resp = self.client.post(
                "/api/auth/social/",
                {"provider": "google", "id_token": "header.payload.signature"},
                format="json",
            )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["access"])
        self.assertTrue(resp.data["refresh"])
        self.assertTrue(resp.data["is_new"])

        user = User.objects.get(email=GOOGLE_CLAIMS["email"])
        self.assertEqual(user.first_name, "Google User")
        self.assertFalse(user.has_usable_password())

    def test_google_login_existing_user_returns_is_new_false(self):
        existing = User.objects.create_user(username="existing", email=GOOGLE_CLAIMS["email"])
        with patch("accounts.views.verify_google_id_token", return_value=GOOGLE_CLAIMS):
            resp = self.client.post(
                "/api/auth/social/",
                {"provider": "google", "id_token": "header.payload.signature"},
                format="json",
            )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["is_new"])
        self.assertEqual(User.objects.filter(email=GOOGLE_CLAIMS["email"]).count(), 1)
        existing.refresh_from_db()
        self.assertEqual(existing.email, GOOGLE_CLAIMS["email"])

    def test_apple_signup_with_nonce(self):
        with patch("accounts.views.verify_apple_id_token", return_value=APPLE_CLAIMS):
            resp = self.client.post(
                "/api/auth/social/",
                {"provider": "apple", "id_token": "h.p.s", "nonce": "abc123"},
                format="json",
            )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["is_new"])
        self.assertTrue(User.objects.filter(email=APPLE_CLAIMS["email"]).exists())

    def test_invalid_token_returns_400(self):
        with patch("accounts.views.verify_google_id_token", side_effect=InvalidTokenError("bad")):
            resp = self.client.post(
                "/api/auth/social/",
                {"provider": "google", "id_token": "garbage"},
                format="json",
            )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("id_token", resp.data)

    def test_unknown_provider_returns_400(self):
        resp = self.client.post(
            "/api/auth/social/",
            {"provider": "facebook", "id_token": "h.p.s"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_unverified_google_email_rejected(self):
        with patch("accounts.views.verify_google_id_token", side_effect=UnverifiedEmailError("not verified")):
            resp = self.client.post(
                "/api/auth/social/",
                {"provider": "google", "id_token": "h.p.s"},
                format="json",
            )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("email", resp.data)