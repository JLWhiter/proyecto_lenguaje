"""Servicio del motor de alertas: carga datos, ejecuta las reglas puras de
``core.alerts`` y sincroniza la tabla ``FinanceAlert``.

Cuándo se evalúa (de forma explícita, sin señales):

- ``refresh_alerts``: las vistas lo llaman después de cada operación exitosa
  que cambia movimientos o presupuestos, con los meses afectados.
- ``ensure_alerts``: al abrir el dashboard o las alertas, solo si el mes no se
  evaluó hoy (si ya está al día cuesta una sola consulta).
- ``evaluate_goal_alerts``: las vistas de metas lo llaman después de cada cambio
  en una meta o en sus aportes; ``ensure_alerts`` lo repite una vez al día
  (el progreso esperado de una meta avanza aunque no cambie nada).

Solo se generan alertas para el mes en curso y el anterior (``alerts.window_periods``);
las alertas del motor de meses más antiguos se eliminan. Evaluar un mes usa un
número fijo de consultas agregadas, sin importar cuántos presupuestos o
movimientos tenga el usuario.
"""

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from . import alerts
from goals.models import SavingsGoal

from .alerts import (
    DASHBOARD_TYPES,
    ENGINE_RULES,
    GOAL_PERIOD,
    GOAL_RULES,
    GOALS_SCOPE,
    AlertLevel,
    AlertRule,
    BudgetUsage,
    Expense,
    GoalProgress,
    MonthFlows,
)
from .analytics import SUMMARY_STATUSES
from .categories import category_key
from .models import AlertEvaluation, FinanceAlert, FinanceBudget, FinanceTransaction, MovementKind, MovementType, active_alert
from .periods import local_today, period_bounds, period_of, shift_month
from .transaction_filters import normalize_text

ZERO = Decimal("0.00")
ACTIVE, ALL = "activas", "todas"
FK_FIELDS = {"budget_id": "budget", "transaction_id": "transaction"}


# --- Carga de datos ------------------------------------------------------------

def recent_expenses(user, period):
    """Gastos REGULAR de ``period`` y de los 6 meses anteriores (historial de la regla de gasto inusual)."""
    start = period_bounds(shift_month(period, -alerts.HISTORY_MONTHS))[0]
    end = period_bounds(period)[1]
    rows = (
        FinanceTransaction.objects.filter(
            owner=user, kind=MovementKind.REGULAR, transaction_type=MovementType.EXPENSE, status__in=SUMMARY_STATUSES,
            occurred_at__gte=start, occurred_at__lt=end,
        )
        .order_by("occurred_at", "id")
        .values_list("id", "name", "category", "amount", "occurred_at")
    )
    return [Expense(pk, name, category, amount, timezone.localtime(moment).date()) for pk, name, category, amount, moment in rows]


def budget_usages(user, period, spent):
    rows = FinanceBudget.objects.filter(owner=user, month=period).order_by("id").values_list("id", "category", "limit_amount")
    return [BudgetUsage(pk, category, period, limit, spent.get(category_key(category), ZERO)) for pk, category, limit in rows]


def month_flows(user, period):
    """Ingresos (REGULAR + DEPOSIT) y gastos del mes, como en el resumen del dashboard."""
    totals = (
        FinanceTransaction.objects.filter(owner=user, kind__in=FinanceTransaction.SUMMARY_KINDS, status__in=SUMMARY_STATUSES)
        .in_period(period)
        .aggregate(
            income=Sum("amount", filter=Q(transaction_type=MovementType.INCOME)),
            expenses=Sum("amount", filter=Q(transaction_type=MovementType.EXPENSE)),
        )
    )
    return MonthFlows(period, totals["income"] or ZERO, totals["expenses"] or ZERO)


def goal_progress(goal, today):
    """Indicadores de una meta para las reglas puras de ``core.alerts``."""
    snapshot = goal.snapshot(today)
    return GoalProgress(
        id=goal.id,
        name=goal.name,
        target=goal.target_amount,
        saved=snapshot.saved,
        progress=snapshot.progress,
        expected=snapshot.expected,
        required_monthly=snapshot.required_monthly,
        target_date=goal.target_date,
        behind=snapshot.is_behind,
        reached=snapshot.is_reached,
    )


# --- Evaluación y sincronización -------------------------------------------------

def apply_plan(user, plan, now):
    if plan.create:
        FinanceAlert.objects.bulk_create(
            [FinanceAlert(owner=user, dedupe_key=candidate.key, created_at=now, **candidate.fields()) for candidate in plan.create],
            ignore_conflicts=True,  # otra petición simultánea ya la creó
        )
    if plan.update:
        changed = set()
        for alert, changes in plan.update:
            for name, value in changes.items():
                setattr(alert, name, value)
            changed.update(changes)
        FinanceAlert.objects.bulk_update([alert for alert, _ in plan.update], sorted(FK_FIELDS.get(name, name) for name in changed))
    if plan.delete:
        FinanceAlert.objects.filter(pk__in=plan.delete).delete()


