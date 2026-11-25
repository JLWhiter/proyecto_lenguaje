from decimal import Decimal

from .models import FinanceAccount, FinanceTransaction
from .testing import API, FinanceAPITestCase

Kind = FinanceTransaction.Kind


class AccountCreationTests(FinanceAPITestCase):
    def create(self, **overrides):
        payload = {"name": "Primera cuenta", "account_type": "Ahorros", "balance": "125.00", **overrides}
        return self.client.post(f"{API}/cuentas/", payload, format="json")

    def test_opening_balance_is_recorded_as_a_movement(self):
        response = self.create()

        self.assertEqual(response.status_code, 201)
        account = FinanceAccount.objects.get(pk=response.data["data"]["id"])
        self.assertEqual(account.balance, Decimal("125.00"))
        opening = account.transactions.get()
        self.assertEqual((opening.kind, opening.transaction_type, opening.amount), (Kind.OPENING, "INGRESO", Decimal("125.00")))
        dashboard = self.client.get(f"{API}/dashboard/resumen/").data
        self.assertEqual(dashboard["ingresos_mensuales"], Decimal("0.00"))
        self.assertEqual(dashboard["evolucion_saldo"][-1]["value"], 125.0)

    def test_zero_balance_creates_no_movement(self):
        response = self.create(balance="0.00")

        self.assertFalse(FinanceTransaction.objects.filter(account_id=response.data["data"]["id"]).exists())

    def test_names_are_unique_ignoring_case(self):
        self.create(name="Ahorros BCP")

        response = self.create(name="ahorros bcp")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["name"], ["Ya existe una cuenta con ese nombre."])


class AccountBalanceTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.account = self.open_account(balance="100.00")

    def update_balance(self, balance):
        return self.client.patch(f"{API}/cuentas/{self.account.id}/saldo/", {"balance": balance}, format="json")

    def test_update_balance_records_an_adjustment(self):
        up = self.update_balance("130.00")
        down = self.update_balance("90.00")

        self.assertEqual((up.status_code, up.data["data"]["saldo"]), (200, Decimal("130.00")))
        self.assertEqual(up.data["movimiento"]["monto"], Decimal("30.00"))
        self.assertEqual(down.data["movimiento"]["monto"], Decimal("-40.00"))
        adjustments = self.account.transactions.filter(kind=Kind.ADJUSTMENT)
        self.assertEqual(adjustments.count(), 2)
        self.assert_consistent(self.account)

    def test_same_balance_records_nothing(self):
        response = self.update_balance("100.00")

        self.assertIsNone(response.data["movimiento"])
        self.assertFalse(self.account.transactions.filter(kind=Kind.ADJUSTMENT).exists())

    def test_adjustments_are_not_income_or_expense(self):
        self.update_balance("1000.00")

        transactions = self.client.get(f"{API}/transacciones/").data

        self.assertEqual((transactions["total_ingresos"], transactions["total_gastos"]), (Decimal("0.00"), Decimal("0.00")))


class AccountEditAndDeleteTests(FinanceAPITestCase):
    def test_patch_updates_name_type_and_description(self):
        account = self.open_account()

        response = self.client.patch(
            f"{API}/cuentas/{account.id}/", {"name": "BCP Sueldo", "account_type": "Corriente", "description": "**** 1234"}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        account.refresh_from_db()
        self.assertEqual((account.name, account.account_type, account.description), ("BCP Sueldo", "Corriente", "**** 1234"))

    def test_patch_keeps_own_name_but_rejects_taken_names(self):
        account = self.open_account(name="Principal")
        self.open_account(name="Billetera")

        same = self.client.patch(f"{API}/cuentas/{account.id}/", {"name": "PRINCIPAL"}, format="json")
        taken = self.client.patch(f"{API}/cuentas/{account.id}/", {"name": "billetera"}, format="json")

        self.assertEqual(same.status_code, 200)
        self.assertEqual(taken.status_code, 400)

    def test_account_without_movements_is_deleted(self):
        account = self.open_account()

        response = self.client.delete(f"{API}/cuentas/{account.id}/")

        self.assertEqual((response.status_code, response.data["accion"]), (200, "eliminada"))
        self.assertFalse(FinanceAccount.objects.filter(pk=account.pk).exists())

    def test_account_with_balance_cannot_be_deleted(self):
        account = self.open_account(balance="10.00")

        response = self.client.delete(f"{API}/cuentas/{account.id}/")

        self.assertEqual(response.status_code, 400)
        self.assertIn("saldo S/ 0.00", response.data["detail"])

    def test_account_with_history_is_archived_and_hidden(self):
        account = self.open_account(balance="10.00")
        account.withdraw(Decimal("10.00"), name="Retiro", category="Otros")

        response = self.client.delete(f"{API}/cuentas/{account.id}/")

        self.assertEqual((response.status_code, response.data["accion"]), (200, "archivada"))
        account.refresh_from_db()
        self.assertTrue(account.is_archived)
        self.assertEqual(self.client.get(f"{API}/cuentas/").data["accounts"], [])
        self.assertEqual(self.client.get(f"{API}/transacciones/").data["count"], 1)
        rejected = self.client.post(
            f"{API}/transacciones/depositar/", {"account_id": account.id, "amount": "5.00"}, format="json"
        )
        self.assertEqual(rejected.data["account_id"], ["La cuenta no existe o está archivada."])
        self.assertEqual(self.client.patch(f"{API}/cuentas/{account.id}/", {"name": "X"}, format="json").status_code, 404)


class AccountNameAndCurrencyTests(FinanceAPITestCase):
    def test_archived_account_name_can_be_reused(self):
        account = self.open_account(name="Yape", balance="10.00")
        account.withdraw(Decimal("10.00"), name="Retiro", category="Otros")
        account.close()

        response = self.client.post(f"{API}/cuentas/", {"name": "yape", "account_type": "Billetera digital"}, format="json")

        self.assertEqual(response.status_code, 201, response.data)

    def test_delete_message_uses_the_user_currency(self):
        self.user.currency = "USD"
        self.user.save(update_fields=["currency"])
        account = self.open_account(balance="10.00")

        response = self.client.delete(f"{API}/cuentas/{account.id}/")

        self.assertIn("saldo $ 0.00", response.data["detail"])
