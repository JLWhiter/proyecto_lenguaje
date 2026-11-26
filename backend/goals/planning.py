"""Cálculos de las metas de ahorro (módulo puro: sin Django ni base de datos).

Recibe montos ``Decimal`` y fechas ``date`` locales, así se prueba con
``unittest`` sin configurar Django: ``python -m unittest goals.test_planning``.

Reglas:

- Progreso: ahorrado / objetivo, en % con un decimal (puede pasar de 100).
- Progreso esperado: lineal entre el día en que se creó la meta y la fecha
  objetivo (0 % al crearla, 100 % en la fecha objetivo).
- Meses restantes: meses completos que faltan hasta la fecha objetivo, mínimo
  1 mientras no venza (0 si ya venció). Contar solo meses completos hace que el
  ahorro mensual sugerido alcance antes de la fecha.
- Ahorro mensual necesario: lo que falta / meses restantes, redondeado hacia
  arriba al céntimo (si la meta venció, todo lo que falta).
- Estado, en este orden:
  "Alcanzada" (ahorrado ≥ objetivo), "Vencida" (pasó la fecha objetivo),
  "Atrasada" (progreso < esperado − 10 puntos y la meta tiene al menos 30 días)
  y "En curso".
- Fecha estimada (NumPy): promedio de los aportes netos mensuales (aportes −
  retiros) de los últimos 6 meses, desde el mes del primer movimiento; el mes
  en curso solo cuenta si ya tiene movimientos (aún no termina). Con ese ritmo
  se calcula en cuántos meses se completa lo que falta; ``None`` si el ritmo es
  ≤ 0 o la meta ya se alcanzó.
"""

import calendar
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_CEILING, Decimal
from itertools import groupby

import numpy as np

ZERO = Decimal("0.00")
CENT = Decimal("0.01")
BEHIND_MARGIN = 10  # puntos porcentuales por debajo del progreso esperado
BEHIND_MIN_DAYS = 30  # antigüedad mínima de la meta para considerarla atrasada
PACE_MONTHS = 6
SERIES_MONTHS = 12

IN_PROGRESS = "En curso"
BEHIND = "Atrasada"
REACHED = "Alcanzada"
OVERDUE = "Vencida"
STATUS_COLORS = {IN_PROGRESS: "sky", BEHIND: "amber", REACHED: "green", OVERDUE: "red"}

FUTURE_DATE_ERROR = "La fecha no puede ser posterior a hoy."
BEFORE_GOAL_ERROR = "La fecha no puede ser anterior al día en que creaste la meta."


@dataclass(frozen=True)
class Contribution:
    """Movimiento de una meta con signo: positivo si es un aporte, negativo si es un retiro."""

    day: date
    amount: Decimal


@dataclass(frozen=True)
class GoalSnapshot:
    """Todos los indicadores de una meta en un día dado."""

    saved: Decimal
    remaining: Decimal
    progress: float
    expected: float
    months_left: int
    required_monthly: Decimal
    status: str
    estimated: date | None

    @property
    def color(self):
        return STATUS_COLORS[self.status]

    @property
    def is_behind(self):
        return self.status == BEHIND

    @property
    def is_reached(self):
        return self.status == REACHED


# --- Meses ---------------------------------------------------------------------

def month_index(day):
    """Número correlativo del mes de ``day`` (año * 12 + mes - 1): permite restar meses."""
    return day.year * 12 + day.month - 1


def month_key(index):
    """Índice de mes -> 'AAAA-MM'."""
    year, month = divmod(index, 12)
    return f"{year:04d}-{month + 1:02d}"


def add_months(day, months):
    """``day`` + ``months`` meses; el día se ajusta al último del mes si no existe (31 Ene + 1 = 28 Feb)."""
    year, month = divmod(month_index(day) + months, 12)
    month += 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


# --- Montos y progreso ------------------------------------------------------------

def total_saved(contributions):
    return sum((item.amount for item in contributions), ZERO)


def remaining(saved, target):
    """Lo que falta para el objetivo (nunca negativo)."""
    return max(target - saved, ZERO)


def progress_pct(saved, target):
    """Porcentaje ahorrado del objetivo con un decimal: (450, 1000) -> 45.0."""
    if target <= 0:
        return 0.0
    return round(float(saved / target * 100), 1)


