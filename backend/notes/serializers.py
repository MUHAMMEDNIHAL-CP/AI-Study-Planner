from rest_framework import serializers
from .models import Note

class NoteSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True, default=None)

    class Meta:
        model = Note
        fields = ["id", "title", "content", "subject", "subject_name", "pinned", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at", "subject_name"]
