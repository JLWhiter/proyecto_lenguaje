"""Pruebas de los métodos de dominio de ``FinanceAccount`` y ``FinanceTransaction``."""

from decimal import Decimal

from django.db import IntegrityError

from .exceptions import OperacionNoPermitidaError, SaldoInsuficienteError
from .models import FinanceAccount, FinanceBudget, FinanceTransaction
from .testing import FinanceAPITestCase, local_datetime

Kind = FinanceTransaction.Kind


class AccountDomainTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.account = self.open_account(balance="100.00")

    def test_withdraw_uses_the_database_balance_not_a_stale_copy(self):
        stale = FinanceAccount.objects.get(pk=self.account.pk)
        self.account.withdraw(Decimal("80.00"), name="Compra", category="Otros")

        with self.assertRaises(SaldoInsuficienteError):
            stale.withdraw(Decimal("80.00"), name="Otra compra", category="Otros")

        self.assert_balance(self.account, "20.00")
        self.assertEqual(self.account.transactions.filter(kind=Kind.REGULAR).count(), 1)

    def test_withdrawing_the_exact_balance_after_decimal_operations(self):
        for amount in ("0.10", "0.20", "33.33", "0.07"):
            self.account.withdraw(Decimal(amount), name="Gasto", category="Otros")

        self.account.withdraw(self.account.balance, name="Resto", category="Otros")

        self.assert_balance(self.account, "0.00")
        self.assert_consistent(self.account)

    def test_operations_keep_balance_equal_to_movements(self):
        other = self.open_account(name="Otra")
        self.account.deposit(Decimal("50.25"))
        self.account.transfer_to(other, Decimal("70.10"))
        other.withdraw(Decimal("20.05"), name="Taxi", category="Transporte")
        self.account.adjust_balance(Decimal("75.00"))

        for account in (self.account, other):
            self.assert_consistent(account)
        self.assert_balance(other, "50.05")

    def test_transfer_to_the_same_account_is_rejected(self):
        with self.assertRaisesMessage(OperacionNoPermitidaError, "Selecciona dos cuentas distintas."):
            self.account.transfer_to(self.account, Decimal("1.00"))

    def test_transfer_to_another_users_account_is_rejected(self):
        foreign = self.open_account(name="Ajena", owner=self.other_user)

        with self.assertRaises(OperacionNoPermitidaError):
            self.account.transfer_to(foreign, Decimal("1.00"))

    def test_failed_transfer_leaves_no_trace(self):
        other = self.open_account(name="Otra")

        with self.assertRaises(SaldoInsuficienteError):
            self.account.transfer_to(other, Decimal("100.01"))

        self.assertFalse(FinanceTransaction.objects.filter(kind=Kind.TRANSFER).exists())
        self.assert_balance(self.account, "100.00")

    def test_archived_account_rejects_movements(self):
        self.account.adjust_balance(Decimal("0.00"))
        self.assertTrue(self.account.close())

        with self.assertRaises(OperacionNoPermitidaError):
            self.account.deposit(Decimal("5.00"))

    def test_non_positive_amounts_are_rejected(self):
        with self.assertRaises(OperacionNoPermitidaError):
            self.account.deposit(Decimal("0.00"))


class ConstraintTests(FinanceAPITestCase):
    def test_amount_must_be_positive_in_the_database(self):
        with self.assertRaises(IntegrityError):
            FinanceTransaction.objects.create(owner=self.user, name="x", category="x", transaction_type="GASTO", amount=Decimal("0.00"))

    def test_account_names_are_unique_ignoring_ascii_case(self):
        self.open_account(name="Ahorros")

        with self.assertRaises(IntegrityError):
            FinanceAccount.objects.create(owner=self.user, name="AHORROS", account_type="Ahorros")

    def test_budget_categories_are_unique_per_month_ignoring_ascii_case(self):
        FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Ocio", limit_amount=Decimal("1.00"))
        FinanceBudget.objects.create(owner=self.user, month="2024-06", category="ocio", limit_amount=Decimal("1.00"))

        with self.assertRaises(IntegrityError):
            FinanceBudget.objects.create(owner=self.user, month="2024-05", category="OCIO", limit_amount=Decimal("1.00"))


class TransactionDomainTests(FinanceAPITestCase):
    def test_legacy_transfer_without_counterpart_cannot_be_cancelled(self):
        account = self.open_account(balance="10.00")
        leg = FinanceTransaction.objects.create(
            owner=self.user, account=account, name="Antigua", category="Transferencia",
            transaction_type="GASTO", kind=Kind.TRANSFER, amount=Decimal("5.00"), occurred_at=local_datetime(2024, 5, 1),
        )

        with self.assertRaises(OperacionNoPermitidaError):
            leg.cancel()
