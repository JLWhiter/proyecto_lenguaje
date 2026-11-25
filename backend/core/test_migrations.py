"""Prueba la migración de datos 0005 con filas creadas como en la versión anterior."""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone

BEFORE = [("core", "0003_financeprofile")]
AFTER = [("core", "0006_computed_budgets_and_constraints")]


class LegacyDataMigrationTests(TransactionTestCase):
    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(target)
        return executor.loader.project_state(target).apps

    def tearDown(self):
        self.migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())

    def test_legacy_rows_are_classified_linked_and_reconciled(self):
        user = get_user_model().objects.create_user(email="legacy@example.com", full_name="Legacy", password="Finova#2026")
        apps = self.migrate(BEFORE)
        Account = apps.get_model("core", "FinanceAccount")
        Transaction = apps.get_model("core", "FinanceTransaction")
        Budget = apps.get_model("core", "FinanceBudget")
        user = apps.get_model(*get_user_model()._meta.label.split(".")).objects.get(pk=user.pk)
        now = timezone.now()
        main = Account.objects.create(owner=user, name="Ahorros", account_type="A", balance=Decimal("500.00"))
        twin = Account.objects.create(owner=user, name="AHORROS", account_type="A", balance=Decimal("0.00"))
        common = {"owner": user, "status": "Completado", "occurred_at": now}
        Transaction.objects.create(account=main, name="Sueldo", category="  Salario  mensual ", transaction_type="INGRESO", amount=Decimal("300.00"), **common)
        Transaction.objects.create(account=main, name="Mover", category="Transferencia", transaction_type="GASTO", amount=Decimal("50.00"), count_in_summary=False, **common)
        Transaction.objects.create(account=twin, name="Mover", category="Transferencia", transaction_type="INGRESO", amount=Decimal("50.00"), count_in_summary=False, owner=user, status="Acreditado", occurred_at=now + timedelta(microseconds=300))
        Transaction.objects.create(account=twin, name="Depósito", category="Depósito", transaction_type="INGRESO", amount=Decimal("20.00"), **common)
        Budget.objects.create(owner=user, month="2024-05", category="Ocio", limit_amount=Decimal("10.00"))
        Budget.objects.create(owner=user, month="2024-05", category="OCIO", limit_amount=Decimal("20.00"), spent_amount=Decimal("99.00"))

        apps = self.migrate(AFTER)
        Transaction = apps.get_model("core", "FinanceTransaction")
        Account = apps.get_model("core", "FinanceAccount")
        Budget = apps.get_model("core", "FinanceBudget")

        kinds = dict(Transaction.objects.exclude(kind__in=["OPENING", "ADJUSTMENT"]).values_list("name", "kind").distinct())
        self.assertEqual(kinds, {"Sueldo": "REGULAR", "Mover": "TRANSFER", "Depósito": "DEPOSIT"})
        groups = set(Transaction.objects.filter(kind="TRANSFER").values_list("transfer_group", flat=True))
        self.assertEqual(len(groups), 1)
        self.assertIsNotNone(groups.pop())
        self.assertEqual(Transaction.objects.get(name="Sueldo").category, "Salario mensual")
        self.assertEqual(sorted(Account.objects.values_list("name", flat=True)), ["AHORROS (2)", "Ahorros"])
        self.assertEqual(sorted(Budget.objects.values_list("category", flat=True)), ["OCIO (2)", "Ocio"])

        opening = Transaction.objects.get(account__name="Ahorros", kind="OPENING")
        self.assertEqual((opening.transaction_type, opening.amount), ("INGRESO", Decimal("250.00")))
        adjustment = Transaction.objects.get(account__name="AHORROS (2)", kind="ADJUSTMENT")
        self.assertEqual((adjustment.transaction_type, adjustment.amount), ("GASTO", Decimal("70.00")))
        for account in Account.objects.all():
            movements = Transaction.objects.filter(account=account)
            total = sum((m.amount if m.transaction_type == "INGRESO" else -m.amount for m in movements), Decimal("0"))
            self.assertEqual(account.balance, total, account.name)
