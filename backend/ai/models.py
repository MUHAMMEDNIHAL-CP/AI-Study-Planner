from django.conf import settings
from django.db import models
from django.db.models import F


class AIHistory(models.Model):
    FEATURE_CHOICES = [
        ("planner", "Planner"),
        ("tutor", "Tutor"),
        ("quiz", "Quiz"),
        ("burnout", "Burnout"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_history")
    feature = models.CharField(max_length=20, choices=FEATURE_CHOICES)
    provider = models.CharField(max_length=40, default="mock")
    prompt = models.TextField()
    response = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.feature} - {self.created_at:%Y-%m-%d %H:%M}"


class AIUsage(models.Model):
    """Per-user, per-day FLOX AI allowance ledger.

    Tracks how many free requests and ad-earned requests a user has consumed on
    a given day, plus approximate token usage. Used to enforce a per-user daily
    limit on the FLOX AI while keeping one shared Gemini project quota safe.

    Fields:
      free_used — free requests consumed
      ad_earned — ad-earned requests banked (watch-an-ad grants +AD_REWARD)
      ad_used   — ad-earned requests consumed
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_usage")
    date = models.DateField()
    free_used = models.PositiveIntegerField(default=0)
    ad_earned = models.PositiveIntegerField(default=0)
    ad_used = models.PositiveIntegerField(default=0)
    tokens_used = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "date"], name="unique_ai_usage_per_user_day"),
        ]

    def __str__(self):
        return f"{self.user} {self.date}: {self.total_used}"

    @property
    def total_used(self):
        return self.free_used + self.ad_used

    @property
    def ad_remaining(self):
        return max(0, self.ad_earned - self.ad_used)

    @classmethod
    def usage_for(cls, user, date):
        obj, _ = cls.objects.get_or_create(user=user, date=date)
        return obj

    @classmethod
    def consume(cls, user, date, *, ad=False, tokens=0):
        """Atomically increment a counter for the user/day row."""
        obj = cls.usage_for(user, date)
        if ad:
            cls.objects.filter(pk=obj.pk).update(ad_used=F("ad_used") + 1)
        else:
            cls.objects.filter(pk=obj.pk).update(free_used=F("free_used") + 1)
        if tokens:
            cls.objects.filter(pk=obj.pk).update(tokens_used=F("tokens_used") + tokens)
        return cls.usage_for(user, date)

    @classmethod
    def bank_ad(cls, user, date, amount):
        """Atomically add ad-earned credits for a user/day (up to the daily cap)."""
        obj = cls.usage_for(user, date)
        cls.objects.filter(pk=obj.pk).update(ad_earned=F("ad_earned") + amount)
        return cls.usage_for(user, date)


class AIProjectUsage(models.Model):
    """Aggregate, project-level FLOX usage ledger + configurable quota.

    One row per calendar day. This is the counterpart of the Gemini project
    quota (requests/day, tokens). Quota limits default from env but can be
    overridden in the DB so a super admin can raise/lower them at runtime.

    Rows are never deleted client-side; the scheduler/management command prunes
    old rows. Preflight checks consult the current-day row, reserving capacity
    before a Gemini call so concurrent users can't overshoot the project budget.
    """

    date = models.DateField(unique=True)
    requests_used = models.PositiveIntegerField(default=0)
    tokens_used = models.PositiveIntegerField(default=0)

    # Overridable quota. Null/0 means "fall back to env default".
    requests_limit = models.PositiveIntegerField(null=True, blank=True)
    tokens_limit = models.PositiveIntegerField(null=True, blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.date}: {self.requests_used} req / {self.tokens_used} tok"

    @classmethod
    def row_for(cls, date):
        obj, _ = cls.objects.get_or_create(date=date)
        return obj

    @classmethod
    def reserve(cls, date, *, requests=1, tokens=0):
        """Atomically add usage and return the (possibly first) row."""
        row = cls.row_for(date)
        cls.objects.filter(pk=row.pk).update(
            requests_used=F("requests_used") + requests,
            tokens_used=F("tokens_used") + tokens,
        )
        return cls.row_for(date)