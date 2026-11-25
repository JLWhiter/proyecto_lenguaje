"""Pruebas unitarias (unittest) de la exportación CSV.

Se pueden ejecutar sin Django: ``python -m unittest core.test_csv_export``.
"""

import csv
import io
import unittest
from decimal import Decimal

from core.csv_export import BOM, HEADER, movements_csv, safe_cell

ITEM = {
    "occurred_at": "2024-05-24T14:32:00-05:00",
    "nombre": "=HYPERLINK(\"http://malo\")",
    "categoria": "Alimentación",
    "tipo": "GASTO",
    "kind_label": "Movimiento",
    "cuenta": "@Cuenta",
    "monto": Decimal("-45.50"),
    "estado": "Completado",
}


class SafeCellTests(unittest.TestCase):
    def test_formula_prefixes_are_neutralized(self):
        for text in ("=1+1", "+51 999", "-cmd", "@SUM(A1)", "\tx"):
            self.assertEqual(safe_cell(text), f"'{text}")

    def test_plain_text_and_numbers_are_kept(self):
        self.assertEqual(safe_cell("Supermercado"), "Supermercado")
        self.assertEqual(safe_cell(Decimal("-45.5")), "-45.50")
        self.assertEqual(safe_cell(3), "3")
        self.assertEqual(safe_cell(None), "")


class MovementsCsvTests(unittest.TestCase):
    def test_rows_use_local_date_and_safe_cells(self):
        text = movements_csv([ITEM])

        self.assertTrue(text.startswith(BOM))
        header, row = list(csv.reader(io.StringIO(text[len(BOM):])))
        self.assertEqual(tuple(header), HEADER)
        self.assertEqual(
            row,
            ["2024-05-24 14:32", "'=HYPERLINK(\"http://malo\")", "Alimentación", "GASTO", "Movimiento", "'@Cuenta", "-45.50", "Completado"],
        )


if __name__ == "__main__":
    unittest.main()
