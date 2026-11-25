"""Reglas del motor de alertas (sin base de datos).

Cada regla es una función pura con estilo funcional: recibe datos simples
(dataclasses con montos ``Decimal`` y fechas locales) y devuelve una lista de
``AlertCandidate``. Ninguna consulta ni modifica la base de datos: eso lo hace
``core.alert_service``, que carga los datos, llama a ``evaluate_rules`` y aplica
el plan de ``reconcile``. Por eso se prueban con ``unittest`` sin Django:
``python -m unittest core.test_alerts``.

Reglas y umbrales:

- Umbral de presupuesto (``budget_threshold``), una alerta por presupuesto
  mensual que escala: ≥ 75 % warning, ≥ 90 % danger, > 100 % danger
  "Presupuesto excedido" (mismos cortes que el estado del presupuesto).
- Ritmo de gasto (``budget_projection``), solo el mes en curso y desde el día
  ``PROJECTION_FROM_DAY``: proyección lineal > límite y gastado ≤ 100 % → warning.
- Gasto inusual (``atypical_expense``): gasto REGULAR > media + 2σ (NumPy,
  desviación muestral) de los gastos REGULAR de su categoría en los 6 meses
  anteriores, con al menos 5 muestras → info (warning si supera media + 3σ).
- Mes en negativo (``negative_month``): gastos > ingresos (REGULAR + DEPOSIT)
  del mes, desde el día 21 del mes en curso o en un mes cerrado → warning.
"""

from dataclasses import asdict, dataclass, field
from datetime import date, timedelta
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal
from functools import partial

import numpy as np
from django.db.models import TextChoices

from .budgets import CAUTION, CRITICAL, EXCEEDED, budget_state, projected_spending, usage_percentage
from .periods import days_remaining, first_day, period_label, period_of, shift_month, short_date
from .transaction_filters import normalize_text

ZERO = Decimal("0.00")
TEN = Decimal("10")
HISTORY_MONTHS = 6
MIN_SAMPLES = 5
ATYPICAL_SIGMAS = 2
STRONG_ATYPICAL_SIGMAS = 3
PROJECTION_FROM_DAY = 5
NEGATIVE_MONTH_AFTER_DAY = 20
WINDOW_MONTHS = 2
CURRENCY_SYMBOLS = {"PEN": "S/", "USD": "$", "EUR": "€"}


class AlertRule(TextChoices):
    """Regla que generó la alerta. La etiqueta es la que ve el usuario en los filtros."""

    BUDGET_THRESHOLD = "budget_threshold", "Presupuesto"
    BUDGET_PROJECTION = "budget_projection", "Ritmo de gasto"
    ATYPICAL_EXPENSE = "atypical_expense", "Gasto inusual"
    NEGATIVE_MONTH = "negative_month", "Balance mensual"
    OTHER = "other", "General"


class AlertLevel(TextChoices):
    INFO = "info", "Información"
    WARNING = "warning", "Advertencia"
    DANGER = "danger", "Urgente"
    SUCCESS = "success", "Logro"


ENGINE_RULES = (AlertRule.BUDGET_THRESHOLD, AlertRule.BUDGET_PROJECTION, AlertRule.ATYPICAL_EXPENSE, AlertRule.NEGATIVE_MONTH)
SEVERITY = {AlertLevel.SUCCESS: 0, AlertLevel.INFO: 1, AlertLevel.WARNING: 2, AlertLevel.DANGER: 3}
EXCEEDED_SEVERITY = 4
DASHBOARD_TYPES = {AlertLevel.DANGER: "danger", AlertLevel.WARNING: "warning", AlertLevel.INFO: "info", AlertLevel.SUCCESS: "info"}
ENGINE_FIELDS = (
    "rule", "level", "severity", "period", "title", "description",
    "action_label", "action", "percentage", "budget_id", "transaction_id",
)


# --- Datos de entrada y salida ----------------------------------------------

@dataclass(frozen=True)
class BudgetUsage:
    """Presupuesto de un mes con lo gastado en su categoría."""

    id: int
    category: str
    month: str
    limit: Decimal
    spent: Decimal


@dataclass(frozen=True)
class Expense:
    """Gasto REGULAR con su fecha local."""

    id: int
    name: str
    category: str
    amount: Decimal
    day: date