def evaluate_alerts(user, period=None, *, today=None, now=None):
    """Evalúa las reglas para ``period`` ('AAAA-MM', por defecto el mes actual) y sincroniza las alertas.

    Crea las alertas nuevas, actualiza o escala las existentes y elimina las
    del mes cuya condición ya no se cumple. Devuelve el ``SyncPlan`` aplicado.
    Fuera de la ventana (meses anteriores al mes pasado) no hace nada.
    """
    today = today or local_today()
    now = now or timezone.now()
    period = period or period_of(today)
    if not alerts.in_window(period, today):
        return alerts.SyncPlan()
    currency = getattr(user, "currency", "PEN")
    with transaction.atomic():
        expenses = recent_expenses(user, period)
        budgets = budget_usages(user, period, alerts.spent_by_category(expenses, period))
        candidates = alerts.evaluate_rules(budgets, expenses, month_flows(user, period), period, today, currency)
        keys = [candidate.key for candidate in candidates]
        stored = FinanceAlert.objects.filter(owner=user).filter(Q(period=period, rule__in=ENGINE_RULES) | Q(dedupe_key__in=keys))
        plan = alerts.reconcile(list(stored), candidates, period, now)
        apply_plan(user, plan, now)
        expired = FinanceAlert.objects.filter(owner=user, rule__in=ENGINE_RULES, period__lt=alerts.window_periods(today)[0])
        expired.exclude(period="").delete()
        mark_evaluated(user, period, now, currency)
    return plan


def mark_evaluated(user, scope, now, currency):
    """Registra cuándo (y con qué moneda) se evaluó ``scope``: un mes 'AAAA-MM' o ``GOALS_SCOPE``."""
    AlertEvaluation.objects.bulk_create(
        [AlertEvaluation(owner=user, period=scope, evaluated_at=now, currency=currency)],
        update_conflicts=True, unique_fields=["owner", "period"], update_fields=["evaluated_at", "currency"],
    )


def evaluate_goal_alerts(user, *, today=None, now=None):
    """Evalúa las reglas de metas para las metas activas del usuario y sincroniza sus alertas.

    Crea las alertas nuevas, actualiza las existentes y elimina las de metas que
    ya no cumplen la condición (o que se archivaron o eliminaron). Devuelve el ``SyncPlan``.
    """
    today = today or local_today()
    now = now or timezone.now()
    currency = getattr(user, "currency", "PEN")
    with transaction.atomic():
        goals = SavingsGoal.objects.filter(owner=user).active().with_contributions()
        candidates = alerts.goal_alerts([goal_progress(goal, today) for goal in goals], currency)
        stored = FinanceAlert.objects.filter(owner=user, rule__in=GOAL_RULES)
        plan = alerts.reconcile(list(stored), candidates, GOAL_PERIOD, now)
        apply_plan(user, plan, now)
        mark_evaluated(user, GOALS_SCOPE, now, currency)
    return plan


def refresh_alerts(user, periods, *, today=None, now=None):
    """Reevalúa los meses afectados por una operación (y los posteriores que los usan como historial)."""
    today = today or local_today()
    for period in alerts.affected_periods(periods, today):
        evaluate_alerts(user, period, today=today, now=now)


def ensure_alerts(user, period=None, *, today=None, now=None):
    """Evaluación perezosa: evalúa el mes pedido (y el anterior si es el actual) solo si hace falta.

    Devuelve los meses que se evaluaron.
    """
    today = today or local_today()
    periods = alerts.lazy_periods(period, today)
    currency = getattr(user, "currency", "PEN")
    marks = evaluation_marks(user, [*periods, GOALS_SCOPE], currency)
    stale = [period for period in periods if period not in marks or alerts.needs_evaluation(period, marks[period], today)]
    for period in stale:
        evaluate_alerts(user, period, today=today, now=now)
    if alerts.needs_goal_evaluation(marks.get(GOALS_SCOPE), today):
        evaluate_goal_alerts(user, today=today, now=now)
    return stale


def evaluation_marks(user, scopes, currency):
    """{scope: día local de su última evaluación} en una consulta; omite los evaluados con otra moneda."""
    rows = AlertEvaluation.objects.filter(owner=user, period__in=scopes).values_list("period", "evaluated_at", "currency")
    return {scope: timezone.localtime(moment).date() for scope, moment, evaluated_currency in rows if evaluated_currency == currency}


