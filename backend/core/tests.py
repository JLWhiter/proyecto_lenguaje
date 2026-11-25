from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import FinanceAccount, FinanceAlert, FinanceBudget, FinanceProfile, FinanceTransaction

User = get_user_model()


class FinanceApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="finance@example.com",
            full_name="Finance User",
            password="Finova#2026",
        )
        self.other_user = User.objects.create_user(
            email="other@example.com",
            full_name="Other User",
            password="Finova#2026",
        )
        self.client = APIClient()

    def authenticate(self):
        self.client.force_authenticate(user=self.user)

    def test_finance_endpoints_require_authentication(self):
        response = self.client.get("/api/v1/cuentas/")

        self.assertEqual(response.status_code, 401)

    def test_new_users_start_with_zero_finances(self):
        self.authenticate()

        accounts = self.client.get("/api/v1/cuentas/")
        dashboard = self.client.get("/api/v1/dashboard/resumen/?mes=2024-05")
        transactions = self.client.get("/api/v1/transacciones/?mes=2024-05")
        budgets = self.client.get("/api/v1/presupuestos/?mes=2024-05")
        alerts = self.client.get("/api/v1/alertas/")

        self.assertEqual(accounts.status_code, 200)
        self.assertEqual(accounts.data["cuentas"], [])
        self.assertEqual(accounts.data["patrimonio"], Decimal("0.00"))
        self.assertEqual(dashboard.data["balance_total"], Decimal("0.00"))
        self.assertEqual(dashboard.data["ingresos_mensuales"], Decimal("0.00"))
        self.assertEqual(dashboard.data["gastos_mensuales"], Decimal("0.00"))
        self.assertEqual(transactions.data["grupos"], [])
        self.assertEqual(transactions.data["total_ingresos"], Decimal("0.00"))
        self.assertEqual(budgets.data["categorias"], [])
        self.assertEqual(alerts.data["items"], [])
        self.assertEqual(FinanceAccount.objects.filter(owner=self.user).count(), 0)
        self.assertEqual(FinanceAccount.objects.filter(owner=self.other_user).count(), 0)

        created = self.client.post(
            "/api/v1/cuentas/",
            {"name": "Primera cuenta", "account_type": "Ahorros", "balance": "125.00"},
            format="json",
        )
        dashboard_after_account = self.client.get("/api/v1/dashboard/resumen/?mes=2024-05")
        transactions_after_account = self.client.get("/api/v1/transacciones/?mes=2024-05")

        self.assertEqual(created.status_code, 201)
        self.assertEqual(FinanceAccount.objects.filter(owner=self.user).count(), 1)
        self.assertEqual(dashboard_after_account.data["balance_total"], Decimal("125.00"))
        self.assertEqual(dashboard_after_account.data["ingresos_mensuales"], Decimal("0.00"))
        self.assertEqual(dashboard_after_account.data["gastos_mensuales"], Decimal("0.00"))
        self.assertEqual(transactions_after_account.data["grupos"], [])

    def test_legacy_user_data_is_preserved(self):
        self.authenticate()
        FinanceProfile.objects.create(owner=self.user, use_sample_data=True)
        saved_account = FinanceAccount.objects.create(
            owner=self.user,
            name="Mi cuenta guardada",
            account_type="Ahorros",
            balance=Decimal("125.00"),
        )

        response = self.client.get("/api/v1/cuentas/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["cuentas"][0]["id"], saved_account.id)
        self.assertEqual(response.data["patrimonio"], Decimal("125.00"))
        self.assertEqual(FinanceAccount.objects.filter(owner=self.user).count(), 1)

    def test_budget_and_transaction_reads_are_scoped_to_selected_month(self):
        self.authenticate()

        budgets = self.client.get("/api/v1/presupuestos/?mes=2024-04")
        transactions = self.client.get("/api/v1/transacciones/?mes=2024-04")

        self.assertEqual(budgets.status_code, 200)
        self.assertEqual(budgets.data["categorias"], [])
        self.assertEqual(transactions.status_code, 200)
        self.assertEqual(transactions.data["grupos"], [])
        self.assertEqual(transactions.data["total_ingresos"], Decimal("0.00"))

    def test_expense_updates_account_budget_and_transaction_history(self):
        self.authenticate()
        account = FinanceAccount.objects.create(
            owner=self.user,
            name="Test debit",
            account_type="Cuenta Corriente",
            balance=Decimal("500.00"),
        )
        budget = FinanceBudget.objects.create(
            owner=self.user,
            category="Alimentación",
            limit_amount=Decimal("300.00"),
        )

        response = self.client.post(
            "/api/v1/transacciones/",
            {
                "name": "Mercado",
                "category": "Alimentación",
                "amount": "45.50",
                "type": "GASTO",
                "account_id": account.id,
                "occurred_at": "2024-05-24T12:00:00Z",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        account.refresh_from_db()
        budget.refresh_from_db()
        self.assertEqual(account.balance, Decimal("454.50"))
        self.assertEqual(budget.spent_amount, Decimal("45.50"))
        self.assertEqual(FinanceTransaction.objects.filter(owner=self.user).count(), 1)

    def test_transaction_rejects_insufficient_funds(self):
        self.authenticate()
        account = FinanceAccount.objects.create(
            owner=self.user,
            name="Empty account",
            account_type="Cuenta Corriente",
            balance=Decimal("10.00"),
        )

        response = self.client.post(
            "/api/v1/transacciones/",
            {"name": "Compra", "category": "Otros", "amount": "20.00", "type": "GASTO", "account_id": account.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(FinanceTransaction.objects.filter(owner=self.user).count(), 0)

    def test_transfer_moves_balance_without_counting_as_income_or_expense(self):
        self.authenticate()
        source = FinanceAccount.objects.create(owner=self.user, name="Source", account_type="Ahorros", balance=Decimal("200.00"))
        destination = FinanceAccount.objects.create(owner=self.user, name="Destination", account_type="Ahorros", balance=Decimal("10.00"))

        response = self.client.post(
            "/api/v1/transacciones/transferir/",
            {"source_account_id": source.id, "destination_account_id": destination.id, "amount": "60.00"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        source.refresh_from_db()
        destination.refresh_from_db()
        self.assertEqual(source.balance, Decimal("140.00"))
        self.assertEqual(destination.balance, Decimal("70.00"))
        self.assertEqual(FinanceTransaction.objects.filter(owner=self.user, count_in_summary=False).count(), 2)

    def test_deposit_increases_balance_and_records_income(self):
        self.authenticate()
        account = FinanceAccount.objects.create(owner=self.user, name="Wallet", account_type="Billetera", balance=Decimal("25.00"))

        response = self.client.post(
            "/api/v1/transacciones/depositar/",
            {"account_id": account.id, "amount": "30.00", "description": "Efectivo"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        account.refresh_from_db()
        self.assertEqual(account.balance, Decimal("55.00"))

    def test_budget_can_be_created_adjusted_and_deleted(self):
        self.authenticate()
        create = self.client.post(
            "/api/v1/presupuestos/",
            {"category": "Mascotas", "description": "Alimento", "limit_amount": "250.00"},
            format="json",
        )
        self.assertEqual(create.status_code, 201)
        budget_id = create.data["data"]["id"]

        update = self.client.patch(
            f"/api/v1/presupuestos/{budget_id}/ajustar/",
            {"limit_amount": "300.00"},
            format="json",
        )
        self.assertEqual(update.status_code, 200)
        self.assertEqual(update.data["data"]["presupuesto"], Decimal("300.00"))
        self.assertEqual(self.client.delete(f"/api/v1/presupuestos/{budget_id}/ajustar/").status_code, 204)

    def test_alert_can_be_dismissed_and_is_not_returned(self):
        self.authenticate()
        alert = FinanceAlert.objects.create(owner=self.user, title="Aviso", description="Detalle", category="Metas")

        response = self.client.post(f"/api/v1/alertas/{alert.id}/accion/", {"action": "dismiss"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/v1/alertas/").data["items"], [])

    def test_export_is_csv_for_authenticated_user(self):
        self.authenticate()

        response = self.client.get("/api/v1/transacciones/exportar/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response["Content-Type"])

    def create_movement(self, account, name, category, amount, kind, occurred_at):
        response = self.client.post(
            "/api/v1/transacciones/",
            {"name": name, "category": category, "amount": amount, "type": kind, "account_id": account.id, "occurred_at": occurred_at},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

    def test_dashboard_charts_are_built_from_real_movements(self):
        self.authenticate()
        account = FinanceAccount.objects.create(owner=self.user, name="Principal", account_type="Ahorros", balance=Decimal("500.00"))
        self.create_movement(account, "Sueldo", "Salario", "3000.00", "INGRESO", "2024-04-10T12:00:00Z")
        self.create_movement(account, "Mercado", "Alimentación", "300.00", "GASTO", "2024-05-02T12:00:00Z")
        self.create_movement(account, "Taxi", "Transporte", "100.00", "GASTO", "2024-05-03T12:00:00Z")

        response = self.client.get("/api/v1/dashboard/resumen/?mes=2024-05")

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

    def test_transactions_can_be_filtered_by_category_type_and_search(self):
        self.authenticate()
        account = FinanceAccount.objects.create(owner=self.user, name="Principal", account_type="Ahorros", balance=Decimal("1000.00"))
        self.create_movement(account, "Supermercado", "Alimentación", "50.00", "GASTO", "2024-05-02T12:00:00Z")
        self.create_movement(account, "Menú", "ALIMENTACIÓN", "15.00", "GASTO", "2024-05-03T12:00:00Z")
        self.create_movement(account, "Taxi", "Transporte", "20.00", "GASTO", "2024-05-04T12:00:00Z")
        self.create_movement(account, "Bono", "Salario", "200.00", "INGRESO", "2024-05-05T12:00:00Z")

        def search(**filters):
            response = self.client.get("/api/v1/transacciones/", {"mes": "2024-05", **filters})
            self.assertEqual(response.status_code, 200)
            items = [item for group in response.data["grupos"] for item in group["items"]]
            total = sum((group["total"] for group in response.data["grupos"]), Decimal("0.00"))
            return sorted(item["nombre"] for item in items), total

        self.assertEqual(search(categoria="alimentación"), (["Menú", "Supermercado"], Decimal("-65.00")))
        self.assertEqual(search(tipo="INGRESO"), (["Bono"], Decimal("200.00")))
        self.assertEqual(search(search="taxi"), (["Taxi"], Decimal("-20.00")))
        self.assertEqual(search(categoria="alimentación", search="menú"), (["Menú"], Decimal("-15.00")))
        self.assertEqual(search(), (["Bono", "Menú", "Supermercado", "Taxi"], Decimal("115.00")))

    def test_income_tax_uses_registered_income_of_the_year(self):
        self.authenticate()
        account = FinanceAccount.objects.create(owner=self.user, name="Principal", account_type="Ahorros", balance=Decimal("0.00"))
        self.create_movement(account, "Sueldo 2025", "Salario", "60000.00", "INGRESO", "2025-06-30T12:00:00Z")
        self.create_movement(account, "Sueldo 2024", "Salario", "1000.00", "INGRESO", "2024-06-30T12:00:00Z")

        response = self.client.get("/api/v1/impuestos/renta/", {"anio": 2025})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["fuente"], "movimientos")
        self.assertEqual(response.data["ingreso_bruto"], Decimal("60000.00"))
        self.assertEqual(response.data["renta_neta"], Decimal("22550.00"))
        self.assertEqual(response.data["impuesto"], Decimal("1804.00"))
        self.assertEqual(len(response.data["tramos"]), 1)

    def test_income_tax_accepts_manual_income_and_validates_input(self):
        self.authenticate()

        response = self.client.get("/api/v1/impuestos/renta/", {"anio": 2025, "ingreso_anual": "150000"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["fuente"], "manual")
        self.assertEqual(response.data["impuesto"], Decimal("14318.50"))
        self.assertEqual(self.client.get("/api/v1/impuestos/renta/", {"anio": 2001}).status_code, 400)
        self.assertEqual(self.client.get("/api/v1/impuestos/renta/", {"ingreso_anual": "-5"}).status_code, 400)

    def test_income_tax_requires_authentication(self):
        self.assertEqual(self.client.get("/api/v1/impuestos/renta/").status_code, 401)
