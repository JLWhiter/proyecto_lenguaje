from decimal import Decimal

from django.db import connection
from django.test.utils import CaptureQueriesContext

from .models import FinanceBudget
from .periods import current_period, days_in_period, days_remaining, local_today, shift_month
from .testing import API, FinanceAPITestCase, local_datetime


class BudgetSpendingTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.account = self.open_account(balance="2000.00")
        self.other = self.open_account(name="Otra")

    def budgets(self, month="2024-05"):
        response = self.client.get(f"{API}/presupuestos/", {"mes": month})
        self.assertEqual(response.status_code, 200)
        return response.data

    def test_spent_is_computed_from_regular_expenses_of_the_month(self):
        FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Alimentación", limit_amount=Decimal("200.00"))
        self.post_movement(self.account, "Mercado", "alimentación", "50.00", "GASTO", "2024-05-02T12:00:00Z")
        self.post_movement(self.account, "Menú", "ALIMENTACIÓN", "25.00", "GASTO", "2024-05-31T23:00:00-05:00")
        self.post_movement(self.account, "Junio", "Alimentación", "99.00", "GASTO", "2024-06-01T00:30:00-05:00")
        self.post_movement(self.account, "Reembolso", "Alimentación", "10.00", "INGRESO", "2024-05-03T12:00:00Z")
        self.account.transfer_to(self.other, Decimal("300.00"), occurred_at=local_datetime(2024, 5, 4))
        FinanceBudget.objects.create(owner=self.other_user, month="2024-05", category="Alimentación", limit_amount=Decimal("1.00"))

        item = self.budgets()["categorias"][0]

        self.assertEqual(item["gastado"], Decimal("75.00"))
        self.assertEqual(item["restante"], Decimal("125.00"))
        self.assertEqual(item["porcentaje"], 37.5)
        self.assertEqual((item["estado"], item["color"]), ("Normal", "green"))

    def test_budget_created_after_expenses_sees_them(self):
        self.post_movement(self.account, "Taxi", "Transporte", "90.00", "GASTO", "2024-05-02T12:00:00Z")

        response = self.client.post(
            f"{API}/presupuestos/", {"month": "2024-05", "category": "transporte", "limit_amount": "100.00"}, format="json"
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["gastado"], Decimal("90.00"))
        self.assertEqual(response.data["data"]["estado"], "Crítico")

    def test_deleting_an_expense_updates_only_its_month(self):
        FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Ocio", limit_amount=Decimal("100.00"))
        FinanceBudget.objects.create(owner=self.user, month="2024-06", category="Ocio", limit_amount=Decimal("100.00"))
        self.post_movement(self.account, "Cine", "Ocio", "40.00", "GASTO", "2024-05-02T12:00:00Z")
        june = self.post_movement(self.account, "Cine", "Ocio", "30.00", "GASTO", "2024-06-02T12:00:00Z")

        self.client.delete(f"{API}/transacciones/{june.id}/")

        self.assertEqual(self.budgets("2024-05")["categorias"][0]["gastado"], Decimal("40.00"))
        self.assertEqual(self.budgets("2024-06")["categorias"][0]["gastado"], Decimal("0.00"))

    def test_states_summary_and_filters(self):
        for category, limit in (("A", "100"), ("B", "100"), ("C", "100"), ("D", "100")):
            FinanceBudget.objects.create(owner=self.user, month="2024-05", category=category, limit_amount=Decimal(limit))
        for category, spent in (("A", "10.00"), ("B", "80.00"), ("C", "100.00"), ("D", "500.00")):
            self.post_movement(self.account, "Gasto", category, spent, "GASTO", "2024-05-02T12:00:00Z")

        data = self.budgets()

        self.assertEqual([item["estado"] for item in data["categorias"]], ["Normal", "Precaución", "Crítico", "Excedido"])
        self.assertEqual(data["categorias"][3]["badge"], "Excedido")
        self.assertEqual(data["filtros"], ["Todos 4", "Normal 1", "Precaución 1", "Crítico 1", "Excedido 1"])
        self.assertEqual(data["summary"]["total_consumido"], Decimal("690.00"))
        self.assertEqual(data["summary"]["dias_restantes"], 0)
        self.assertEqual(data["categorias"][0]["proyeccion"], Decimal("10.00"))
        self.assertEqual(data["categorias"][0]["detalle"], "Mes cerrado con S/ 90.00 sin usar.")

    def test_current_month_projection_and_remaining_days(self):
        today = local_today()
        FinanceBudget.objects.create(owner=self.user, category="Ocio", limit_amount=Decimal("1000.00"))
        self.account.withdraw(Decimal("10.00"), name="Cine", category="Ocio")

        data = self.budgets(current_period())

        expected = (Decimal("10.00") / today.day * days_in_period(current_period())).quantize(Decimal("0.01"))
        self.assertEqual(data["categorias"][0]["proyeccion"], expected)
        self.assertEqual(data["summary"]["dias_restantes"], days_remaining(current_period(), today))

    def test_list_uses_a_constant_number_of_queries(self):
        for index in range(6):
            FinanceBudget.objects.create(owner=self.user, month="2024-05", category=f"Cat {index}", limit_amount=Decimal("10.00"))

        with CaptureQueriesContext(connection) as queries:
            self.budgets()

        self.assertLessEqual(len(queries), 3)


class BudgetEditingTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.food = FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Alimentación", limit_amount=Decimal("300.00"))
        self.fun = FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Ocio", limit_amount=Decimal("100.00"))

    def test_duplicates_are_rejected_ignoring_case_and_spaces(self):
        response = self.client.post(
            f"{API}/presupuestos/", {"month": "2024-05", "category": "  ALIMENTACIÓN ", "limit_amount": "10.00"}, format="json"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["category"], ["Ya existe un presupuesto para esta categoría en este mes."])

    def test_patch_updates_category_description_and_limit(self):
        response = self.client.patch(
            f"{API}/presupuestos/{self.fun.id}/", {"category": "salidas", "description": "Cine", "limit_amount": "150.00"}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.data["data"]["nombre"], response.data["data"]["presupuesto"]), ("Salidas", Decimal("150.00")))
        self.fun.refresh_from_db()
        self.assertEqual(self.fun.description, "Cine")

    def test_patch_rejects_taken_category(self):
        response = self.client.patch(f"{API}/presupuestos/{self.fun.id}/", {"category": "alimentación"}, format="json")

        self.assertEqual(response.status_code, 400)

    def test_legacy_adjust_and_delete_routes(self):
        adjusted = self.client.patch(f"{API}/presupuestos/{self.food.id}/ajustar/", {"limit_amount": "320.00"}, format="json")

        self.assertEqual(adjusted.status_code, 200)
        self.assertEqual(adjusted.data["data"]["presupuesto"], Decimal("320.00"))
        self.assertEqual(self.client.delete(f"{API}/presupuestos/{self.food.id}/ajustar/").status_code, 204)
        self.assertEqual(self.client.delete(f"{API}/presupuestos/{self.fun.id}/").status_code, 204)
        self.assertFalse(FinanceBudget.objects.exists())

    def test_budget_of_another_user_is_not_found(self):
        foreign = FinanceBudget.objects.create(owner=self.other_user, month="2024-05", category="X", limit_amount=Decimal("1.00"))

        response = self.client.patch(f"{API}/presupuestos/{foreign.id}/", {"limit_amount": "5.00"}, format="json")

        self.assertEqual((response.status_code, response.data["detail"]), (404, "Presupuesto no encontrado."))


class RebalanceTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.account = self.open_account(balance="1000.00")
        self.food = FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Alimentación", limit_amount=Decimal("300.00"))
        self.fun = FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Ocio", limit_amount=Decimal("100.00"))
        self.post_movement(self.account, "Mercado", "Alimentación", "250.00", "GASTO", "2024-05-02T12:00:00Z")

    def rebalance(self, **values):
        payload = {"month": "2024-05", "source_category": "alimentación", "target_category": "ocio", "amount": "50.00", **values}
        return self.client.post(f"{API}/presupuestos/rebalancear/", payload, format="json")

    def test_moves_available_limit(self):
        response = self.rebalance()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["transfer"]["destino"], "Ocio")
        self.food.refresh_from_db()
        self.fun.refresh_from_db()
        self.assertEqual((self.food.limit_amount, self.fun.limit_amount), (Decimal("250.00"), Decimal("150.00")))

    def test_cannot_move_what_was_already_spent(self):
        response = self.rebalance(amount="60.00")

        self.assertEqual(response.status_code, 400)
        self.assertIn("S/ 50.00 libres", response.data["detail"])

    def test_missing_budget_gives_spanish_400(self):
        response = self.rebalance(target_category="Viajes")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["target_category"], ["No existe un presupuesto de Viajes en Mayo 2024."])


class CopyBudgetsTests(FinanceAPITestCase):
    def test_copies_previous_month_skipping_existing(self):
        previous = shift_month(current_period(), -1)
        for category, limit in (("Alimentación", "900.00"), ("Ocio", "100.00")):
            FinanceBudget.objects.create(owner=self.user, month=previous, category=category, limit_amount=Decimal(limit), description="d")
        FinanceBudget.objects.create(owner=self.user, category="ocio", limit_amount=Decimal("80.00"))

        response = self.client.post(f"{API}/presupuestos/copiar/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.data["copiados"], response.data["omitidos"]), (1, 1))
        self.assertEqual([item["nombre"] for item in response.data["data"]], ["Alimentación"])
        current = FinanceBudget.objects.filter(owner=self.user, month=current_period())
        self.assertEqual(sorted(current.values_list("category", "limit_amount")), [("Alimentación", Decimal("900.00")), ("ocio", Decimal("80.00"))])

    def test_explicit_months_and_validation(self):
        FinanceBudget.objects.create(owner=self.user, month="2024-01", category="Ocio", limit_amount=Decimal("10.00"))

        copied = self.client.post(f"{API}/presupuestos/copiar/", {"month": "2024-05", "source_month": "2024-01"}, format="json")
        same = self.client.post(f"{API}/presupuestos/copiar/", {"month": "2024-05", "source_month": "2024-05"}, format="json")

        self.assertEqual(copied.data["copiados"], 1)
        self.assertEqual(copied.data["message"], "Se copió 1 presupuesto de Enero 2024.")
        self.assertEqual(same.status_code, 400)
