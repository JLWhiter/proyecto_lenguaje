"""Pruebas unitarias (unittest) del análisis con Pandas y NumPy."""

import unittest
from datetime import datetime, timezone
from decimal import Decimal

import numpy as np

from core.analytics import (
    UNCATEGORIZED,
    clean_transactions,
    dashboard_charts,
    expense_distribution,
    month_window,
    monthly_summary,
    percent_change,
    percentages_summing_100,
    trend_percentage,
)

TZ = "America/Lima"


def record(id, when, category, kind, amount, status="Completado", in_summary=True):
    return {
        "id": id,
        "occurred_at": when,
        "category": category,
        "transaction_type": kind,
        "amount": amount,
        "status": status,
        "count_in_summary": in_summary,
    }


def utc(year, month, day, hour=12):
    return datetime(year, month, day, hour, tzinfo=timezone.utc)


# Saldo inicial 500 (feb). Movimientos: +3000 (mar), -200 (abr), -300 -100 +1000 (may)
# y una transferencia interna en mayo. Ni el saldo inicial ni la transferencia
# cuentan en el resumen de ingresos y gastos.
RECORDS = [
    record(0, utc(2024, 2, 1), "Saldo inicial", "INGRESO", Decimal("500.00"), status="Acreditado", in_summary=False),
    record(1, utc(2024, 3, 10), "Salario", "INGRESO", Decimal("3000.00"), status="Acreditado"),
    record(2, utc(2024, 4, 5), "Alimentación", "GASTO", Decimal("200.00")),
    record(3, utc(2024, 5, 2), " alimentación ", "GASTO", Decimal("300.00")),
    record(4, utc(2024, 5, 3), "Transporte", "GASTO", Decimal("100.00")),
    record(5, utc(2024, 5, 20), "Salario", "INGRESO", Decimal("1000.00"), status="Acreditado"),
    record(6, utc(2024, 5, 21), "Transferencia", "GASTO", Decimal("50.00"), in_summary=False),
    record(7, utc(2024, 5, 21), "Transferencia", "INGRESO", Decimal("50.00"), status="Acreditado", in_summary=False),
]
CURRENT_BALANCE = Decimal("3900.00")


class CleanTransactionsTests(unittest.TestCase):
    def test_discards_invalid_rows_and_normalizes_values(self):
        dirty = [
            record(1, utc(2024, 5, 1), "  comida   rápida ", " gasto ", Decimal("10.50")),
            record(2, utc(2024, 5, 1), "", "INGRESO", "25"),
            record(3, utc(2024, 5, 1), "Otro", "GASTO", None),
            record(4, utc(2024, 5, 1), "Otro", "GASTO", "abc"),
            record(5, utc(2024, 5, 1), "Otro", "GASTO", Decimal("0")),
            record(6, utc(2024, 5, 1), "Otro", "GASTO", Decimal("-8")),
            record(7, None, "Otro", "GASTO", Decimal("8")),
            record(8, utc(2024, 5, 1), "Otro", "REEMBOLSO", Decimal("8")),
            record(1, utc(2024, 5, 1), "Duplicado", "GASTO", Decimal("10.50")),
        ]

        frame = clean_transactions(dirty, TZ)

        self.assertEqual(frame["id"].tolist(), [1, 2])
        self.assertEqual(frame["category"].tolist(), ["Comida rápida", UNCATEGORIZED])
        self.assertEqual(frame["type"].tolist(), ["GASTO", "INGRESO"])
        self.assertEqual(frame["amount_cents"].tolist(), [1050, 2500])
        self.assertEqual(frame["signed_cents"].tolist(), [-1050, 2500])
        self.assertEqual(frame["amount_cents"].dtype, np.int64)

    def test_months_use_local_time(self):
        # 1 de junio 03:00 UTC es todavía 31 de mayo en Lima (UTC-5).
        frame = clean_transactions([record(1, utc(2024, 6, 1, hour=3), "Taxi", "GASTO", Decimal("5"))], TZ)

        self.assertEqual(frame["month"].tolist(), ["2024-05"])

    def test_only_completed_movements_count_in_summary(self):
        frame = clean_transactions(
            [
                record(1, utc(2024, 5, 1), "A", "GASTO", Decimal("1")),
                record(2, utc(2024, 5, 1), "A", "GASTO", Decimal("1"), status="Pendiente"),
                record(3, utc(2024, 5, 1), "A", "GASTO", Decimal("1"), in_summary=False),
            ],
            TZ,
        )

        self.assertEqual(frame["in_summary"].tolist(), [True, False, False])

    def test_empty_input(self):
        frame = clean_transactions([], TZ)

        self.assertTrue(frame.empty)


class NumpyHelpersTests(unittest.TestCase):
    def test_month_window_crosses_years(self):
        self.assertEqual(month_window("2024-02", 3), ["2023-12", "2024-01", "2024-02"])

    def test_trend_percentage(self):
        self.assertAlmostEqual(trend_percentage([500, 3500, 3900]), 680.0)
        self.assertEqual(trend_percentage([0, 100]), 0.0)
        self.assertEqual(trend_percentage([100]), 0.0)

    def test_percent_change(self):
        self.assertAlmostEqual(percent_change(200, 250), 25.0)
        self.assertAlmostEqual(percent_change(-100, 50), 150.0)
        self.assertIsNone(percent_change(0, 80))
        self.assertEqual(percent_change(0, 0), 0.0)

    def test_percentages_always_sum_100(self):
        result = percentages_summing_100([1, 1, 1])

        self.assertEqual(result.tolist(), [33.4, 33.3, 33.3])
        self.assertEqual(int(round(result.sum() * 10)), 1000)