@dataclass(frozen=True)
class MonthFlows:
    """Ingresos (REGULAR + DEPOSIT) y gastos (REGULAR) de un mes."""

    month: str
    income: Decimal
    expenses: Decimal


@dataclass(frozen=True)
class AlertCandidate:
    """Alerta que una regla quiere que exista; ``key`` la identifica entre evaluaciones."""

    key: str
    rule: str
    level: str
    severity: int
    period: str
    title: str
    description: str
    action_label: str
    action: dict = field(default_factory=dict, hash=False)
    percentage: float | None = None
    budget_id: int | None = None
    transaction_id: int | None = None

    def fields(self):
        """Valores de los campos de ``FinanceAlert`` que controla el motor."""
        values = asdict(self)
        return {name: values[name] for name in ENGINE_FIELDS}


@dataclass(frozen=True)
class SyncPlan:
    """Qué hacer con las alertas guardadas: crear, actualizar (alerta, cambios) y eliminar (ids)."""

    create: tuple = ()
    update: tuple = ()
    delete: tuple = ()


# --- Formato -----------------------------------------------------------------

def money(amount, currency="PEN"):
    """Decimal('1234.5') -> 'S/ 1,234.50' (símbolo según la moneda del usuario)."""
    symbol = CURRENCY_SYMBOLS.get(currency, "S/")
    sign = "-" if amount < 0 else ""
    return f"{sign}{symbol} {abs(Decimal(amount)):,.2f}"


def percent_text(value):
    """82.46 -> '82.5'; 75.0 -> '75' (mismo redondeo a un decimal que el porcentaje de los presupuestos)."""
    return f"{round(value, 1):.1f}".removesuffix(".0")


def days_left_text(days):
    return "el último día del mes" if days == 1 else f"los {days} días que quedan del mes"


def round_up_to_ten(amount):
    return (amount / TEN).to_integral_value(rounding=ROUND_CEILING) * TEN


def round_down_to_ten(amount):
    return (amount / TEN).to_integral_value(rounding=ROUND_FLOOR) * TEN


def relative_time(moment, now):
    """Tiempo transcurrido en español: 'Ahora', 'Hace 15 min', 'Hace 3 h', 'Ayer', '12 Nov' o '12 Nov 2025'.

    ``moment`` y ``now`` son datetimes en la hora local del usuario.
    """
    seconds = (now - moment).total_seconds()
    if seconds < 60:
        return "Ahora"
    if seconds < 3600:
        return f"Hace {int(seconds // 60)} min"
    if moment.date() == now.date():
        return f"Hace {int(seconds // 3600)} h"
    if moment.date() == now.date() - timedelta(days=1):
        return "Ayer"
    text = short_date(moment.date())
    return text if moment.year == now.year else f"{text} {moment.year}"


# --- Reglas ------------------------------------------------------------------

def budget_action(budget, label):
    return {"action_label": label, "action": {"type": "budget", "id": budget.id, "mes": budget.month}, "budget_id": budget.id}


def threshold_alert(budget, today, currency="PEN"):
    """Alerta de umbral para un presupuesto, o ``None`` si va por debajo del 75 %."""
    percentage = usage_percentage(budget.spent, budget.limit)
    state = budget_state(percentage)
    if state not in (CAUTION, CRITICAL, EXCEEDED):
        return None
    fmt = partial(money, currency=currency)
    spent, limit, category, shown = fmt(budget.spent), fmt(budget.limit), budget.category, percent_text(percentage)
    closed = budget.month < period_of(today)

    if state is EXCEEDED:
        level, severity, label = AlertLevel.DANGER, EXCEEDED_SEVERITY, "Ajustar presupuesto"
        title = f"Presupuesto excedido: {category}"
        over = fmt(budget.spent - budget.limit)
        description = (
            f"Cerraste {period_label(budget.month)} con {spent} gastados de {limit}: te pasaste por {over}."
            if closed
            else f"Llevas {spent} de {limit} ({shown}%): te pasaste por {over}. "
            "Ajusta el límite o rebalancea desde otro presupuesto."
        )
    else:
        level = AlertLevel.WARNING if state is CAUTION else AlertLevel.DANGER
        severity, label = SEVERITY[level], "Ver presupuesto" if state is CAUTION else "Revisar presupuesto"
        title = (
            f"Presupuesto de {category} agotado"
            if budget.spent == budget.limit
            else f"Presupuesto de {category} al {shown}%"
        )
        remaining = fmt(budget.limit - budget.spent)
        description = (
            f"Cerraste {period_label(budget.month)} con {spent} gastados de {limit} ({shown}%)."
            if closed
            else f"Llevas {spent} de {limit}. Te quedan {remaining} para {days_left_text(days_remaining(budget.month, today))}."
        )
    return AlertCandidate(
        key=f"{AlertRule.BUDGET_THRESHOLD.value}:{budget.id}",
        rule=AlertRule.BUDGET_THRESHOLD,
        level=level,
        severity=severity,
        period=budget.month,
        title=title,
        description=description,
        percentage=round(percentage, 1),
        **budget_action(budget, label),
    )


