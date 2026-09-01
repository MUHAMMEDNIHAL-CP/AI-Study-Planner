from django.contrib import admin

from .models import AIHistory, AIProjectUsage, AIUsage


@admin.register(AIHistory)
class AIHistoryAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "feature", "provider", "created_at")
    list_filter = ("feature", "provider")
    search_fields = ("user__username", "prompt")
    date_hierarchy = "created_at"


@admin.register(AIUsage)
class AIUsageAdmin(admin.ModelAdmin):
    list_display = ("user", "date", "free_used", "ad_used", "tokens_used")
    list_filter = ("date",)
    search_fields = ("user__username",)


@admin.register(AIProjectUsage)
class AIProjectUsageAdmin(admin.ModelAdmin):
    list_display = ("date", "requests_used", "tokens_used", "requests_limit", "tokens_limit")
    list_filter = ("date",)