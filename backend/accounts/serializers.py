from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


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
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False)
    password = serializers.CharField(required=True)

    def validate(self, attrs):
        username = (attrs.get("username") or "").strip()
        email = (attrs.get("email") or "").strip()
        password = attrs.get("password")

        if not username and not email:
            raise serializers.ValidationError("Provide either username or email.")

        request_user = None
        if username:
            request_user = User.objects.filter(username=username).first()
        else:
            request_user = User.objects.filter(email=email).first()

        if not request_user or not request_user.check_password(password):
            raise serializers.ValidationError("Invalid credentials.")

        attrs["user"] = request_user
        return attrs
