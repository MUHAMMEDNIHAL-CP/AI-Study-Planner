from django.conf import settings
from django.db import models

class Note(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notes")
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True, default="")
    subject = models.ForeignKey("study.Subject", on_delete=models.SET_NULL, null=True, blank=True, related_name="notes")
    pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-pinned", "-updated_at"]

    def __str__(self):
        return self.title
