"""Estado y proyección de un presupuesto mensual (sin Django).

Estados según el porcentaje consumido del límite:
Normal < 75 % ≤ Precaución < 90 % ≤ Crítico ≤ 100 % < Excedido.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from .money import money
from .periods import PeriodTiming, days_in_period, period_timing

CENT = Decimal("0.01")
CAUTION_FROM = 75
CRITICAL_FROM = 90
LIMIT = 100


@dataclass(frozen=True)
class BudgetState:
    name: str
    color: str
    badge: str


NORMAL = BudgetState("Normal", "green", "En control")
CAUTION = BudgetState("Precaución", "amber", "Precaución")
CRITICAL = BudgetState("Crítico", "red", "Crítico: cerca del límite")
EXCEEDED = BudgetState("Excedido", "red", "Excedido")
STATES = (NORMAL, CAUTION, CRITICAL, EXCEEDED)


def usage_percentage(spent, limit):
    """Porcentaje del límite ya gastado (0 si no hay límite)."""
    return float(spent / limit * 100) if limit else 0.0


def budget_state(percentage):
    """Estado del presupuesto para el porcentaje consumido."""
    if percentage > LIMIT:
        return EXCEEDED
    if percentage >= CRITICAL_FROM:
        return CRITICAL
    if percentage >= CAUTION_FROM:
        return CAUTION
    return NORMAL


def projected_spending(spent, period, today):
    """Gasto estimado al cierre del mes.

    - Mes en curso: ritmo lineal (gastado / días transcurridos × días del mes).
    - Meses pasados: lo gastado (el mes ya cerró).
    - Meses futuros: 0.
    """
    timing = period_timing(period, today)
    if timing is PeriodTiming.PAST:
        return spent
    if timing is PeriodTiming.FUTURE:
        return Decimal("0.00")
    return (spent / today.day * days_in_period(period)).quantize(CENT, rounding=ROUND_HALF_UP)


def budget_detail(remaining, projection, period, today, currency="PEN"):
    """Frase corta que acompaña a cada presupuesto en la lista.

    Mes futuro: aún no empieza; mes en curso: la proyección; mes cerrado: lo que
    sobró o el exceso (``remaining`` negativo).
    """
    timing = period_timing(period, today)
    if timing is PeriodTiming.FUTURE:
        return "El período aún no empieza."
    if timing is PeriodTiming.CURRENT:
        return f"Proyección a fin de mes: {money(projection, currency)}"
    if remaining >= 0:
        return f"Mes cerrado con {money(remaining, currency)} sin usar."
    return f"Mes cerrado con {money(-remaining, currency)} de exceso."
