"""Pruebas unitarias (unittest) del cálculo del Impuesto a la Renta.

Los valores esperados se calcularon a mano con la escala del art. 53.
Se pueden ejecutar sin Django: ``python -m unittest core.test_taxes``.
"""

import unittest
from decimal import Decimal

from core.taxes import annual_projection, income_tax, uit_for_year

UIT_2024 = Decimal("5150")
UIT_2025 = Decimal("5350")
UIT_2026 = Decimal("5500")


class IncomeTaxTests(unittest.TestCase):
    def test_income_below_seven_uit_pays_no_tax(self):
        result = income_tax(Decimal("30000.00"), UIT_2025)

        self.assertEqual(result.deductions, Decimal("30000.00"))
        self.assertEqual(result.net_income, Decimal("0.00"))
        self.assertEqual(result.tax, Decimal("0.00"))
        self.assertEqual(result.effective_rate, Decimal("0.00"))
        self.assertEqual(result.brackets, ())

    def test_zero_income(self):
        result = income_tax(0, UIT_2025)

        self.assertEqual(result.tax, Decimal("0.00"))
        self.assertEqual(result.effective_rate, Decimal("0.00"))

    def test_first_bracket_only(self):
        # 60 000 - 7 UIT (37 450) = 22 550 de renta neta, todo al 8 %.
        result = income_tax(Decimal("60000"), UIT_2025)

        self.assertEqual(result.deductions, Decimal("37450.00"))
        self.assertEqual(result.net_income, Decimal("22550.00"))
        self.assertEqual(result.tax, Decimal("1804.00"))
        self.assertEqual(result.effective_rate, Decimal("3.01"))
        self.assertEqual(len(result.brackets), 1)

    def test_net_income_exactly_at_first_bracket_limit(self):
        # Renta neta = 5 UIT = 26 750; no debe abrirse el segundo tramo.
        result = income_tax(Decimal("64200"), UIT_2025)

        self.assertEqual(result.net_income, Decimal("26750.00"))
        self.assertEqual(result.tax, Decimal("2140.00"))
        self.assertEqual(len(result.brackets), 1)

    def test_three_brackets(self):
        # Renta neta 112 550: 26 750 x 8 % + 80 250 x 14 % + 5 550 x 17 %.
        result = income_tax(Decimal("150000"), UIT_2025)

        self.assertEqual([item.tax for item in result.brackets], [Decimal("2140.00"), Decimal("11235.00"), Decimal("943.50")])
        self.assertEqual(result.tax, Decimal("14318.50"))
        self.assertEqual(result.effective_rate, Decimal("9.55"))

    def test_all_five_brackets(self):
        # UIT 2024. Renta neta 363 950 recorre los cinco tramos.
        result = income_tax(Decimal("400000"), UIT_2024)

        self.assertEqual(result.net_income, Decimal("363950.00"))
        self.assertEqual(
            [(item.taxable, item.rate, item.tax) for item in result.brackets],
            [
                (Decimal("25750.00"), Decimal("0.08"), Decimal("2060.00")),
                (Decimal("77250.00"), Decimal("0.14"), Decimal("10815.00")),
                (Decimal("77250.00"), Decimal("0.17"), Decimal("13132.50")),
                (Decimal("51500.00"), Decimal("0.20"), Decimal("10300.00")),
                (Decimal("132200.00"), Decimal("0.30"), Decimal("39660.00")),
            ],
        )
        self.assertIsNone(result.brackets[-1].upper)
        self.assertEqual(result.tax, Decimal("75967.50"))
        self.assertEqual(result.effective_rate, Decimal("18.99"))

    def test_tax_equals_sum_of_brackets(self):
        result = income_tax(Decimal("987654.32"), UIT_2025)

        self.assertEqual(result.tax, sum(item.tax for item in result.brackets))

    def test_rounds_half_up_to_cents(self):
        # 0.75 en el segundo tramo: 0.75 x 14 % = 0.105 -> 0.11 (no 0.10).
        result = income_tax(Decimal("64200.75"), UIT_2025)

        self.assertEqual(result.brackets[1].taxable, Decimal("0.75"))
        self.assertEqual(result.brackets[1].tax, Decimal("0.11"))
        self.assertEqual(result.tax, Decimal("2140.11"))

    def test_additional_deductions_are_capped_at_three_uit(self):
        # Se piden 20 000 pero solo se aceptan 3 UIT (16 050).
        result = income_tax(Decimal("100000"), UIT_2025, additional_deductions=Decimal("20000"))

        self.assertEqual(result.deductions, Decimal("53500.00"))
        self.assertEqual(result.net_income, Decimal("46500.00"))
        self.assertEqual(result.tax, Decimal("4905.00"))

    def test_accepts_strings_and_integers(self):
        self.assertEqual(income_tax("60000.00", "5350").tax, income_tax(60000, 5350).tax)

    def test_rejects_negative_values(self):
        with self.assertRaises(ValueError):
            income_tax(Decimal("-1"), UIT_2025)
        with self.assertRaises(ValueError):
            income_tax(Decimal("1000"), UIT_2025, additional_deductions=Decimal("-5"))

    def test_uit_by_year(self):
        self.assertEqual(uit_for_year(2024), Decimal("5150"))
        self.assertEqual(uit_for_year(2025), Decimal("5350"))
        with self.assertRaises(ValueError):
            uit_for_year(1999)


class AnnualProjectionTests(unittest.TestCase):
    def test_takes_the_recorded_months_to_twelve(self):
        # 6 meses con 5 000 de sueldo: 30 000 registrados -> 60 000 al año.
        self.assertEqual(annual_projection(Decimal("30000.00"), 6), Decimal("60000.00"))
        self.assertEqual(annual_projection(Decimal("4200.00"), 12), Decimal("4200.00"))

    def test_rounds_to_cents_without_carrying_periodic_decimals(self):
        # 1 000 / 3 × 12 = 4 000 exactos (dividir primero daría 3 999.999...).
        self.assertEqual(annual_projection(Decimal("1000.00"), 3), Decimal("4000.00"))
        # 100.01 / 7 × 12 = 171.445714... -> 171.45
        self.assertEqual(annual_projection(Decimal("100.01"), 7), Decimal("171.45"))

    def test_no_income_gives_no_projection(self):
        self.assertIsNone(annual_projection(Decimal("0.00"), 0))
        self.assertIsNone(annual_projection(Decimal("0.00"), 3))

    def test_projection_changes_the_tax(self):
        # Registrado: 30 000 en 6 meses -> no paga (menos de 7 UIT).
        # Proyectado: 60 000 - 38 500 = 21 500 de renta neta al 8 % = 1 720.
        self.assertEqual(income_tax(Decimal("30000.00"), UIT_2026).tax, Decimal("0.00"))
        self.assertEqual(income_tax(annual_projection(Decimal("30000.00"), 6), UIT_2026).tax, Decimal("1720.00"))


if __name__ == "__main__":
    unittest.main()