def projection_alert(budget, today, currency="PEN"):
    """Alerta de ritmo de gasto (mes en curso): la proyección supera el límite sin haberlo superado aún."""
    if budget.month != period_of(today) or today.day < PROJECTION_FROM_DAY or budget.spent > budget.limit:
        return None
    projection = projected_spending(budget.spent, budget.month, today)
    if projection <= budget.limit:
        return None
    fmt = partial(money, currency=currency)
    return AlertCandidate(
        key=f"{AlertRule.BUDGET_PROJECTION.value}:{budget.id}",
        rule=AlertRule.BUDGET_PROJECTION,
        level=AlertLevel.WARNING,
        severity=SEVERITY[AlertLevel.WARNING],
        period=budget.month,
        title=f"Al ritmo actual superarás tu presupuesto de {budget.category}",
        description=(
            f"Llevas {fmt(budget.spent)} de {fmt(budget.limit)} y, a este ritmo, cerrarás el mes con "
            f"{fmt(projection)} ({fmt(projection - budget.limit)} por encima del límite)."
        ),
        percentage=round(usage_percentage(budget.spent, budget.limit), 1),
        **budget_action(budget, "Ver presupuesto"),
    )


def budget_threshold_alerts(budgets, today, currency="PEN"):
    return list(filter(None, map(partial(threshold_alert, today=today, currency=currency), budgets)))


def projected_overrun_alerts(budgets, today, currency="PEN"):
    return list(filter(None, map(partial(projection_alert, today=today, currency=currency), budgets)))


def in_month(month):
    return lambda expense: period_of(expense.day) == month


def history_by_category(expenses, period, months=HISTORY_MONTHS):
    """Montos (float64) de los gastos de los ``months`` meses previos a ``period``, por categoría normalizada."""
    window = {shift_month(period, -offset) for offset in range(1, months + 1)}
    grouped = {}
    for expense in filter(lambda item: period_of(item.day) in window, expenses):
        grouped.setdefault(normalize_text(expense.category), []).append(float(expense.amount))
    return {key: np.asarray(amounts, dtype=np.float64) for key, amounts in grouped.items()}


def atypical_alert(expense, history, currency="PEN"):
    """Alerta si ``expense`` supera media + 2σ de su categoría (con al menos ``MIN_SAMPLES`` muestras)."""
    samples = history.get(normalize_text(expense.category))
    if samples is None or samples.size < MIN_SAMPLES:
        return None
    mean, sigma = float(np.mean(samples)), float(np.std(samples, ddof=1))
    amount = float(expense.amount)
    if amount <= mean + ATYPICAL_SIGMAS * sigma:
        return None
    level = AlertLevel.WARNING if amount > mean + STRONG_ATYPICAL_SIGMAS * sigma else AlertLevel.INFO
    fmt = partial(money, currency=currency)
    usual = Decimal(str(round(mean + ATYPICAL_SIGMAS * sigma, 2)))
    period = period_of(expense.day)
    return AlertCandidate(
        key=f"{AlertRule.ATYPICAL_EXPENSE.value}:{expense.id}",
        rule=AlertRule.ATYPICAL_EXPENSE,
        level=level,
        severity=SEVERITY[level],
        period=period,
        title=f"Gasto inusual en {expense.category}",
        description=(
            f"«{expense.name}» por {fmt(expense.amount)} ({short_date(expense.day)}) es mayor de lo habitual: "
            f"en los últimos {HISTORY_MONTHS} meses tus gastos en {expense.category} promediaron "
            f"{fmt(Decimal(str(round(mean, 2))))} y casi nunca pasaron de {fmt(usual)} ({samples.size} movimientos)."
        ),
        action_label="Revisar gasto",
        action={"type": "transaction", "id": expense.id, "mes": period},
        transaction_id=expense.id,
    )


