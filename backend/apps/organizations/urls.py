from django.urls import path

from .views import (
    InvitationAcceptView,
    TeamDetailView,
    TeamInvitationCreateView,
    TeamListCreateView,
    TeamMembersView,
)

urlpatterns = [
    path("teams/", TeamListCreateView.as_view(), name="team-list-create"),
    path("teams/<uuid:team_id>/", TeamDetailView.as_view(), name="team-detail"),
    path(
        "teams/<uuid:team_id>/members/",
        TeamMembersView.as_view(),
        name="team-members",
    ),
    path(
        "teams/<uuid:team_id>/invitations/",
        TeamInvitationCreateView.as_view(),
        name="team-invitations",
    ),
    path(
        "invitations/accept/",
        InvitationAcceptView.as_view(),
        name="invitation-accept",
    ),
]
