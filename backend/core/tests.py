from decimal import Decimal

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from .alerts import AlertRule
from .models import FinanceAlert, FinanceBudget
from .periods import current_period, local_today, period_label
from .testing import API, FinanceAPITestCase, local_datetime


class AuthenticationTests(FinanceAPITestCase):
    def test_finance_endpoints_require_authentication(self):
        anonymous = APIClient()
        for path in ("cuentas/", "dashboard/resumen/", "transacciones/", "presupuestos/", "periodos/", "categorias/", "impuestos/renta/"):
            self.assertEqual(anonymous.get(f"{API}/{path}").status_code, 401, path)


class ZeroStateTests(FinanceAPITestCase):
    def test_new_users_start_with_zero_finances_in_the_current_month(self):
        dashboard = self.client.get(f"{API}/dashboard/resumen/")
        transactions = self.client.get(f"{API}/transacciones/")
        budgets = self.client.get(f"{API}/presupuestos/")
        accounts = self.client.get(f"{API}/cuentas/")
        alerts = self.client.get(f"{API}/alertas/")

        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(dashboard.data["mes"], current_period())
        self.assertEqual(dashboard.data["balance_total"], Decimal("0.00"))
        self.assertEqual(dashboard.data["ingresos_mensuales"], Decimal("0.00"))
        self.assertEqual(dashboard.data["ingresos_variacion"], "0.0%")
        self.assertEqual(dashboard.data["ultimas_transacciones"], [])
        self.assertEqual(transactions.data["mes"], current_period())
        self.assertEqual(transactions.data["grupos"], [])
        self.assertEqual((transactions.data["count"], transactions.data["pages"]), (0, 1))
        self.assertEqual(budgets.data["mes"], current_period())
        self.assertEqual(budgets.data["categorias"], [])
        self.assertEqual(budgets.data["ia_alert"], {"titulo": "", "resumen": "", "sugerencia": "", "nivel": "", "accion": None})
        self.assertEqual(dashboard.data["alertas_activas"], [])
        self.assertEqual(accounts.data["accounts"], [])
        self.assertEqual(accounts.data["patrimonio"], Decimal("0.00"))
        self.assertEqual(alerts.data["items"], [])

    def test_invalid_period_is_rejected_in_spanish(self):
        response = self.client.get(f"{API}/presupuestos/", {"mes": "2024-13"})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["mes"], ["El período debe tener formato AAAA-MM."])

    def test_budget_month_defaults_to_current_period(self):
        budget = FinanceBudget.objects.create(owner=self.user, category="Ocio", limit_amount=Decimal("50.00"))

        self.assertEqual(budget.month, current_period())


class DashboardTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.account = self.open_account(balance="500.00", opened_at=local_datetime(2024, 3, 1))
        self.post_movement(self.account, "Sueldo", "Salario", "3000.00", "INGRESO", "2024-04-10T12:00:00Z")
        self.post_movement(self.account, "Mercado", "Alimentación", "300.00", "GASTO", "2024-05-02T12:00:00Z")
        self.post_movement(self.account, "Taxi", "Transporte", "100.00", "GASTO", "2024-05-03T12:00:00Z")

    def test_charts_are_built_from_real_movements(self):
        response = self.client.get(f"{API}/dashboard/resumen/", {"mes": "2024-05"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [(point["periodo"], point["value"]) for point in response.data["evolucion_saldo"]],
            [("2024-03", 500.0), ("2024-04", 3500.0), ("2024-05", 3100.0)],
        )
        self.assertEqual(response.data["evolucion_periodo"], "Mar 24 - May 24")
        self.assertEqual(response.data["evolucion_tendencia"], "+520.0%")
        self.assertEqual(
            [(item["name"], item["value"]) for item in response.data["distribucion_gastos"]],
            [("Alimentación", 75.0), ("Transporte", 25.0)],
        )

    def test_monthly_totals_and_variations(self):
        data = self.client.get(f"{API}/dashboard/resumen/", {"mes": "2024-05"}).data

        self.assertEqual(data["ingresos_mensuales"], Decimal("0.00"))
        self.assertEqual(data["gastos_mensuales"], Decimal("400.00"))
        self.assertEqual((data["ingresos_variacion"], data["ingresos_variacion_pct"]), ("-100.0%", -100.0))
        self.assertEqual((data["gastos_variacion"], data["gastos_variacion_pct"]), ("—", None))
        self.assertEqual((data["balance_variacion"], data["balance_variacion_pct"]), ("-11.4% vs mes anterior", -11.4))
        self.assertEqual(data["balance_total"], Decimal("3100.00"))
        self.assertEqual([item["nombre"] for item in data["ultimas_transacciones"]], ["Taxi", "Mercado"])

    def test_opening_balance_and_transfers_are_not_income(self):
        savings = self.open_account(name="Ahorro", balance="1000.00", opened_at=local_datetime(2024, 5, 1))
        self.account.transfer_to(savings, Decimal("200.00"), occurred_at=local_datetime(2024, 5, 4))

        data = self.client.get(f"{API}/dashboard/resumen/", {"mes": "2024-05"}).data

        self.assertEqual(data["ingresos_mensuales"], Decimal("0.00"))
        self.assertEqual(data["gastos_mensuales"], Decimal("400.00"))
        self.assertEqual(data["evolucion_saldo"][-1]["value"], 4100.0)

    def test_large_totals_do_not_break_the_dashboard(self):
        rich = self.open_account(name="Grande", balance="9999999999.99")

        response = self.client.get(f"{API}/dashboard/resumen/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["balance_total"], rich.balance + Decimal("3100.00"))

    def test_budget_totals_use_computed_spending(self):
        FinanceBudget.objects.create(owner=self.user, month="2024-05", category="alimentación", limit_amount=Decimal("400.00"))

        data = self.client.get(f"{API}/dashboard/resumen/", {"mes": "2024-05"}).data

        self.assertEqual(data["presupuesto_consumido"], Decimal("300.00"))
        self.assertEqual(data["presupuesto_restante"], Decimal("100.00"))
        self.assertEqual(data["presupuesto_porcentaje"], 75.0)


class IncomeTaxTests(FinanceAPITestCase):
    def test_only_regular_income_counts_as_salary(self):
        account = self.open_account(balance="5000.00", opened_at=local_datetime(2025, 1, 1))
        other = self.open_account(name="Otra", opened_at=local_datetime(2025, 1, 1))
        self.post_movement(account, "Sueldo 2025", "Salario", "60000.00", "INGRESO", "2025-06-30T12:00:00Z")
        self.post_movement(account, "Sueldo 2024", "Salario", "1000.00", "INGRESO", "2024-06-30T12:00:00Z")
        account.deposit(Decimal("700.00"), occurred_at=local_datetime(2025, 7, 1))
        account.transfer_to(other, Decimal("300.00"), occurred_at=local_datetime(2025, 7, 2))
        other.adjust_balance(Decimal("900.00"), occurred_at=local_datetime(2025, 7, 3))

        response = self.client.get(f"{API}/impuestos/renta/", {"anio": 2025})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["fuente"], "movimientos")
        self.assertEqual(response.data["ingreso_bruto"], Decimal("60000.00"))
        self.assertEqual(response.data["renta_neta"], Decimal("22550.00"))
        self.assertEqual(response.data["impuesto"], Decimal("1804.00"))
        self.assertEqual(len(response.data["tramos"]), 1)

    def test_year_uses_local_time(self):
        account = self.open_account(opened_at=local_datetime(2024, 1, 1))
        self.post_movement(account, "Bono", "Salario", "100.00", "INGRESO", "2026-01-01T03:00:00Z")

        response = self.client.get(f"{API}/impuestos/renta/", {"anio": 2025})

        self.assertEqual(response.data["ingreso_bruto"], Decimal("100.00"))

    def test_default_year_is_current_year(self):
        response = self.client.get(f"{API}/impuestos/renta/", {"ingreso_anual": "1000"})

        self.assertEqual(response.data["anio"], local_today().year)

    def test_manual_income_and_validation(self):
        response = self.client.get(f"{API}/impuestos/renta/", {"anio": 2025, "ingreso_anual": "150000"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["fuente"], "manual")
        self.assertEqual(response.data["impuesto"], Decimal("14318.50"))
        self.assertEqual(self.client.get(f"{API}/impuestos/renta/", {"anio": 2001}).status_code, 400)
        self.assertEqual(self.client.get(f"{API}/impuestos/renta/", {"ingreso_anual": "-5"}).status_code, 400)


class AlertTests(FinanceAPITestCase):
    def test_dismissed_alert_is_not_returned(self):
        alert = FinanceAlert.objects.create(owner=self.user, title="Aviso", description="Detalle")

        response = self.client.post(f"{API}/alertas/{alert.id}/accion/", {"action": "dismiss"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(f"{API}/alertas/").data["items"], [])

    def test_filters_are_counted_with_a_constant_number_of_queries(self):
        rules = (AlertRule.ATYPICAL_EXPENSE, AlertRule.ATYPICAL_EXPENSE, AlertRule.BUDGET_THRESHOLD)
        for index, rule in enumerate(rules):
            FinanceAlert.objects.create(owner=self.user, title="Aviso", description="Detalle", rule=rule, dedupe_key=f"manual:{index}")
        self.client.get(f"{API}/alertas/")  # primera visita: evalúa el mes una vez

        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(f"{API}/alertas/")

        self.assertEqual(
            response.data["filters"],
            ["Todas (3)", "Presupuesto (1)", "Ritmo de gasto (0)", "Gasto inusual (2)", "Balance mensual (0)"],
        )
        self.assertLessEqual(len(queries), 3)


class PeriodCatalogTests(FinanceAPITestCase):
    def test_lists_months_with_data_plus_current_newest_first(self):
        account = self.open_account(balance="10.00", opened_at=local_datetime(2024, 3, 1))
        self.post_movement(account, "Sueldo", "Salario", "100.00", "INGRESO", "2024-05-01T04:00:00Z")
        FinanceBudget.objects.create(owner=self.user, month="2024-08", category="Ocio", limit_amount=Decimal("10.00"))
        FinanceBudget.objects.create(owner=self.other_user, month="2023-01", category="Ocio", limit_amount=Decimal("10.00"))

        data = self.client.get(f"{API}/periodos/").data

        current = current_period()
        self.assertEqual(data["actual"], current)
        self.assertEqual([item["mes"] for item in data["periodos"]], [current, "2024-08", "2024-04", "2024-03"])
        self.assertEqual(data["periodos"][0], {"mes": current, "etiqueta": period_label(current), "es_actual": True})
        self.assertEqual(data["periodos"][1]["etiqueta"], "Agosto 2024")


class CategoryCatalogTests(FinanceAPITestCase):
    def test_merges_user_categories_with_defaults(self):
        account = self.open_account(balance="100.00")
        for name in ("Mercado", "Menú"):
            self.post_movement(account, name, "alimentación", "5.00", "GASTO", "2024-05-02T12:00:00Z")
        self.post_movement(account, "Gimnasio", "Deporte", "5.00", "GASTO", "2024-05-02T12:00:00Z")
        FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Mascotas", limit_amount=Decimal("10.00"))

        categories = {item["nombre"]: item for item in self.client.get(f"{API}/categorias/").data["categorias"]}

        self.assertEqual(categories["Alimentación"]["movimientos"], 2)
        self.assertTrue(categories["Alimentación"]["predeterminada"])
        self.assertEqual(categories["Deporte"], {"nombre": "Deporte", "predeterminada": False, "tipos": ["GASTO"], "movimientos": 1})
        self.assertIn("Mascotas", categories)
        self.assertEqual(categories["Salario"]["tipos"], ["INGRESO"])
        self.assertNotIn("Saldo inicial", categories)
        self.assertEqual(len([name for name in categories if name.casefold() == "alimentación"]), 1)