def atypical_expense_alerts(expenses, period, currency="PEN"):
    """Gastos de ``period`` que superan media + 2σ de su categoría en los 6 meses anteriores.

    ``expenses`` trae los gastos REGULAR del período y de los meses anteriores;
    la función separa el historial del mes evaluado.
    """
    history = history_by_category(expenses, period)
    check = partial(atypical_alert, history=history, currency=currency)
    return list(filter(None, map(check, filter(in_month(period), expenses))))


def negative_month_alerts(flows, today, currency="PEN"):
    """Gastos mayores que ingresos: en el mes en curso solo desde el día 21; en meses cerrados siempre."""
    current = period_of(today)
    if flows.month > current or (flows.month == current and today.day <= NEGATIVE_MONTH_AFTER_DAY):
        return []
    if flows.expenses <= flows.income:
        return []
    fmt = partial(money, currency=currency)
    expenses, income, deficit = fmt(flows.expenses), fmt(flows.income), fmt(flows.expenses - flows.income)
    label = period_label(flows.month)
    if flows.month < current:
        title, description = f"{label} cerró en negativo", f"Gastaste {expenses} e ingresaste {income}: cerraste el mes con {deficit} de déficit."
    else:
        title = f"Tus gastos superan tus ingresos en {label}"
        description = f"Llevas {expenses} en gastos frente a {income} en ingresos ({deficit} de déficit). Revisa tus gastos de lo que queda del mes."
    return [
        AlertCandidate(
            key=f"{AlertRule.NEGATIVE_MONTH.value}:{flows.month}",
            rule=AlertRule.NEGATIVE_MONTH,
            level=AlertLevel.WARNING,
            severity=SEVERITY[AlertLevel.WARNING],
            period=flows.month,
            title=title,
            description=description,
            percentage=round(float(flows.expenses / flows.income * 100), 1) if flows.income else None,
            action_label="Ver movimientos",
            action={"type": "transactions", "id": None, "mes": flows.month},
        )
    ]


def spent_by_category(expenses, period):
    """Gasto de ``period`` por categoría normalizada (igual que ``finance.spent_by_category``)."""
    spent = {}
    for expense in filter(in_month(period), expenses):
        key = normalize_text(expense.category)
        spent[key] = spent.get(key, ZERO) + expense.amount
    return spent


def evaluate_rules(budgets, expenses, flows, period, today, currency="PEN"):
    """Todas las alertas que deberían existir para ``period``."""
    return [
        *budget_threshold_alerts(budgets, today, currency),
        *projected_overrun_alerts(budgets, today, currency),
        *atypical_expense_alerts(expenses, period, currency),
        *negative_month_alerts(flows, today, currency),
    ]


# --- Sincronización ------------------------------------------------------------

def alert_changes(stored, candidate, now):
    """Cambios para llevar una alerta guardada al estado del candidato ({} si no hay nada que cambiar).

    - Si la severidad sube (escala), la alerta vuelve a estar activa y sin leer,
      aunque se hubiera descartado o pospuesto, y cuenta como nueva (``created_at``).
    - Una alerta descartada que no escala no se toca: no se "revive".
    - En otro caso solo se actualizan textos, nivel y montos, sin cambiar si está leída.
    """
    escalated = candidate.severity > stored.severity
    if stored.dismissed and not escalated:
        return {}
    target = candidate.fields()
    if escalated:
        target |= {"is_read": False, "dismissed": False, "snoozed_until": None, "created_at": now}
    return {name: value for name, value in target.items() if getattr(stored, name) != value}


def reconcile(stored, candidates, period, now):
    """Plan para sincronizar las alertas guardadas con los candidatos de ``period``.

    ``stored`` son las alertas del motor de ese período más las que tengan la
    clave de algún candidato (por ejemplo, un gasto que cambió de mes). Las del
    período cuya condición ya no se cumple se eliminan.
    """
    by_key = {alert.dedupe_key: alert for alert in stored}
    keys = {candidate.key for candidate in candidates}
    updates = ((by_key[candidate.key], alert_changes(by_key[candidate.key], candidate, now)) for candidate in candidates if candidate.key in by_key)
    return SyncPlan(
        create=tuple(candidate for candidate in candidates if candidate.key not in by_key),
        update=tuple((alert, changes) for alert, changes in updates if changes),
        delete=tuple(alert.id for alert in stored if alert.period == period and alert.dedupe_key not in keys),
    )


