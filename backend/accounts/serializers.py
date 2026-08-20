from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Profile

User = get_user_model()


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ("bio", "college", "course", "semester", "study_goal", "daily_study_goal", "target_grade", "main_goal")


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(required=False)

    class Meta:
        model = User
        fields = ("id", "username", "email", "profile")

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


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ("username", "email", "password")

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        Profile.objects.create(user=user)
        return user


class LoginSerializer(serializers.Serializer):
    credential = serializers.CharField(required=True)
    password = serializers.CharField(required=True)

    def validate(self, attrs):
        credential = attrs.get("credential", "").strip()
        password = attrs.get("password")

        if not credential:
            raise serializers.ValidationError({"credential": "Enter your username or email."})

        # Accept either a username or an email address.
        request_user = User.objects.filter(
            username__iexact=credential
        ).first() or User.objects.filter(email__iexact=credential).first()

        if not request_user:
            raise serializers.ValidationError("Invalid credentials.")

        if not request_user.check_password(password):
            raise serializers.ValidationError("Invalid credentials.")

        attrs["user"] = request_user
        return attrs
