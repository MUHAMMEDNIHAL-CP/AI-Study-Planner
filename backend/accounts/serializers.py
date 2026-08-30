from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Profile

User = get_user_model()


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = (
            "bio", "education_level", "college", "course", "semester", "study_goal",
            "daily_study_goal", "target_grade", "main_goal",
            "preferred_study_time", "session_length", "learning_style", "coaching_style",
        )


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(required=False)
    full_name = serializers.CharField(source="first_name", read_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "full_name", "profile")

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", None)
        instance.username = validated_data.get("username", instance.username)
        instance.email = validated_data.get("email", instance.email)
        instance.save(update_fields=["username", "email"])

        if profile_data is not None:
            profile, _ = Profile.objects.get_or_create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()

        return instance


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])

    def validate_email(self, value):
        email = (value or "").strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def create(self, validated_data):
        from django.utils.text import slugify

        email = validated_data["email"].lower()
        full_name = (validated_data.get("full_name") or "").strip()
        base = slugify(email.split("@")[0]) or "user"
        username = base
        suffix = 1
        while User.objects.filter(username__iexact=username).exists():
            username = f"{base}{suffix}"
            suffix += 1
        user = User.objects.create_user(
            username=username,
            email=email,
            password=validated_data["password"],
            first_name=full_name,
        )
        Profile.objects.create(user=user)
        return user


class SocialLoginSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=[("google", "google"), ("apple", "apple")])
    id_token = serializers.CharField(required=True, write_only=True)
    nonce = serializers.CharField(required=False, allow_blank=True, write_only=True)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True)

    def validate(self, attrs):
        email = (attrs.get("email") or "").strip().lower()
        password = attrs.get("password")

        if not email:
            raise serializers.ValidationError({"email": "Enter your email."})

        request_user = User.objects.filter(email__iexact=email).first()

        if not request_user:
            raise serializers.ValidationError("Invalid email or password.")

        if not request_user.check_password(password):
            raise serializers.ValidationError("Invalid email or password.")

        attrs["user"] = request_user
        return attrs