# --- Cuándo evaluar ----------------------------------------------------------------

def window_periods(today, months=WINDOW_MONTHS):
    """Meses con alertas del motor: el mes en curso y el anterior (los más antiguos ya no son accionables)."""
    current = period_of(today)
    return [shift_month(current, offset) for offset in range(1 - months, 1)]


def in_window(period, today):
    """El mes es el anterior, el actual o uno futuro (presupuestos creados por adelantado)."""
    return period >= window_periods(today)[0]


def affected_periods(changed, today):
    """Meses a reevaluar cuando cambian datos de los meses ``changed``.

    Además de esos meses, los meses posteriores de la ventana que usan los
    cambiados como historial de la regla de gasto inusual (6 meses previos).
    """
    changed = {period for period in changed if period}
    later = {
        period
        for period in window_periods(today)
        for source in changed
        if source < period <= shift_month(source, HISTORY_MONTHS)
    }
    return sorted(period for period in changed | later if in_window(period, today))


def lazy_periods(requested, today):
    """Meses a evaluar de forma perezosa al abrir una pantalla: el mes pedido; si es el actual, también el anterior."""
    current = period_of(today)
    periods = window_periods(today) if requested in (None, "", current) else [requested]
    return [period for period in periods if in_window(period, today)]


def needs_evaluation(period, evaluated_on, today):
    """¿Hay que (re)evaluar ``period``? Sí si nunca se evaluó, si es el mes en curso
    (o futuro) y no se evaluó hoy, o si es un mes cerrado que se evaluó antes de cerrar."""
    if evaluated_on is None:
        return True
    if period < period_of(today):
        return evaluated_on < first_day(shift_month(period, 1))
    return evaluated_on != today


# --- Acciones del usuario -------------------------------------------------------------

DEFAULT_SNOOZE_HOURS = 24
MAX_SNOOZE_HOURS = 24 * 30
# Nombres que acepta POST /alertas/<id>/accion/ (incluye los que enviaba la interfaz anterior).
ALERT_ACTIONS = {
    "read": "read", "mark_read": "read", "confirm": "read", "confirm_fraud": "read", "pay": "read", "reassign": "read",
    "unread": "unread", "mark_unread": "unread",
    "dismiss": "dismiss", "discard": "dismiss",
    "snooze": "snooze", "postpone": "snooze",
    "restore": "restore",
}


def hours_text(hours):
    return "1 hora" if hours == 1 else f"{hours} horas"


def alert_action_changes(action, now, hours=DEFAULT_SNOOZE_HOURS):
    """Campos que cambia una acción del usuario y el mensaje para la respuesta."""
    kind = ALERT_ACTIONS[action]
    return {
        "read": ({"is_read": True}, "Alerta marcada como leída."),
        "unread": ({"is_read": False}, "Alerta marcada como no leída."),
        "dismiss": ({"dismissed": True, "is_read": True}, "Alerta descartada."),
        "snooze": ({"snoozed_until": now + timedelta(hours=hours), "is_read": True}, f"Alerta pospuesta por {hours_text(hours)}."),
        "restore": ({"dismissed": False, "snoozed_until": None}, "Alerta restaurada."),
    }[kind]


# --- Sugerencia de presupuestos ----------------------------------------------------

EMPTY_INSIGHT = {"titulo": "", "resumen": "", "sugerencia": "", "nivel": "", "accion": None}


def insight(title, summary, suggestion, level, action=None):
    return {"titulo": title, "resumen": summary, "sugerencia": suggestion, "nivel": level, "accion": action}


