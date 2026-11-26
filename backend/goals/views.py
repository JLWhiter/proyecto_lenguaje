import logging

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from core.alert_service import evaluate_goal_alerts
from core.views import FinanceAPIView, success

from .exceptions import AhorroInsuficienteError
from .models import ContributionKind, SavingsGoal
from .serializers import ContributionSerializer, GoalCreateSerializer, GoalListQuerySerializer, GoalUpdateSerializer
from .services import fresh_goal, goal_detail, goals_payload, serialize_goal

logger = logging.getLogger(__name__)

GOAL_NOT_FOUND = "Meta no encontrada."
CONTRIBUTION_NOT_FOUND = "Movimiento de la meta no encontrado."
ARCHIVE_MESSAGES = {True: "Meta archivada.", False: "Meta restaurada."}
RECORDED_MESSAGES = {ContributionKind.DEPOSIT: "Aporte registrado.", ContributionKind.WITHDRAWAL: "Retiro registrado."}


class GoalAPIView(FinanceAPIView):
    """Base de la API de metas: metas del usuario de la sesión y reevaluación de sus alertas."""

    def goal(self, pk):
        return self.owned(SavingsGoal.objects.with_contributions(), pk, GOAL_NOT_FOUND)

    def validated_for(self, serializer_class, data, **context):
        serializer = serializer_class(data=data, context={"request": self.request, **context})
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    def refresh_goal_alerts(self):
        """Como ``FinanceAPIView.refresh_alerts``: si el motor falla, la operación ya guardada no responde error."""
        try:
            evaluate_goal_alerts(self.request.user)
        except Exception:
            logger.exception("No se pudieron actualizar las alertas de metas del usuario %s", self.request.user.pk)


class GoalListView(GoalAPIView):
    """``GET /metas/?estado=activas|archivadas`` y ``POST /metas/``."""

    def get(self, request):
        estado = self.validated(GoalListQuerySerializer, request.query_params)["estado"]
        return Response(goals_payload(request.user, estado, timezone.localdate()))

    def post(self, request):
        values = self.validated(GoalCreateSerializer, request.data)
        goal = SavingsGoal.start(request.user, **values)
        self.refresh_goal_alerts()
        return success("Meta creada.", goal_detail(fresh_goal(goal), timezone.localdate()), status.HTTP_201_CREATED)


class GoalDetailView(GoalAPIView):
    """``GET``, ``PATCH`` (nombre, descripción, ícono, objetivo, fecha, archivada) y ``DELETE /metas/<id>/``."""

    def get(self, request, pk):
        return Response(goal_detail(self.goal(pk), timezone.localdate()))

    def patch(self, request, pk):
        goal = self.goal(pk)
        values = self.validated(GoalUpdateSerializer, request.data, instance=goal, partial=True)
        archived_before = goal.archived
        for field, value in values.items():
            setattr(goal, field, value)
        goal.save()
        self.refresh_goal_alerts()
        message = ARCHIVE_MESSAGES[goal.archived] if goal.archived != archived_before else "Meta actualizada."
        return success(message, serialize_goal(goal, timezone.localdate()))

    def delete(self, request, pk):
        self.goal(pk).delete()
        self.refresh_goal_alerts()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ContributionListView(GoalAPIView):
    """``POST /metas/<id>/aportes/`` con ``tipo`` APORTE | RETIRO, ``amount``, ``occurred_at?`` y ``note?``."""

    def post(self, request, pk):
        goal = self.goal(pk)
        values = self.validated_for(ContributionSerializer, request.data, goal=goal)
        register = goal.contribute if values["tipo"] == ContributionKind.DEPOSIT else goal.withdraw
        try:
            register(values["amount"], occurred_at=values.get("occurred_at"), note=values["note"])
        except AhorroInsuficienteError as error:
            raise serializers.ValidationError({"amount": [str(error)]}) from error
        self.refresh_goal_alerts()
        return success(RECORDED_MESSAGES[values["tipo"]], goal_detail(fresh_goal(goal), timezone.localdate()), status.HTTP_201_CREATED)


class ContributionDetailView(GoalAPIView):
    """``DELETE /metas/<id>/aportes/<aid>/``."""

    def delete(self, request, pk, aid):
        goal = self.goal(pk)
        contribution = goal.contributions.filter(pk=aid).first()
        if contribution is None:
            raise NotFound(CONTRIBUTION_NOT_FOUND)
        contribution.cancel()
        self.refresh_goal_alerts()
        return Response(status=status.HTTP_204_NO_CONTENT)
