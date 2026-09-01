from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "admin", "action", "target_user")
    list_filter = ("action",)
    search_fields = ("action", "admin__username", "target_user__username")
    readonly_fields = ("created_at",)