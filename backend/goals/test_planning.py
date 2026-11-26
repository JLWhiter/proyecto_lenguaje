"""Pruebas unitarias (unittest) de los cálculos de metas de ahorro.

Se pueden ejecutar sin Django: ``python -m unittest goals.test_planning``.
"""

import unittest
from datetime import date
from decimal import Decimal

from goals.planning import (
    BEFORE_GOAL_ERROR,
    BEHIND,
    FUTURE_DATE_ERROR,
    IN_PROGRESS,
    OVERDUE,
    REACHED,
    Contribution,
    add_months,
    contribution_date_error,
    estimated_completion,
    expected_progress_pct,
    goal_status,
    is_behind,
    monthly_pace,
    monthly_series,
    months_left,
    progress_pct,
    remaining,
    required_monthly,
    snapshot,
    total_saved,
)

D = Decimal
TODAY = date(2026, 11, 26)
CREATED = date(2026, 1, 1)
TARGET_DATE = date(2026, 12, 31)  # 364 días después de CREATED


def aporte(day, amount):
    return Contribution(day, D(amount))


def retiro(day, amount):
    return Contribution(day, -D(amount))


class ProgressTests(unittest.TestCase):
    def test_progress_percentage_boundaries(self):
        self.assertEqual(progress_pct(D("0"), D("1000")), 0.0)
        self.assertEqual(progress_pct(D("450"), D("1000")), 45.0)
        self.assertEqual(progress_pct(D("1000"), D("1000")), 100.0)
        self.assertEqual(progress_pct(D("1250"), D("1000")), 125.0)
        self.assertEqual(progress_pct(D("1"), D("3")), 33.3)
        self.assertEqual(progress_pct(D("10"), D("0")), 0.0)

    def test_remaining_is_never_negative(self):
        self.assertEqual(remaining(D("300"), D("1000")), D("700"))
        self.assertEqual(remaining(D("1200"), D("1000")), D("0.00"))

    def test_total_saved_subtracts_withdrawals(self):
        movements = [aporte(CREATED, "500"), retiro(CREATED, "120.50"), aporte(TODAY, "20")]
        self.assertEqual(total_saved(movements), D("399.50"))
        self.assertEqual(total_saved([]), D("0.00"))

    def test_expected_progress_is_linear_and_clamped(self):
        self.assertEqual(expected_progress_pct(CREATED, TARGET_DATE, date(2026, 7, 2)), 50.0)  # 182 de 364 días
        self.assertEqual(expected_progress_pct(CREATED, TARGET_DATE, CREATED), 0.0)
        self.assertEqual(expected_progress_pct(CREATED, TARGET_DATE, date(2025, 12, 1)), 0.0)
        self.assertEqual(expected_progress_pct(CREATED, TARGET_DATE, date(2027, 3, 1)), 100.0)
        self.assertEqual(expected_progress_pct(TODAY, TODAY, TODAY), 100.0)


class MonthsAndMonthlySavingTests(unittest.TestCase):
    def test_months_left_counts_whole_months(self):
        cases = [
            (date(2027, 3, 31), 4),  # 4 meses y 5 días
            (date(2027, 3, 26), 4),
            (date(2027, 3, 15), 3),  # 3 meses y 17 días
            (date(2026, 12, 26), 1),
            (date(2026, 11, 30), 1),  # menos de un mes: mínimo 1
            (TODAY, 1),
            (date(2026, 11, 25), 0),  # vencida
        ]
        for target_date, expected in cases:
            self.assertEqual(months_left(target_date, TODAY), expected, target_date)
        self.assertEqual(months_left(date(2027, 2, 28), date(2027, 1, 31)), 1)

    def test_required_monthly_rounds_up_to_the_cent(self):
        self.assertEqual(required_monthly(D("620"), D("2000"), date(2027, 1, 31), TODAY), D("690.00"))
        self.assertEqual(required_monthly(D("0"), D("1000"), date(2027, 2, 26), TODAY), D("333.34"))  # 1000 / 3
        self.assertEqual(required_monthly(D("2000"), D("2000"), date(2027, 1, 31), TODAY), D("0.00"))
        self.assertEqual(required_monthly(D("2500"), D("2000"), date(2027, 1, 31), TODAY), D("0.00"))

    def test_overdue_goal_needs_everything_now(self):
        self.assertEqual(required_monthly(D("400"), D("1000"), date(2026, 10, 31), TODAY), D("600"))


