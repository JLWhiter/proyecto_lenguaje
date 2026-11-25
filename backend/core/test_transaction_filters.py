"""Pruebas unitarias (unittest) de los filtros funcionales de transacciones."""

import unittest
from decimal import Decimal

from core.transaction_filters import all_of, filter_transactions, in_category, of_type, total_amount

ITEMS = [
    {"nombre": "Supermercado", "categoria": "Alimentación", "tipo": "GASTO", "monto": Decimal("-120.50")},
    {"nombre": "Sueldo", "categoria": "Salario", "tipo": "INGRESO", "monto": Decimal("3000.00")},
    {"nombre": "Menú del día", "categoria": "ALIMENTACIÓN", "tipo": "GASTO", "monto": Decimal("-15.00")},
    {"nombre": "Taxi", "categoria": "Transporte", "tipo": "GASTO", "monto": Decimal("-22.40")},
]


class TransactionFilterTests(unittest.TestCase):
    def names(self, items):
        return [item["nombre"] for item in items]

    def test_filters_by_category_ignoring_case(self):
        result = filter_transactions(ITEMS, category="alimentación")

        self.assertEqual(self.names(result), ["Supermercado", "Menú del día"])

    def test_category_ignores_extra_spaces(self):
        self.assertTrue(in_category("  Transporte ")(ITEMS[3]))

    def test_filters_by_type(self):
        self.assertEqual(self.names(filter_transactions(ITEMS, kind="INGRESO")), ["Sueldo"])

    def test_search_looks_in_name_and_category(self):
        self.assertEqual(self.names(filter_transactions(ITEMS, search="sueldo")), ["Sueldo"])
        self.assertEqual(self.names(filter_transactions(ITEMS, search="transp")), ["Taxi"])

    def test_criteria_are_combined(self):
        result = filter_transactions(ITEMS, search="menú", kind="GASTO", category="alimentación")

        self.assertEqual(self.names(result), ["Menú del día"])

    def test_extra_predicates(self):
        result = filter_transactions(ITEMS, kind="GASTO", extra=[lambda item: item["monto"] < Decimal("-20")])

        self.assertEqual(self.names(result), ["Supermercado", "Taxi"])

    def test_no_criteria_returns_everything(self):
        self.assertEqual(filter_transactions(ITEMS), ITEMS)

    def test_does_not_modify_the_input(self):
        original = list(ITEMS)
        filter_transactions(ITEMS, category="salario")

        self.assertEqual(ITEMS, original)

    def test_accepts_any_iterable(self):
        self.assertEqual(len(filter_transactions(iter(ITEMS), kind="GASTO")), 3)

    def test_all_of_and_of_type(self):
        predicate = all_of(of_type("GASTO"), in_category("transporte"))

        self.assertEqual(self.names(filter(predicate, ITEMS)), ["Taxi"])

    def test_total_amount(self):
        self.assertEqual(total_amount(ITEMS), Decimal("2842.10"))
        self.assertEqual(total_amount([]), Decimal("0.00"))


if __name__ == "__main__":
    unittest.main()
