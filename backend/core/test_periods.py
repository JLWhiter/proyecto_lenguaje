"""Pruebas unitarias (unittest) de los períodos 'AAAA-MM' y fechas en español.

Se pueden ejecutar sin Django: ``python -m unittest core.test_periods``.
"""

import unittest
from datetime import date

from core.periods import (
    day_title,
    days_in_period,
    days_remaining,
    first_day,
    period_label,
    period_of,
    shift_month,
    short_date,
)

TODAY = date(2026, 11, 25)


class PeriodTests(unittest.TestCase):
    def test_period_of_and_first_day(self):
        self.assertEqual(period_of(date(2024, 5, 24)), "2024-05")
        self.assertEqual(first_day("2024-05"), date(2024, 5, 1))

    def test_shift_month_crosses_years(self):
        self.assertEqual(shift_month("2026-01", -1), "2025-12")
        self.assertEqual(shift_month("2026-11", 2), "2027-01")

    def test_days_in_period_considers_leap_years(self):
        self.assertEqual(days_in_period("2024-02"), 29)
        self.assertEqual(days_in_period("2026-02"), 28)
        self.assertEqual(days_in_period("2026-11"), 30)

    def test_days_remaining_counts_today(self):
        self.assertEqual(days_remaining("2026-11", TODAY), 6)
        self.assertEqual(days_remaining("2026-11", date(2026, 11, 30)), 1)
        self.assertEqual(days_remaining("2026-10", TODAY), 0)
        self.assertEqual(days_remaining("2026-12", TODAY), 31)

    def test_spanish_labels(self):
        self.assertEqual(period_label("2026-11"), "Noviembre 2026")
        self.assertEqual(period_label("2026-09"), "Setiembre 2026")
        self.assertEqual(short_date(date(2024, 5, 4)), "4 May")

    def test_day_titles(self):
        self.assertEqual(day_title(TODAY, TODAY), "HOY")
        self.assertEqual(day_title(date(2026, 11, 24), TODAY), "AYER")
        self.assertEqual(day_title(date(2024, 5, 24), TODAY), "24 MAY 2024")


if __name__ == "__main__":
    unittest.main()