class StatusTests(unittest.TestCase):
    # El 2 Jul se espera 50 %: "Atrasada" solo por debajo de 40 %.
    MIDYEAR = date(2026, 7, 2)

    def status(self, saved, today=MIDYEAR, created=CREATED, target_date=TARGET_DATE, target="1000"):
        return goal_status(D(saved), D(target), created, target_date, today)

    def test_behind_threshold_is_ten_points_below_expected(self):
        self.assertEqual(self.status("400"), IN_PROGRESS)  # exactamente 10 puntos por debajo
        self.assertEqual(self.status("399"), BEHIND)  # 39.9 %
        self.assertEqual(self.status("0"), BEHIND)
        self.assertEqual(self.status("700"), IN_PROGRESS)

    def test_young_goals_are_never_behind(self):
        created = date(2026, 6, 3)  # 29 días antes del 2 Jul
        self.assertFalse(is_behind(D("0"), D("1000"), created, date(2026, 7, 10), self.MIDYEAR))
        self.assertTrue(is_behind(D("0"), D("1000"), date(2026, 6, 2), date(2026, 7, 10), self.MIDYEAR))

    def test_reached_wins_even_after_the_target_date(self):
        self.assertEqual(self.status("1000"), REACHED)
        self.assertEqual(self.status("1500", today=date(2027, 2, 1)), REACHED)

    def test_overdue_when_the_date_passed_without_reaching_it(self):
        self.assertEqual(self.status("999.99", today=date(2027, 1, 1)), OVERDUE)
        self.assertEqual(self.status("10", today=TARGET_DATE), BEHIND)  # el último día aún no vence

    def test_contribution_dates(self):
        self.assertIsNone(contribution_date_error(TODAY, CREATED, TODAY))
        self.assertIsNone(contribution_date_error(CREATED, CREATED, TODAY))
        self.assertEqual(contribution_date_error(date(2026, 11, 27), CREATED, TODAY), FUTURE_DATE_ERROR)
        self.assertEqual(contribution_date_error(date(2025, 12, 31), CREATED, TODAY), BEFORE_GOAL_ERROR)


class SeriesAndEstimateTests(unittest.TestCase):
    def test_monthly_series_covers_the_last_twelve_months(self):
        movements = [
            aporte(date(2026, 9, 3), "300"),
            aporte(date(2026, 9, 20), "50"),
            retiro(date(2026, 10, 8), "100"),
            aporte(date(2025, 11, 30), "999"),  # fuera de la ventana
        ]

        series = monthly_series(movements, TODAY)

        self.assertEqual(len(series), 12)
        self.assertEqual((series[0]["mes"], series[-1]["mes"]), ("2025-12", "2026-11"))
        by_month = {item["mes"]: item["aportado"] for item in series}
        self.assertEqual((by_month["2026-09"], by_month["2026-10"], by_month["2026-11"]), (D("350"), D("-100"), D("0.00")))

    def test_pace_and_estimate_with_contributions_every_month(self):
        movements = [aporte(date(2026, 9, 2), "500"), aporte(date(2026, 10, 2), "500"), aporte(date(2026, 11, 2), "500")]

        self.assertEqual(monthly_pace(movements, TODAY), 500.0)
        # Faltan 1500 a 500 por mes: 3 meses desde hoy.
        self.assertEqual(estimated_completion(movements, D("3000"), TODAY), date(2027, 2, 26))
        # 1600 / 500 = 3.2 -> 4 meses.
        self.assertEqual(estimated_completion(movements, D("3100"), TODAY), date(2027, 3, 26))

    def test_current_month_without_movements_does_not_lower_the_pace(self):
        movements = [aporte(date(2026, 9, 2), "600"), aporte(date(2026, 10, 2), "600")]

        self.assertEqual(monthly_pace(movements, TODAY), 600.0)
        self.assertEqual(estimated_completion(movements, D("3000"), TODAY), date(2027, 2, 26))

    def test_pace_uses_only_the_last_six_months(self):
        movements = [aporte(date(2026, 1, 5), "1200"), aporte(date(2026, 6, 5), "300"), aporte(date(2026, 11, 5), "300")]

        # Ventana Jun..Nov: (300 + 0 + 0 + 0 + 0 + 300) / 6 = 100.
        self.assertEqual(monthly_pace(movements, TODAY), 100.0)

    def test_without_pace_there_is_no_estimate(self):
        withdrawn = [aporte(date(2026, 9, 2), "500"), retiro(date(2026, 10, 2), "600"), aporte(date(2025, 1, 1), "200")]
        stale = [aporte(date(2025, 3, 1), "800")]

        self.assertLessEqual(monthly_pace(withdrawn, TODAY), 0)
        self.assertIsNone(estimated_completion(withdrawn, D("1000"), TODAY))
        self.assertIsNone(estimated_completion(stale, D("1000"), TODAY))
        self.assertIsNone(estimated_completion([], D("1000"), TODAY))
        self.assertIsNone(estimated_completion([aporte(TODAY, "1000")], D("1000"), TODAY))  # ya alcanzada

    def test_add_months_clamps_to_the_end_of_month(self):
        self.assertEqual(add_months(date(2027, 1, 31), 1), date(2027, 2, 28))
        self.assertEqual(add_months(date(2026, 11, 26), 14), date(2028, 1, 26))

    def test_snapshot(self):
        movements = [aporte(date(2026, 6, 10), "300"), aporte(date(2026, 7, 5), "320")]

        result = snapshot(movements, D("2000"), date(2026, 6, 10), date(2027, 1, 31), TODAY)

        self.assertEqual((result.saved, result.remaining, result.progress), (D("620"), D("1380"), 31.0))
        self.assertEqual((result.expected, result.months_left, result.required_monthly), (71.9, 2, D("690.00")))
        self.assertEqual((result.status, result.color, result.is_behind, result.is_reached), (BEHIND, "amber", True, False))
        # Ventana Jun..Oct (noviembre aún sin aportes): 620 / 5 = 124 por mes -> 12 meses.
        self.assertEqual(result.estimated, date(2027, 11, 26))


if __name__ == "__main__":
    unittest.main()
