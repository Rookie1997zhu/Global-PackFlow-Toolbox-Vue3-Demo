from django.contrib import admin

from .models import Invitation, Membership, Team


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "locale", "currency", "status", "created_at")
    search_fields = ("name",)


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("team", "user", "role", "status", "created_at")
    list_filter = ("role", "status")


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "team", "role", "expires_at", "accepted_at", "revoked_at")
    search_fields = ("email",)