# --- Respuestas de la API ---------------------------------------------------------

def local_iso(moment):
    return timezone.localtime(moment).isoformat(timespec="seconds") if moment else None


def is_active(alert, now):
    return not alert.dismissed and (alert.snoozed_until is None or alert.snoozed_until <= now)


def serialize_alert(alert, now):
    rule = alert.get_rule_display()
    return {
        "id": alert.id,
        "regla": alert.rule,
        "tipo": rule,
        "categoria": rule,
        "badge": rule,
        "titulo": alert.title,
        "descripcion": alert.description,
        "nivel": alert.level,
        "tiempo": alerts.relative_time(timezone.localtime(alert.created_at), timezone.localtime(now)),
        "creada": local_iso(alert.created_at),
        "leida": alert.is_read,
        "descartada": alert.dismissed,
        "pospuesta_hasta": local_iso(alert.snoozed_until) if alert.snoozed_until and alert.snoozed_until > now else None,
        "activa": is_active(alert, now),
        "porcentaje": alert.percentage,
        "periodo": alert.period or None,
        "accion": {"label": alert.action_label, "type": None, "id": None, **alert.action},
    }


def rule_filter(tipo):
    """Condición para ``?tipo=``: código o etiqueta de una regla, o un nivel. ``None`` si no coincide con nada."""
    key = normalize_text(tipo)
    if key in ("", "todas", "todos"):
        return Q()
    for rule in AlertRule:
        if key in (rule.value, normalize_text(rule.label)):
            return Q(rule=rule)
    for level in AlertLevel:
        if key in (level.value, normalize_text(level.label)):
            return Q(level=level)
    return None


def alert_counts(user, now):
    """Conteos por regla en una sola consulta: total, activas y activas sin leer."""
    active = active_alert(now)
    rows = (
        FinanceAlert.objects.filter(owner=user)
        .order_by()
        .values("rule")
        .annotate(total=Count("id"), activas=Count("id", filter=active), no_leidas=Count("id", filter=active & Q(is_read=False)))
    )
    return {row["rule"]: row for row in rows}


def alerts_payload(user, estado=ACTIVE, tipo="", now=None):
    now = now or timezone.now()
    by_rule = alert_counts(user, now)
    counts = {name: sum(row[name] for row in by_rule.values()) for name in ("activas", "no_leidas", "total")}
    scope = "activas" if estado == ACTIVE else "total"

    def shown(rule):
        return by_rule.get(rule, {}).get(scope, 0)

    # Las reglas de metas y "General" solo aparecen como filtro si tienen alertas.
    rules = [*ENGINE_RULES, *(rule for rule in (*GOAL_RULES, AlertRule.OTHER) if shown(rule))]
    condition = rule_filter(tipo)
    rows = FinanceAlert.objects.filter(owner=user)
    if estado == ACTIVE:
        rows = rows.active(now)
    return {
        "estado": estado,
        "tipo": tipo,
        "counts": counts,
        "filters": [f"Todas ({counts[scope]})", *(f"{rule.label} ({shown(rule)})" for rule in rules)],
        "items": [] if condition is None else [serialize_alert(alert, now) for alert in rows.filter(condition)],
    }


def dashboard_alert(alert, now):
    """Alerta del dashboard: ``tipo`` (danger|warning|info) y ``accion`` (texto) como los lee la interfaz actual."""
    item = serialize_alert(alert, now)
    return {**item, "tipo": DASHBOARD_TYPES.get(alert.level, "info"), "accion": alert.action_label, "accion_detalle": item["accion"]}


def dashboard_alerts(user, now=None, limit=3):
    """Las ``limit`` alertas activas más importantes (nivel y luego la más reciente) y el total de activas."""
    now = now or timezone.now()
    active = list(FinanceAlert.objects.filter(owner=user).active(now))
    return [dashboard_alert(alert, now) for alert in active[:limit]], len(active)


def apply_alert_action(alert, action, *, hours=alerts.DEFAULT_SNOOZE_HOURS, now=None):
    """Aplica una acción del usuario (leer, descartar, posponer...) y devuelve el mensaje para la respuesta."""
    changes, message = alerts.alert_action_changes(action, now or timezone.now(), hours)
    for name, value in changes.items():
        setattr(alert, name, value)
    alert.save(update_fields=list(changes))
    return message


def snooze_all(user, *, hours=alerts.DEFAULT_SNOOZE_HOURS, now=None):
    """Pospone todas las alertas activas ``hours`` horas (no las descarta). Devuelve ``(cantidad, hasta)``."""
    now = now or timezone.now()
    until = now + timedelta(hours=hours)
    count = FinanceAlert.objects.filter(owner=user).active(now).update(snoozed_until=until, is_read=True)
    return count, until
