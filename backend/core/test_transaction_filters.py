"""Pruebas unitarias (unittest) de los filtros funcionales de transacciones."""

import unittest
from datetime import date
from decimal import Decimal

from core.transaction_filters import (
    all_of,
    category_label,
    daily_totals,
    filter_transactions,
    group_by_day,
    in_category,
    of_kind,
    of_type,
    page_of,
    total_amount,
)

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

    def test_category_and_search_ignore_accents(self):
        unaccented = {"nombre": "Menu", "categoria": "Alimentacion", "tipo": "GASTO", "monto": Decimal("-5.00")}
        items = [*ITEMS, unaccented]

        self.assertEqual(self.names(filter_transactions(items, category="alimentacion")), ["Supermercado", "Menú del día", "Menu"])
        self.assertEqual(self.names(filter_transactions(items, category="ALIMENTACIÓN")), ["Supermercado", "Menú del día", "Menu"])
        self.assertEqual(self.names(filter_transactions(items, search="menu")), ["Menú del día", "Menu"])
        self.assertEqual(self.names(filter_transactions(items, search="alimentación")), ["Supermercado", "Menú del día", "Menu"])

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


def movement(name, kind, amount, when):
    value = Decimal(amount)
    return {"nombre": name, "categoria": "X", "tipo": "GASTO" if value < 0 else "INGRESO", "kind": kind, "monto": value, "occurred_at": when}


# Ordenados del más reciente al más antiguo, como los devuelve la API.
MOVEMENTS = [
    movement("Taxi", "REGULAR", "-20.00", "2026-11-25T08:00:00-05:00"),
    movement("Sueldo", "REGULAR", "3000.00", "2026-11-24T23:30:00-05:00"),
    movement("Recarga Yape", "TRANSFER", "-100.00", "2026-11-24T10:00:00-05:00"),
    movement("Mercado", "REGULAR", "-80.00", "2026-11-02T09:00:00-05:00"),
]


class GroupingTests(unittest.TestCase):
    def test_of_kind(self):
        regular = list(filter(of_kind("REGULAR", "DEPOSIT"), MOVEMENTS))

        self.assertEqual([item["nombre"] for item in regular], ["Taxi", "Sueldo", "Mercado"])

    def test_daily_totals_use_local_day(self):
        self.assertEqual(
            daily_totals(MOVEMENTS),
            {date(2026, 11, 25): Decimal("-20.00"), date(2026, 11, 24): Decimal("2900.00"), date(2026, 11, 2): Decimal("-80.00")},
        )

    def test_group_by_day_titles_and_totals(self):
        groups = group_by_day(MOVEMENTS, date(2026, 11, 25), daily_totals(MOVEMENTS))

        self.assertEqual([group["titulo"] for group in groups], ["HOY", "AYER", "2 NOV 2026"])
        self.assertEqual([len(group["items"]) for group in groups], [1, 2, 1])
        self.assertEqual(groups[1]["total"], Decimal("2900.00"))
        self.assertEqual(groups[1]["fecha"], "2026-11-24")

    def test_day_total_covers_items_outside_the_page(self):
        page, pages = page_of(MOVEMENTS, 1, 2)

        groups = group_by_day(page, date(2026, 11, 25), daily_totals(MOVEMENTS))

        self.assertEqual(pages, 2)
        self.assertEqual(groups[-1]["total"], Decimal("2900.00"))
        self.assertEqual(len(groups[-1]["items"]), 1)

    def test_days_without_counted_movements_total_zero(self):
        counted = list(filter(of_kind("REGULAR", "DEPOSIT"), MOVEMENTS))
        only_transfer = [movement("Recarga Yape", "TRANSFER", "-100.00", "2026-11-23T10:00:00-05:00")]

        groups = group_by_day([*MOVEMENTS[:3], *only_transfer, *MOVEMENTS[3:]], date(2026, 11, 25), daily_totals(counted))

        self.assertEqual([group["total"] for group in groups], [Decimal("-20.00"), Decimal("3000.00"), Decimal("0.00"), Decimal("-80.00")])
        self.assertEqual([len(group["items"]) for group in groups], [1, 2, 1, 1])

    def test_page_of(self):
        self.assertEqual(page_of(MOVEMENTS, 2, 3), (MOVEMENTS[3:], 2))
        self.assertEqual(page_of(MOVEMENTS, 5, 3), ([], 2))
        self.assertEqual(page_of([], 1, 50), ([], 1))

    def test_category_label(self):
        self.assertEqual(category_label("  comida   rápida "), "Comida rápida")
        self.assertEqual(category_label("ATM"), "ATM")


if __name__ == "__main__":
    unittest.main()
