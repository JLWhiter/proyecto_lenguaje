"""Pruebas unitarias (unittest) del estado y la proyección de presupuestos.

Se pueden ejecutar sin Django: ``python -m unittest core.test_budgets``.
"""

import unittest
from datetime import date
from decimal import Decimal

from core.budgets import CAUTION, CRITICAL, EXCEEDED, NORMAL, budget_detail, budget_state, projected_spending, usage_percentage

TODAY = date(2026, 11, 10)


class BudgetStateTests(unittest.TestCase):
    def test_thresholds(self):
        cases = [(0, NORMAL), (74.9, NORMAL), (75, CAUTION), (89.9, CAUTION), (90, CRITICAL), (100, CRITICAL), (100.1, EXCEEDED), (500, EXCEEDED)]
        for percentage, expected in cases:
            self.assertEqual(budget_state(percentage), expected, percentage)

    def test_exceeded_is_not_described_as_near_the_limit(self):
        self.assertEqual(budget_state(500).name, "Excedido")
        self.assertNotIn("Cerca", budget_state(500).badge)

    def test_usage_percentage(self):
        self.assertAlmostEqual(usage_percentage(Decimal("45"), Decimal("60")), 75.0)
        self.assertEqual(usage_percentage(Decimal("10"), Decimal("0")), 0.0)


class ProjectionTests(unittest.TestCase):
    def test_current_month_is_projected_linearly(self):
        # 100 gastados en 10 días de un mes de 30 días -> 300 al cierre.
        self.assertEqual(projected_spending(Decimal("100.00"), "2026-11", TODAY), Decimal("300.00"))

    def test_past_month_keeps_what_was_spent(self):
        self.assertEqual(projected_spending(Decimal("80.00"), "2026-10", TODAY), Decimal("80.00"))

    def test_future_month_projects_zero(self):
        self.assertEqual(projected_spending(Decimal("0.00"), "2026-12", TODAY), Decimal("0.00"))

    def test_detail_text(self):
        self.assertEqual(budget_detail(Decimal("50"), Decimal("1385"), "2026-11", TODAY), "Proyección a fin de mes: S/ 1,385.00")
        self.assertEqual(budget_detail(Decimal("50"), Decimal("0"), "2026-10", TODAY), "Mes cerrado con S/ 50.00 sin usar.")
        self.assertEqual(budget_detail(Decimal("-20"), Decimal("0"), "2026-10", TODAY), "Mes cerrado con S/ 20.00 de exceso.")
        self.assertEqual(budget_detail(Decimal("0"), Decimal("0"), "2026-12", TODAY), "El período aún no empieza.")

    def test_detail_text_for_each_timing_across_years(self):
        new_year = date(2027, 1, 15)
        self.assertEqual(budget_detail(Decimal("0"), Decimal("0"), "2027-02", new_year), "El período aún no empieza.")
        self.assertEqual(budget_detail(Decimal("10"), Decimal("620"), "2027-01", new_year), "Proyección a fin de mes: S/ 620.00")
        self.assertEqual(budget_detail(Decimal("10"), Decimal("0"), "2026-12", new_year), "Mes cerrado con S/ 10.00 sin usar.")
        self.assertEqual(budget_detail(Decimal("0"), Decimal("0"), "2026-12", new_year), "Mes cerrado con S/ 0.00 sin usar.")

    def test_projection_across_years(self):
        new_year = date(2027, 1, 15)
        self.assertEqual(projected_spending(Decimal("80.00"), "2026-12", new_year), Decimal("80.00"))
        self.assertEqual(projected_spending(Decimal("15.00"), "2027-01", new_year), Decimal("31.00"))
        self.assertEqual(projected_spending(Decimal("5.00"), "2027-02", new_year), Decimal("0.00"))

    def test_detail_text_uses_the_user_currency(self):
        self.assertEqual(budget_detail(Decimal("50"), Decimal("1385"), "2026-11", TODAY, "USD"), "Proyección a fin de mes: $ 1,385.00")
        self.assertEqual(budget_detail(Decimal("-20"), Decimal("0"), "2026-10", TODAY, "EUR"), "Mes cerrado con € 20.00 de exceso.")


if __name__ == "__main__":
    unittest.main()
