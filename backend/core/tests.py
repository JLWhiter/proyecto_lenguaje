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