def expected_progress_pct(created, target_date, today):
    """Progreso que debería llevar hoy la meta si se ahorrara de forma pareja (lineal)."""
    total = (target_date - created).days
    if total <= 0:
        return 100.0
    elapsed = min(max((today - created).days, 0), total)
    return round(elapsed / total * 100, 1)


def months_left(target_date, today):
    """Meses completos hasta la fecha objetivo; mínimo 1 mientras no venza, 0 si ya venció."""
    if target_date < today:
        return 0
    months = month_index(target_date) - month_index(today)
    if target_date.day < today.day:
        months -= 1
    return max(months, 1)


def required_monthly(saved, target, target_date, today):
    """Cuánto ahorrar cada mes para llegar a tiempo (redondeado hacia arriba al céntimo)."""
    missing = remaining(saved, target)
    months = months_left(target_date, today)
    if missing == ZERO or months == 0:
        return missing
    return (missing / months).quantize(CENT, rounding=ROUND_CEILING)


def is_behind(saved, target, created, target_date, today):
    """Va más de ``BEHIND_MARGIN`` puntos por debajo de lo esperado y tiene al menos ``BEHIND_MIN_DAYS`` días."""
    if (today - created).days < BEHIND_MIN_DAYS:
        return False
    return progress_pct(saved, target) < expected_progress_pct(created, target_date, today) - BEHIND_MARGIN


def goal_status(saved, target, created, target_date, today):
    if saved >= target:
        return REACHED
    if today > target_date:
        return OVERDUE
    if is_behind(saved, target, created, target_date, today):
        return BEHIND
    return IN_PROGRESS


def contribution_date_error(day, created, today):
    """Mensaje de error de la fecha de un aporte o retiro, o ``None`` si es válida."""
    if day > today:
        return FUTURE_DATE_ERROR
    if day < created:
        return BEFORE_GOAL_ERROR
    return None


# --- Series mensuales (estilo funcional) -----------------------------------------------

def monthly_totals(contributions):
    """{índice de mes: aporte neto del mes}, agrupando los movimientos por mes."""
    by_month = sorted(contributions, key=lambda item: month_index(item.day))
    return {
        index: total_saved(items)
        for index, items in groupby(by_month, key=lambda item: month_index(item.day))
    }


def monthly_series(contributions, today, months=SERIES_MONTHS):
    """Aporte neto de cada uno de los últimos ``months`` meses (incluido el actual), del más antiguo al más reciente."""
    totals = monthly_totals(contributions)
    last = month_index(today)
    return [
        {"mes": month_key(index), "aportado": totals.get(index, ZERO)}
        for index in range(last - months + 1, last + 1)
    ]


def monthly_pace(contributions, today, months=PACE_MONTHS):
    """Promedio (NumPy) del aporte neto mensual reciente; 0.0 si no hay movimientos en la ventana.

    La ventana empieza en el mes del primer movimiento (como máximo ``months``
    meses atrás) y termina en el mes en curso si ya tiene movimientos o, si no,
    en el anterior: un mes que recién empieza no baja el promedio.
    """
    totals = monthly_totals(contributions)
    if not totals:
        return 0.0
    current = month_index(today)
    start = max(min(totals), current - months + 1)
    end = current if current in totals else current - 1
    if end < start:
        return 0.0
    window = np.array([float(totals.get(index, ZERO)) for index in range(start, end + 1)], dtype=np.float64)
    return float(np.mean(window))


def estimated_completion(contributions, target, today):
    """Fecha en que se alcanzaría el objetivo al ritmo reciente, o ``None`` (sin ritmo o ya alcanzada)."""
    missing = remaining(total_saved(contributions), target)
    if missing == ZERO:
        return None
    pace = monthly_pace(contributions, today)
    if pace <= 0:
        return None
    return add_months(today, int(np.ceil(float(missing) / pace)))


def snapshot(contributions, target, created, target_date, today):
    """Indicadores de la meta en ``today`` (los usan la API y el motor de alertas)."""
    contributions = list(contributions)
    saved = total_saved(contributions)
    return GoalSnapshot(
        saved=saved,
        remaining=remaining(saved, target),
        progress=progress_pct(saved, target),
        expected=expected_progress_pct(created, target_date, today),
        months_left=months_left(target_date, today),
        required_monthly=required_monthly(saved, target, target_date, today),
        status=goal_status(saved, target, created, target_date, today),
        estimated=estimated_completion(contributions, target, today),
    )
