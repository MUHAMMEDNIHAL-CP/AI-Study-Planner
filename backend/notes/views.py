from rest_framework import generics
from .models import Note
from .serializers import NoteSerializer

class NoteListCreateView(generics.ListCreateAPIView):
    serializer_class = NoteSerializer

    def get_queryset(self):
        return Note.objects.filter(user=self.request.user).select_related("subject")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class NoteDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = NoteSerializer

    def get_queryset(self):
        return Note.objects.filter(user=self.request.user).select_related("subject")
