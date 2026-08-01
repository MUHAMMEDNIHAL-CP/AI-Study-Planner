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
