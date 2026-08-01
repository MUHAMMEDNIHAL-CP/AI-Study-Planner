from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LoginSerializer, RegisterSerializer

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
        user = request.user
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request):
        user = request.user
        username = (request.data.get("username") or "").strip()
        email = (request.data.get("email") or "").strip()
        errors = {}

        if not username:
            errors["username"] = "Full name is required."
        elif User.objects.exclude(pk=user.pk).filter(username__iexact=username).exists():
            errors["username"] = "This name is already in use."

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
        user.save(update_fields=["username", "email"])
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        return self.patch(request)

