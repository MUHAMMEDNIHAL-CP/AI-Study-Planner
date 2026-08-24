from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Profile
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer

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