def current_month_insight(budgets, month, today, currency):
    fmt = partial(money, currency=currency)
    projections = {budget.id: projected_spending(budget.spent, month, today) for budget in budgets}
    overruns = [(projections[budget.id] - budget.limit, budget) for budget in budgets if projections[budget.id] > budget.limit]
    if not overruns:
        free = sum((budget.limit - projections[budget.id] for budget in budgets), ZERO)
        return insight(
            "Vas bien este mes",
            f"Tus {len(budgets)} presupuestos van dentro del límite: al ritmo actual cerrarías {period_label(month)} con {fmt(free)} sin usar."
            if len(budgets) > 1
            else f"Tu presupuesto de {budgets[0].category} va dentro del límite: al ritmo actual cerrarías el mes con {fmt(free)} sin usar.",
            "Sigue registrando tus gastos para mantener el control.",
            AlertLevel.SUCCESS,
        )

    overrun, worst = max(overruns, key=lambda pair: pair[0])
    exceeded = worst.spent > worst.limit
    others = len(overruns) - 1
    summary = (
        f"{worst.category} ya gastó {fmt(worst.spent)} de {fmt(worst.limit)} y, al ritmo actual, cerrará el mes en {fmt(projections[worst.id])}."
        if exceeded
        else f"Al ritmo actual, {worst.category} cerrará {period_label(month)} en {fmt(projections[worst.id])}, "
        f"{fmt(overrun)} por encima de su límite de {fmt(worst.limit)}."
    )
    if others:
        summary += f" Otros {others} presupuestos también van camino a pasarse." if others > 1 else " Otro presupuesto también va camino a pasarse."

    margins = [(budget.limit - max(budget.spent, projections[budget.id]), budget) for budget in budgets if budget.id != worst.id]
    margin, donor = max(margins, key=lambda pair: pair[0], default=(ZERO, None))
    amount = min(round_up_to_ten(overrun), round_down_to_ten(margin)) if donor else ZERO
    if amount >= TEN:
        suggestion = (
            f"Mueve {fmt(amount)} de {donor.category} a {worst.category}: según su proyección, "
            f"{donor.category} terminará el mes con {fmt(margin)} libres."
        )
        action = {
            "type": "rebalance",
            "month": month,
            "source_category": donor.category,
            "target_category": worst.category,
            "amount": amount.quantize(Decimal("0.01")),
        }
    else:
        per_day = (overrun / days_remaining(month, today)).quantize(Decimal("0.01"))
        suggestion = f"Reduce tus gastos en {worst.category} en unos {fmt(per_day)} al día para no pasarte del límite."
        action = None
    title = f"{worst.category} ya superó su presupuesto" if exceeded else f"{worst.category} superará su presupuesto"
    return insight(title, summary, suggestion, AlertLevel.DANGER if exceeded else AlertLevel.WARNING, action)


def closed_month_insight(budgets, month, currency):
    fmt = partial(money, currency=currency)
    exceeded = sorted((budget for budget in budgets if budget.spent > budget.limit), key=lambda budget: budget.limit - budget.spent)
    if not exceeded:
        spent = sum((budget.spent for budget in budgets), ZERO)
        limit = sum((budget.limit for budget in budgets), ZERO)
        return insight(
            f"Cerraste {period_label(month)} dentro de tus presupuestos",
            f"Usaste {fmt(spent)} de {fmt(limit)} ({percent_text(usage_percentage(spent, limit))}%) y te sobraron {fmt(limit - spent)}.",
            "Puedes copiar estos presupuestos al mes siguiente.",
            AlertLevel.SUCCESS,
        )
    worst = exceeded[0]
    summary = f"En {period_label(month)} gastaste {fmt(worst.spent)} en {worst.category}, {fmt(worst.spent - worst.limit)} más que su límite de {fmt(worst.limit)}."
    if len(exceeded) > 1:
        summary += f" En total, {len(exceeded)} presupuestos se excedieron."
    return insight(
        f"{worst.category} cerró excedido",
        summary,
        f"Al copiar tus presupuestos, considera subir el límite de {worst.category} a unos {fmt(round_up_to_ten(worst.spent))}.",
        AlertLevel.WARNING,
    )


def budget_insight(budgets, month, today, currency="PEN"):
    """Sugerencia calculada (por reglas) para los presupuestos de ``month``.

    Mes en curso: el presupuesto con la peor proyección de exceso y, si se puede,
    mover límite desde el presupuesto con más margen libre proyectado
    (monto = mín(exceso redondeado hacia arriba, margen redondeado hacia abajo) a S/ 10,
    así nunca supera lo que el rebalanceo permite). Mes cerrado: un resumen.
    Sin presupuestos o mes futuro: textos vacíos y ``accion`` nula.
    """
    budgets = list(budgets)
    current = period_of(today)
    if not budgets or month > current:
        return dict(EMPTY_INSIGHT)
    if month < current:
        return closed_month_insight(budgets, month, currency)
    return current_month_insight(budgets, month, today, currency)
