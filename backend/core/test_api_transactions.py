import csv
import io
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APIClient

from .models import FinanceTransaction, MovementKind
from .periods import current_period, local_today
from .testing import API, FinanceAPITestCase, local_datetime



class CreateTransactionTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.account = self.open_account(balance="500.00")

    def create(self, **overrides):
        payload = {"name": "Mercado", "category": "Alimentación", "amount": "45.50", "type": "GASTO", "account_id": self.account.id, **overrides}
        return self.client.post(f"{API}/transacciones/", payload, format="json")

    def test_expense_uses_real_id_and_local_spanish_dates(self):
        response = self.create(occurred_at="2024-05-24T03:30:00Z")

        self.assertEqual(response.status_code, 201)
        item = response.data["data"]
        movement = FinanceTransaction.objects.get(name="Mercado")
        self.assertEqual(item["id"], movement.id)
        self.assertEqual((item["fecha"], item["hora"]), ("23 May", "22:30"))
        self.assertEqual(item["occurred_at"], "2024-05-23T22:30:00-05:00")
        self.assertEqual((item["cuenta_id"], item["kind"], item["monto"]), (self.account.id, "REGULAR", Decimal("-45.50")))
        self.assert_balance(self.account, "454.50")

    def test_insufficient_funds_is_rejected_atomically(self):
        response = self.create(amount="900.00")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "La cuenta Principal no tiene saldo suficiente.")
        self.assertFalse(FinanceTransaction.objects.filter(kind=MovementKind.REGULAR).exists())
        self.assert_balance(self.account, "500.00")

    def test_future_dates_are_rejected(self):
        tomorrow = local_today() + timedelta(days=1)

        for value in ("2099-01-01T00:00:00Z", tomorrow.isoformat()):
            response = self.create(occurred_at=value)
            self.assertEqual(response.status_code, 400, value)
            self.assertEqual(response.data["occurred_at"], ["La fecha no puede ser posterior a hoy."])

    def test_today_and_date_only_values_are_accepted(self):
        self.assertEqual(self.create(occurred_at=local_today().isoformat()).status_code, 201)
        self.assertEqual(self.create().status_code, 201)

    def test_category_is_normalized(self):
        response = self.create(category="  comida   rápida ")

        self.assertEqual(response.data["data"]["categoria"], "Comida rápida")

    def test_accounts_of_other_users_cannot_be_used(self):
        foreign = self.open_account(name="Ajena", balance="100.00", owner=self.other_user)

        response = self.create(account_id=foreign.id)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["account_id"], ["La cuenta no existe o está archivada."])


class TransactionListTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.main = self.open_account(balance="1000.00", opened_at=local_datetime(2024, 5, 1, 8))
        self.wallet = self.open_account(name="Billetera", balance="50.00", opened_at=local_datetime(2024, 5, 1, 8))
        self.post_movement(self.main, "Supermercado", "Alimentación", "50.00", "GASTO", "2024-05-02T12:00:00Z")
        self.post_movement(self.wallet, "Menú", "ALIMENTACIÓN", "15.00", "GASTO", "2024-05-03T12:00:00Z")
        self.post_movement(self.main, "Taxi", "Transporte", "20.00", "GASTO", "2024-05-04T12:00:00Z")
        self.post_movement(self.main, "Bono", "Salario", "200.00", "INGRESO", "2024-05-05T12:00:00Z")
        self.main.transfer_to(self.wallet, Decimal("30.00"), occurred_at=local_datetime(2024, 5, 6))
        self.main.deposit(Decimal("40.00"), occurred_at=local_datetime(2024, 5, 7))

    def list(self, **filters):
        response = self.client.get(f"{API}/transacciones/", {"mes": "2024-05", **filters})
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def names(self, data):
        return sorted(item["nombre"] for group in data["grupos"] for item in group["items"])

    def test_filters_by_category_type_and_search(self):
        self.assertEqual(self.names(self.list(categoria="alimentación")), ["Menú", "Supermercado"])
        self.assertEqual(self.names(self.list(tipo="INGRESO", search="bono")), ["Bono"])
        self.assertEqual(self.names(self.list(search="taxi")), ["Taxi"])
        self.assertEqual(self.names(self.list(categoria="alimentación", search="menú")), ["Menú"])

    def test_totals_respect_filters_and_skip_transfers_and_openings(self):
        everything = self.list()
        food = self.list(categoria="alimentación")
        wallet = self.list(cuenta_id=self.wallet.id)

        self.assertEqual((everything["total_ingresos"], everything["total_gastos"]), (Decimal("240.00"), Decimal("85.00")))
        self.assertEqual(everything["neto"], Decimal("155.00"))
        self.assertEqual((food["total_ingresos"], food["total_gastos"]), (Decimal("0.00"), Decimal("65.00")))
        self.assertEqual((wallet["total_ingresos"], wallet["total_gastos"]), (Decimal("0.00"), Decimal("15.00")))
        self.assertEqual(self.names(wallet), ["Menú", "Saldo inicial", "Transferencia desde Principal"])

    def test_groups_by_local_day_with_daily_totals(self):
        data = self.list()

        titles = [group["titulo"] for group in data["grupos"]]
        self.assertEqual(titles, ["7 MAY 2024", "6 MAY 2024", "5 MAY 2024", "4 MAY 2024", "3 MAY 2024", "2 MAY 2024", "1 MAY 2024"])
        self.assertEqual(
            [group["total"] for group in data["grupos"]],
            [Decimal("40.00"), Decimal("0.00"), Decimal("200.00"), Decimal("-20.00"), Decimal("-15.00"), Decimal("-50.00"), Decimal("0.00")],
        )

    def test_day_totals_only_count_what_the_month_summary_counts(self):
        self.main.adjust_balance(Decimal("2000.00"), occurred_at=local_datetime(2024, 5, 4, 18))

        data = self.list()
        wallet = self.list(cuenta_id=self.wallet.id)

        groups = {group["fecha"]: group for group in data["grupos"]}
        self.assertEqual(groups["2024-05-01"]["total"], Decimal("0.00"))  # saldos iniciales
        self.assertEqual([item["nombre"] for item in groups["2024-05-01"]["items"]], ["Saldo inicial", "Saldo inicial"])
        self.assertEqual(groups["2024-05-04"]["total"], Decimal("-20.00"))  # el ajuste se lista pero no suma
        self.assertIn("Ajuste de saldo", [item["nombre"] for item in groups["2024-05-04"]["items"]])
        wallet_days = {group["fecha"]: group["total"] for group in wallet["grupos"]}
        self.assertEqual(wallet_days["2024-05-06"], Decimal("0.00"))  # transferencia recibida
        self.assertEqual(sum(group["total"] for group in data["grupos"]), data["neto"])
        self.assertEqual(sum(wallet_days.values()), wallet["neto"])

    def test_pagination(self):
        first = self.list(page_size=3)
        last = self.list(page_size=3, page=3)

        self.assertEqual((first["count"], first["page"], first["pages"]), (9, 1, 3))
        self.assertEqual(sum(len(group["items"]) for group in first["grupos"]), 3)
        self.assertEqual(sum(len(group["items"]) for group in last["grupos"]), 3)
        self.assertEqual(first["total_gastos"], Decimal("85.00"))
        self.assertEqual(self.client.get(f"{API}/transacciones/", {"page_size": 0}).status_code, 400)

    def test_today_and_yesterday_titles(self):
        self.main.withdraw(Decimal("1.00"), name="Chicle", category="Alimentación")
        self.main.withdraw(Decimal("1.00"), name="Pan", category="Alimentación", occurred_at=timezone.now() - timedelta(days=1))

        titles = [group["titulo"] for group in self.client.get(f"{API}/transacciones/").data["grupos"]]

        self.assertEqual(titles[0], "HOY")
        if current_period() == (local_today() - timedelta(days=1)).strftime("%Y-%m"):
            self.assertEqual(titles[1], "AYER")

    def test_kind_and_flags_are_exposed(self):
        items = {item["nombre"]: item for group in self.list()["grupos"] for item in group["items"]}

        self.assertEqual(items["Saldo inicial"]["kind"], "OPENING")
        self.assertFalse(items["Saldo inicial"]["eliminable"])
        self.assertEqual(items["Transferencia a Billetera"]["kind_label"], "Transferencia")
        self.assertTrue(items["Bono"]["editable"])
        self.assertFalse(items["Depósito"]["editable"])


class EditTransactionTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.main = self.open_account(balance="100.00")
        self.wallet = self.open_account(name="Billetera", balance="10.00")
        self.expense = self.post_movement(self.main, "Mercado", "Alimentación", "40.00", "GASTO", "2024-05-02T12:00:00Z")

    def patch(self, movement, **values):
        return self.client.patch(f"{API}/transacciones/{movement.id}/", values, format="json")

    def test_amount_change_applies_only_the_difference(self):
        response = self.patch(self.expense, amount="90.00", name="Mercado central", category=" mercado ")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["nombre"], "Mercado central")
        self.assertEqual(response.data["data"]["categoria"], "Mercado")
        self.assert_balance(self.main, "10.00")
        self.assert_consistent(self.main)

    def test_moving_to_another_account_reapplies_balances(self):
        response = self.patch(self.expense, account_id=self.wallet.id, amount="5.00", occurred_at="2024-06-01T12:00:00Z")

        self.assertEqual(response.status_code, 200)
        self.assert_balance(self.main, "100.00")
        self.assert_balance(self.wallet, "5.00")
        self.assertEqual(response.data["data"]["fecha"], "1 Jun")

    def test_failed_edit_changes_nothing(self):
        response = self.patch(self.expense, account_id=self.wallet.id)

        self.assertEqual(response.status_code, 400)
        self.assert_balance(self.main, "60.00")
        self.assert_balance(self.wallet, "10.00")
        self.expense.refresh_from_db()
        self.assertEqual(self.expense.account_id, self.main.id)

    def test_only_regular_movements_can_be_edited(self):
        deposit = self.main.deposit(Decimal("5.00"))

        response = self.patch(deposit, amount="6.00")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "Solo se pueden editar ingresos y gastos regulares.")

    def test_future_date_is_rejected(self):
        self.assertEqual(self.patch(self.expense, occurred_at="2099-01-01").status_code, 400)

    def test_movements_of_other_users_are_not_found(self):
        foreign = self.open_account(name="Ajena", balance="50.00", owner=self.other_user).transactions.get()

        response = self.patch(foreign, amount="1.00")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["detail"], "Movimiento no encontrado.")


class DeleteTransactionTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.main = self.open_account(balance="100.00")
        self.wallet = self.open_account(name="Billetera")

    def delete(self, movement):
        return self.client.delete(f"{API}/transacciones/{movement.id}/")

    def test_deleting_an_expense_restores_the_balance(self):
        expense = self.post_movement(self.main, "Taxi", "Transporte", "30.00", "GASTO", "2024-05-02T12:00:00Z")

        self.assertEqual(self.delete(expense).status_code, 204)
        self.assert_balance(self.main, "100.00")

    def test_spent_income_cannot_be_deleted(self):
        income = self.post_movement(self.main, "Bono", "Salario", "50.00", "INGRESO", "2024-05-02T12:00:00Z")
        self.post_movement(self.main, "Compra", "Otros", "120.00", "GASTO", "2024-05-03T12:00:00Z")

        response = self.delete(income)

        self.assertEqual(response.status_code, 400)
        self.assertIn("ya fue utilizado", response.data["detail"])
        self.assertTrue(FinanceTransaction.objects.filter(pk=income.pk).exists())

    def test_deleting_one_transfer_leg_cancels_the_whole_transfer(self):
        debit, credit = self.main.transfer_to(self.wallet, Decimal("40.00"))

        self.assertEqual(self.delete(credit).status_code, 204)

        self.assertFalse(FinanceTransaction.objects.filter(pk__in=[debit.pk, credit.pk]).exists())
        self.assert_balance(self.main, "100.00")
        self.assert_balance(self.wallet, "0.00")

    def test_opening_and_adjustment_cannot_be_deleted(self):
        opening = self.main.transactions.get(kind=MovementKind.OPENING)
        adjustment = self.main.adjust_balance(Decimal("80.00"))

        for movement in (opening, adjustment):
            response = self.delete(movement)
            self.assertEqual(response.status_code, 400)
            self.assertIn("no se pueden eliminar", response.data["detail"])
        self.assert_balance(self.main, "80.00")


class TransferAndDepositTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.source = self.open_account(name="Origen", balance="200.00")
        self.destination = self.open_account(name="Destino", balance="10.00")

    def transfer(self, **overrides):
        payload = {"source_account_id": self.source.id, "destination_account_id": self.destination.id, "amount": "60.00", **overrides}
        return self.client.post(f"{API}/transacciones/transferir/", payload, format="json")

    def test_transfer_creates_two_linked_legs(self):
        response = self.transfer(occurred_at="2024-05-10")

        self.assertEqual(response.status_code, 201)
        self.assert_balance(self.source, "140.00")
        self.assert_balance(self.destination, "70.00")
        debit, credit = response.data["movimientos"]
        self.assertEqual((debit["monto"], credit["monto"]), (Decimal("-60.00"), Decimal("60.00")))
        legs = FinanceTransaction.objects.filter(kind=MovementKind.TRANSFER)
        self.assertEqual(legs.count(), 2)
        self.assertEqual(len({leg.transfer_group for leg in legs}), 1)
        self.assertEqual(len({leg.occurred_at for leg in legs}), 1)

    def test_transfer_validations(self):
        same = self.transfer(destination_account_id=self.source.id)
        too_much = self.transfer(amount="500.00")

        self.assertEqual((same.status_code, same.data["detail"]), (400, "Selecciona dos cuentas distintas."))
        self.assertEqual((too_much.status_code, too_much.data["detail"]), (400, "La cuenta Origen no tiene saldo suficiente."))
        self.assertFalse(FinanceTransaction.objects.filter(kind=MovementKind.TRANSFER).exists())

    def test_deposit_counts_as_income(self):
        response = self.client.post(
            f"{API}/transacciones/depositar/",
            {"account_id": self.destination.id, "amount": "30.00", "description": "Efectivo"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["kind"], "DEPOSIT")
        self.assert_balance(self.destination, "40.00")
        self.assertEqual(self.client.get(f"{API}/transacciones/").data["total_ingresos"], Decimal("30.00"))


class ExportTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.account = self.open_account(balance="500.00")
        self.post_movement(self.account, "=HYPERLINK(\"http://x\")", "Alimentación", "45.50", "GASTO", "2024-05-24T03:30:00Z")
        self.post_movement(self.account, "Taxi", "Transporte", "10.00", "GASTO", "2024-05-25T12:00:00Z")

    def export(self, client=None, **params):
        return (client or self.client).get(f"{API}/transacciones/exportar/", {"mes": "2024-05", **params}, HTTP_ACCEPT="text/csv")

    def rows(self, response):
        return list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))

    def test_csv_is_served_for_accept_text_csv(self):
        response = self.export()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn('filename="finova-transacciones-2024-05.csv"', response["Content-Disposition"])
        header, *rows = self.rows(response)
        self.assertEqual(header[0], "Fecha")
        self.assertEqual(rows[1], ["2024-05-23 22:30", "'=HYPERLINK(\"http://x\")", "Alimentación", "GASTO", "Movimiento", "Principal", "-45.50", "Completado"])

    def test_csv_respects_filters(self):
        rows = self.rows(self.export(categoria="transporte"))

        self.assertEqual([row[1] for row in rows[1:]], ["Taxi"])

    def test_csv_requires_authentication(self):
        response = self.export(client=APIClient())

        self.assertEqual(response.status_code, 401)
        self.assertIn("text/csv", response["Content-Type"])
