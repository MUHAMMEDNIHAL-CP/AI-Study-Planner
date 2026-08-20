from django.conf import settings
from django.db import models


class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    bio = models.TextField(blank=True, default="")
    college = models.CharField(max_length=255, blank=True, default="")
    course = models.CharField(max_length=255, blank=True, default="")
    semester = models.PositiveIntegerField(default=1)
    study_goal = models.CharField(max_length=500, blank=True, default="")
    daily_study_goal = models.PositiveIntegerField(default=4)
    target_grade = models.CharField(max_length=10, blank=True, default="")
    main_goal = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "accounts_profile"

    def __str__(self):
        return f"Profile({self.user.username})"
