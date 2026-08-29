from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Profile
from .serializers import LoginSerializer, RegisterSerializer, SocialLoginSerializer, UserSerializer
from .social_auth import (
    InvalidTokenError,
    UnverifiedEmailError,
    verify_apple_id_token,
    verify_google_id_token,
)

User = get_user_model()


class AuthThrottle(ScopedRateThrottle):
    scope = "auth"


def _make_jwt_pair_for_user(user) -> dict:
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/
    Returns: { access, refresh }
    """
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        tokens = _make_jwt_pair_for_user(user)
        return Response(tokens, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    POST /api/auth/login/
    Returns: { access, refresh }
    """
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        tokens = _make_jwt_pair_for_user(user)
        return Response(tokens, status=status.HTTP_200_OK)


class MeView(APIView):
    """
    GET/PATCH /api/auth/me/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        Profile.objects.get_or_create(user=request.user)
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        user = request.user
        username = (request.data.get("username") or "").strip()
        email = (request.data.get("email") or "").strip()
        full_name = (request.data.get("full_name") or "").strip()
        errors = {}

        if not username:
            errors["username"] = "Username is required."
        elif User.objects.exclude(pk=user.pk).filter(username__iexact=username).exists():
            errors["username"] = "This username is already in use."

        if not email:
            errors["email"] = "Email address is required."
        else:
            try:
                validate_email(email)
            except ValidationError:
                errors["email"] = "Enter a valid email address."
            if User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
                errors["email"] = "This email address is already in use."

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        user.username = username
        user.email = email
        if full_name:
            user.first_name = full_name
        user.save(update_fields=["username", "email", "first_name"])

        profile_fields = (
            "bio", "college", "course", "semester", "study_goal",
            "daily_study_goal", "target_grade", "main_goal",
            "preferred_study_time", "session_length", "learning_style", "coaching_style",
        )
        profile_data = {f: request.data.get(f) for f in profile_fields if f in request.data}
        if profile_data:
            profile, _ = Profile.objects.get_or_create(user=user)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()

        Profile.objects.get_or_create(user=user)
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        return self.patch(request)


def _unique_username(base: str) -> str:
    from django.utils.text import slugify

    slug = slugify(base) or "user"
    username = slug
    suffix = 1
    while User.objects.filter(username__iexact=username).exists():
        username = f"{slug}{suffix}"
        suffix += 1
    return username


class SocialLoginView(APIView):
    """
    POST /api/auth/social/
    { provider: "google" | "apple", id_token, nonce? }
    Returns: { access, refresh, is_new }
    """
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]

    def post(self, request):
        serializer = SocialLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        provider = serializer.validated_data["provider"]
        id_token = serializer.validated_data["id_token"]

        try:
            if provider == "google":
                claims = verify_google_id_token(id_token, settings.GOOGLE_OAUTH_CLIENT_ID)
            else:
                claims = verify_apple_id_token(
                    id_token,
                    settings.APPLE_CLIENT_ID,
                    expected_nonce=serializer.validated_data.get("nonce") or None,
                )
        except UnverifiedEmailError as exc:
            raise DRFValidationError({"email": str(exc)})
        except InvalidTokenError as exc:
            raise DRFValidationError({"id_token": str(exc)})

        email = (claims.get("email") or "").strip().lower()
        full_name = (claims.get("name") or "").strip()
        provider_sub = claims["sub"]

        if not email:
            email = f"{provider_sub}@privaterelay.{provider}.invalid"

        user = User.objects.filter(email__iexact=email).first()
        created = user is None
        if created:
            user = User.objects.create(
                username=_unique_username(email.split("@")[0]),
                email=email,
            )
            user.set_unusable_password()
            user.save(update_fields=["password"])
        if full_name and not user.first_name:
            user.first_name = full_name
            user.save(update_fields=["first_name"])

        Profile.objects.get_or_create(user=user)
        tokens = _make_jwt_pair_for_user(user)
        return Response({**tokens, "is_new": created}, status=status.HTTP_200_OK)

