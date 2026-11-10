from django.contrib import admin

from .models import CalculationJob, UsageReservation


@admin.register(CalculationJob)
class CalculationJobAdmin(admin.ModelAdmin):
    list_display = ("id", "engine", "status", "team", "created_at")
    list_filter = ("status", "engine")


@admin.register(UsageReservation)
class UsageReservationAdmin(admin.ModelAdmin):
    list_display = ("id", "team", "job", "status", "units", "created_at")
    list_filter = ("status",)
