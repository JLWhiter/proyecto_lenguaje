from django.urls import path

from .views import ContributionDetailView, ContributionListView, GoalDetailView, GoalListView

urlpatterns = [
    path("metas/", GoalListView.as_view(), name="metas"),
    path("metas/<int:pk>/", GoalDetailView.as_view(), name="meta-detalle"),
    path("metas/<int:pk>/aportes/", ContributionListView.as_view(), name="meta-aportes"),
    path("metas/<int:pk>/aportes/<int:aid>/", ContributionDetailView.as_view(), name="meta-aporte-detalle"),
]
