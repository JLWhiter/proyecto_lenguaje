"""Filtros y agrupación de transacciones con el paradigma funcional.

Cada criterio de búsqueda es una función pura que devuelve un predicado
(``lambda``). Los predicados se combinan con ``all_of`` y se aplican con
``filter``; los totales se acumulan con ``reduce``. Ninguna función modifica
la lista que recibe.

Los movimientos son diccionarios con el formato que devuelve
``serialize_transaction``: claves ``nombre``, ``categoria``, ``tipo``,
``kind``, ``monto`` y ``occurred_at`` (ISO 8601 en hora local).
"""

from datetime import date
from decimal import Decimal
from functools import reduce
from itertools import groupby

from .periods import day_title

ZERO = Decimal("0.00")


def clean_text(value):
    """'  comida   rápida ' -> 'comida rápida' (sin espacios sobrantes)."""
    return " ".join(str(value or "").split())


def category_label(value):
    """'  comida   rápida ' -> 'Comida rápida' (forma en que se guardan las categorías)."""
    text = clean_text(value)
    return text[:1].upper() + text[1:]


def normalize_text(value):
    """Texto en minúsculas y sin espacios repetidos, para comparar sin importar el formato."""
    return clean_text(value).casefold()


def in_category(category):
    """Predicado: la categoría del movimiento contiene ``category``."""
    target = normalize_text(category)
    return lambda item: target in normalize_text(item["categoria"])


def of_type(kind):
    """Predicado: el movimiento es del tipo indicado (``INGRESO`` o ``GASTO``)."""
    return lambda item: item["tipo"] == kind


def of_kind(*kinds):
    """Predicado: la clase del movimiento (``REGULAR``, ``TRANSFER``...) está entre ``kinds``."""
    return lambda item: item["kind"] in kinds


def matches_text(search):
    """Predicado: el texto aparece en el nombre o en la categoría del movimiento."""
    target = normalize_text(search)
    return lambda item: target in normalize_text(item["nombre"]) or target in normalize_text(item["categoria"])


def all_of(*predicates):
    """Combina varios predicados en uno que exige que todos se cumplan."""
    return lambda item: all(predicate(item) for predicate in predicates)


def build_predicate(search="", kind="", category=""):
    """Crea el predicado de búsqueda usando solo los criterios que tienen valor."""
    criteria = ((search, matches_text), (kind, of_type), (category, in_category))
    return all_of(*[factory(value) for value, factory in criteria if value])


def filter_transactions(items, search="", kind="", category="", extra=()):
    """Devuelve una lista nueva con los movimientos que cumplen todos los criterios."""
    return list(filter(all_of(build_predicate(search, kind, category), *extra), items))


def total_amount(items):
    """Suma los montos (ingresos positivos, gastos negativos) de los movimientos."""
    return reduce(lambda total, item: total + item["monto"], items, ZERO)


def item_day(item):
    """Día local del movimiento, leído de su ``occurred_at`` ('2024-05-24T14:32:00-05:00')."""
    return date.fromisoformat(item["occurred_at"][:10])


def add_to_day(totals, item):
    """Paso de ``reduce``: devuelve un diccionario nuevo con el monto sumado a su día."""
    day = item_day(item)
    return {**totals, day: totals.get(day, ZERO) + item["monto"]}


def daily_totals(items):
    """Neto de cada día: {fecha: total}."""
    return reduce(add_to_day, items, {})


def group_by_day(items, today, totals):
    """Agrupa por día local movimientos ordenados del más reciente al más antiguo.

    ``totals`` trae el neto de cada día calculado sobre todos los movimientos
    filtrados, así el total es correcto aunque un día quede entre dos páginas.
    """
    return [
        {"titulo": day_title(day, today), "fecha": day.isoformat(), "total": totals[day], "items": list(group)}
        for day, group in groupby(items, key=item_day)
    ]


def page_of(items, page, size):
    """Movimientos de la página ``page`` (empieza en 1) y cantidad de páginas (mínimo 1)."""
    pages = max(1, -(-len(items) // size))
    start = (page - 1) * size
    return items[start:start + size], pages
