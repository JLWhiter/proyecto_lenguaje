"""Respuestas JSON de la API de metas (capa entre los modelos y las vistas)."""

from decimal import Decimal

from . import planning
from .models import SavingsGoal
from .serializers import ACTIVE

ZERO = Decimal("0.00")


def serialize_goal(goal, today):
    """``<meta>``: datos de la meta e indicadores calculados por ``goals.planning``."""
    snapshot = goal.snapshot(today)
    return {
        "id": goal.id,
        "nombre": goal.name,
        "descripcion": goal.description,
        "icono": goal.icon,
        "objetivo": goal.target_amount,
        "ahorrado": snapshot.saved,
        "restante": snapshot.remaining,
        "porcentaje": snapshot.progress,
        "fecha_objetivo": goal.target_date.isoformat(),
        "meses_restantes": snapshot.months_left,
        "ahorro_mensual_necesario": snapshot.required_monthly,
        "porcentaje_esperado": snapshot.expected,
        "estado": snapshot.status,
        "estado_color": snapshot.color,
        "fecha_estimada": snapshot.estimated.isoformat() if snapshot.estimated else None,
        "archivada": goal.archived,
        "creada": goal.created_on.isoformat(),
    }


def serialize_contribution(contribution):
    return {
        "id": contribution.id,
        "tipo": contribution.kind,
        "monto": contribution.amount,
        "fecha": contribution.occurred_at.isoformat(),
        "nota": contribution.note,
    }


def goal_detail(goal, today):
    """``<meta>`` con su historial (más reciente primero) y la serie de los últimos 12 meses."""
    contributions = list(goal.contributions.all())
    return {
        **serialize_goal(goal, today),
        "aportes": [serialize_contribution(item) for item in contributions],
        "serie_mensual": planning.monthly_series(goal.movements(), today),
    }


def summary(cards):
    """Totales de las metas activas; ``alcanzadas`` cuenta también las archivadas (metas cumplidas)."""
    active = [card for card in cards if not card["archivada"]]
    return {
        "total_objetivo": sum((card["objetivo"] for card in active), ZERO),
        "total_ahorrado": sum((card["ahorrado"] for card in active), ZERO),
        "metas_activas": len(active),
        "alcanzadas": sum(card["estado"] == planning.REACHED for card in cards),
    }


def goals_payload(user, estado, today):
    """``GET /metas/``: resumen y metas activas o archivadas (dos consultas en total)."""
    cards = [serialize_goal(goal, today) for goal in SavingsGoal.objects.filter(owner=user).with_contributions()]
    archived = estado != ACTIVE
    return {"resumen": summary(cards), "metas": [card for card in cards if card["archivada"] == archived]}


def fresh_goal(goal):
    """La meta recargada con sus movimientos (después de registrar o eliminar uno)."""
    return SavingsGoal.objects.with_contributions().get(pk=goal.pk)