class DashboardChartsTests(unittest.TestCase):
    def test_balance_evolution_starts_with_opening_balance(self):
        charts = dashboard_charts(RECORDS, "2024-05", CURRENT_BALANCE, TZ)

        self.assertEqual(
            charts["evolucion_saldo"],
            [
                {"name": "Feb", "periodo": "2024-02", "value": 500.0},
                {"name": "Mar", "periodo": "2024-03", "value": 3500.0},
                {"name": "Abr", "periodo": "2024-04", "value": 3300.0},
                {"name": "May", "periodo": "2024-05", "value": 3900.0},
            ],
        )
        self.assertEqual(charts["evolucion_periodo"], "Feb 24 - May 24")
        self.assertEqual(charts["evolucion_tendencia"], "+680.0%")

    def test_past_month_subtracts_later_movements(self):
        charts = dashboard_charts(RECORDS, "2024-04", CURRENT_BALANCE, TZ)

        self.assertEqual([point["value"] for point in charts["evolucion_saldo"]], [500.0, 3500.0, 3300.0])

    def test_window_is_limited_to_six_months(self):
        early = record(99, utc(2023, 1, 15), "Salario", "INGRESO", Decimal("10"))

        charts = dashboard_charts([early, *RECORDS], "2024-05", CURRENT_BALANCE, TZ)

        self.assertEqual([point["periodo"] for point in charts["evolucion_saldo"]], month_window("2024-05", 6))

    def test_expense_distribution_groups_categories_and_skips_transfers(self):
        charts = dashboard_charts(RECORDS, "2024-05", CURRENT_BALANCE, TZ)

        self.assertEqual(
            [(item["name"], item["value"], item["monto"]) for item in charts["distribucion_gastos"]],
            [("Alimentación", 75.0, 300.0), ("Transporte", 25.0, 100.0)],
        )

    def test_expense_distribution_ignores_accents(self):
        records = [
            record(1, utc(2024, 5, 2), "Alimentación", "GASTO", Decimal("60.00")),
            record(2, utc(2024, 5, 3), "alimentacion", "GASTO", Decimal("15.00")),
            record(3, utc(2024, 5, 4), "ALIMENTACIÓN", "GASTO", Decimal("25.00")),
            record(4, utc(2024, 5, 5), "Educacion", "GASTO", Decimal("50.00")),
            record(5, utc(2024, 5, 6), "Educación", "GASTO", Decimal("50.00")),
        ]

        result = expense_distribution(clean_transactions(records, TZ), "2024-05")

        self.assertEqual(
            [(item["name"], item["value"], item["monto"]) for item in result],
            [("Alimentación", 50.0, 100.0), ("Educacion", 50.0, 100.0)],
        )

    def test_small_categories_are_grouped(self):
        records = [record(index, utc(2024, 5, 1), f"Cat {index}", "GASTO", Decimal(100 - index)) for index in range(6)]

        result = expense_distribution(clean_transactions(records, TZ), "2024-05")

        self.assertEqual([item["name"] for item in result], ["Cat 0", "Cat 1", "Cat 2", "Cat 3", "Otras categorías"])
        self.assertEqual(result[-1]["monto"], 96.0 + 95.0)

    def test_monthly_summary_compares_with_previous_month(self):
        summary = monthly_summary(clean_transactions(RECORDS, TZ), "2024-05", 390000)

        self.assertEqual(summary["ingresos_mensuales"], Decimal("1000.00"))
        self.assertEqual(summary["gastos_mensuales"], Decimal("400.00"))
        self.assertEqual(summary["balance_cierre"], Decimal("3900.00"))
        self.assertEqual((summary["ingresos_variacion"], summary["ingresos_variacion_pct"]), ("—", None))
        self.assertEqual((summary["gastos_variacion"], summary["gastos_variacion_pct"]), ("+100.0%", 100.0))
        self.assertEqual((summary["balance_variacion"], summary["balance_variacion_pct"]), ("+18.2% vs mes anterior", 18.2))

    def test_monthly_summary_of_a_past_month(self):
        summary = monthly_summary(clean_transactions(RECORDS, TZ), "2024-03", 390000)

        self.assertEqual(summary["ingresos_mensuales"], Decimal("3000.00"))
        self.assertEqual(summary["balance_cierre"], Decimal("3500.00"))
        self.assertEqual(summary["balance_variacion_pct"], 600.0)

    def test_no_movements_gives_empty_charts(self):
        charts = dashboard_charts([], "2024-05", Decimal("1000"), TZ)

        self.assertEqual(charts["evolucion_saldo"], [])
        self.assertEqual(charts["distribucion_gastos"], [])
        self.assertEqual(charts["evolucion_tendencia"], "0.0%")
        self.assertEqual(charts["ingresos_mensuales"], Decimal("0.00"))
        self.assertEqual(charts["balance_variacion"], "0.0% vs mes anterior")

    def test_month_before_any_movement_gives_empty_evolution(self):
        charts = dashboard_charts(RECORDS, "2023-06", CURRENT_BALANCE, TZ)

        self.assertEqual(charts["evolucion_saldo"], [])


if __name__ == "__main__":
    unittest.main()
