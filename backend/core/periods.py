"""Períodos mensuales ('AAAA-MM') y fechas en la hora local del proyecto.

Las funciones que reciben fechas son puras y se prueban sin Django. Solo
``local_today``, ``current_period``, ``period_of_moment``, ``local_midnight``,
``period_bounds``, ``year_bounds`` y ``end_of_today`` consultan la zona horaria
configurada en ``settings.TIME_ZONE`` (America/Lima).
"""

import calendar
from datetime import date, datetime, time, timedelta

from django.utils import timezone

PERIOD_REGEX = r"^\d{4}-(0[1-9]|1[0-2])$"
PERIOD_ERROR = "El período debe tener formato AAAA-MM."
MONTH_NAMES = ("Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic")
FULL_MONTH_NAMES = (
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
)


def parse_period(period):
    """'2024-05' -> (2024, 5)."""
    year, month = period.split("-")
    return int(year), int(month)


def period_of(day):
    """Período al que pertenece una fecha: date(2024, 5, 24) -> '2024-05'."""
    return f"{day.year:04d}-{day.month:02d}"


def shift_month(period, offset):
    """Suma ``offset`` meses a un período 'AAAA-MM'."""
    year, month = parse_period(period)
    index = year * 12 + (month - 1) + offset
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def first_day(period):
    """Primer día del período."""
    return date(*parse_period(period), 1)


def days_in_period(period):
    """Cantidad de días del mes (considera años bisiestos)."""
    return calendar.monthrange(*parse_period(period))[1]


def days_remaining(period, today):
    """Días que faltan para cerrar el período contando hoy; 0 si ya terminó."""
    current = period_of(today)
    if period < current:
        return 0
    if period > current:
        return days_in_period(period)
    return days_in_period(period) - today.day + 1


def period_label(period):
    """'2026-11' -> 'Noviembre 2026'."""
    year, month = parse_period(period)
    return f"{FULL_MONTH_NAMES[month - 1]} {year}"


def short_date(day):
    """date(2024, 5, 24) -> '24 May'."""
    return f"{day.day} {MONTH_NAMES[day.month - 1]}"


def day_title(day, today):
    """Título de un grupo de movimientos: 'HOY', 'AYER' o '24 MAY 2024'."""
    if day == today:
        return "HOY"
    if day == today - timedelta(days=1):
        return "AYER"
    return f"{day.day} {MONTH_NAMES[day.month - 1].upper()} {day.year}"


def local_today():
    """Fecha de hoy en la zona horaria del proyecto."""
    return timezone.localdate()


def current_period():
    """Período del mes actual en hora local, por ejemplo '2026-11'."""
    return period_of(local_today())


def period_of_moment(moment):
    """Período, en hora local, de un datetime con zona horaria (por ejemplo, el de un movimiento)."""
    return period_of(timezone.localtime(moment).date())


def local_midnight(day):
    """Inicio del día ``day`` en hora local, como datetime con zona horaria."""
    return timezone.make_aware(datetime.combine(day, time.min))


def period_bounds(period):
    """Inicio y fin (exclusivo) del período en hora local."""
    return local_midnight(first_day(period)), local_midnight(first_day(shift_month(period, 1)))


def year_bounds(year):
    """Inicio y fin (exclusivo) del año en hora local."""
    return local_midnight(date(year, 1, 1)), local_midnight(date(year + 1, 1, 1))


def end_of_today():
    """Último instante permitido para un movimiento: la medianoche local de mañana (exclusiva)."""
    return local_midnight(local_today() + timedelta(days=1))
