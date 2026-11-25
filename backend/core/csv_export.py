"""Exportación de movimientos a CSV, protegida contra inyección de fórmulas (sin Django).

Excel o LibreOffice ejecutan como fórmula cualquier celda que empiece con
``=``, ``+``, ``-`` o ``@``. Un nombre de movimiento como ``=HYPERLINK(...)``
podría abrir un enlace malicioso, por eso esas celdas se escriben con un
apóstrofo delante. Los montos son números, así que se exportan tal cual.
"""

import csv
import io
from decimal import Decimal

HEADER = ("Fecha", "Descripción", "Categoría", "Tipo", "Clase", "Cuenta", "Monto", "Estado")
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
BOM = "﻿"


def safe_cell(value):
    """Texto seguro para una celda; los montos numéricos no se modifican."""
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    if isinstance(value, (int, float)):
        return str(value)
    text = "" if value is None else str(value)
    return f"'{text}" if text.startswith(FORMULA_PREFIXES) else text


def rows_to_csv(rows):
    """Convierte filas (iterables de valores) en texto CSV con celdas seguras."""
    buffer = io.StringIO()
    csv.writer(buffer).writerows([safe_cell(value) for value in row] for row in rows)
    return buffer.getvalue()


def movement_row(item):
    """Fila del CSV para un movimiento serializado (fecha y hora locales)."""
    moment = item["occurred_at"]
    return (
        f"{moment[:10]} {moment[11:16]}",
        item["nombre"],
        item["categoria"],
        item["tipo"],
        item["kind_label"],
        item["cuenta"],
        item["monto"],
        item["estado"],
    )


def movements_csv(items):
    """CSV completo con encabezado y BOM (para que Excel respete las tildes)."""
    return BOM + rows_to_csv([HEADER, *map(movement_row, items)])
