"""Filtros de transacciones con el paradigma funcional.

Cada criterio de búsqueda es una función pura que devuelve un predicado
(``lambda``). Los predicados se combinan con ``all_of`` y se aplican con
``filter``; los totales se acumulan con ``reduce``. Ninguna función modifica
la lista que recibe.

Los movimientos son diccionarios con el formato que devuelve
``serialize_transaction``: claves ``nombre``, ``categoria``, ``tipo`` y ``monto``.
"""

from decimal import Decimal
from functools import reduce


def normalize_text(value):
    """Texto en minúsculas y sin espacios repetidos, para comparar sin importar el formato."""
    return " ".join(str(value or "").split()).casefold()


def in_category(category):
    """Predicado: la categoría del movimiento contiene ``category``."""
    target = normalize_text(category)
    return lambda item: target in normalize_text(item["categoria"])


def of_type(kind):
    """Predicado: el movimiento es del tipo indicado (``INGRESO`` o ``GASTO``)."""
    return lambda item: item["tipo"] == kind


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
    return reduce(lambda total, item: total + item["monto"], items, Decimal("0.00"))
