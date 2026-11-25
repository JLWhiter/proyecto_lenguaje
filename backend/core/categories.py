"""Categorías de movimientos y presupuestos (módulo puro, sin Django).

Dos categorías son la misma si tienen la misma clave (``category_key``): sin
importar mayúsculas, espacios ni tildes ("Alimentacion", "ALIMENTACIÓN" y
"  alimentación " son la misma). Todas las comparaciones de categorías de la
app usan esta clave: lo gastado de cada presupuesto, la unicidad de los
presupuestos, el filtro y la búsqueda de movimientos, el historial del motor
de alertas, el gráfico de distribución de gastos y el catálogo de categorías.

Al guardar, ``canonical_category`` reutiliza la forma que el usuario ya tiene
(o la predeterminada), así "alimentacion" se guarda como "Alimentación".

Se prueba con ``unittest`` sin Django: ``python -m unittest core.test_categories``.
"""

import unicodedata

# Categorías que se ofrecen siempre (GET /categorias/), con su forma correcta.
DEFAULT_CATEGORIES = (
    "Alimentación", "Vivienda", "Transporte", "Servicios", "Salud", "Educación",
    "Entretenimiento", "Ropa", "Salario", "Honorarios", "Otros",
)


def category_key(value):
    """Clave para comparar categorías: sin tildes, en minúsculas y sin espacios repetidos.

    'Alimentación' -> 'alimentacion'; '  COMIDA   Rápida ' -> 'comida rapida'.
    Se descompone el texto (NFKD) y se quitan las marcas combinables (tildes,
    diéresis, la virgulilla de la ñ), así 'Año' y 'Ano' tienen la misma clave.
    """
    decomposed = unicodedata.normalize("NFKD", str(value or ""))
    without_marks = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(without_marks.casefold().split())


def canonical_category(value, known):
    """La forma de ``known`` con la misma clave que ``value``; si no hay ninguna, ``value``.

    ``known`` va en orden de preferencia (la primera coincidencia gana).
    """
    target = category_key(value)
    return next((name for name in known if category_key(name) == target), value)
