"""Prueba las migraciones de datos (0005 y 0008) con filas creadas como en la versión anterior."""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone

BEFORE = [("core", "0003_financeprofile")]
AFTER = [("core", "0006_computed_budgets_and_constraints")]


class MigrationTestCase(TransactionTestCase):
    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(target)
        return executor.loader.project_state(target).apps

    def tearDown(self):
        self.migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())


class LegacyDataMigrationTests(MigrationTestCase):
    def test_legacy_rows_are_classified_linked_and_reconciled(self):
        user = get_user_model().objects.create_user(email="legacy@example.com", full_name="Legacy", password="Finova#2026")
        apps = self.migrate(BEFORE)
        account_model = apps.get_model("core", "FinanceAccount")
        transaction_model = apps.get_model("core", "FinanceTransaction")
        budget_model = apps.get_model("core", "FinanceBudget")
        user = apps.get_model(*get_user_model()._meta.label.split(".")).objects.get(pk=user.pk)
        now = timezone.now()
        main = account_model.objects.create(owner=user, name="Ahorros", account_type="A", balance=Decimal("500.00"))
        twin = account_model.objects.create(owner=user, name="AHORROS", account_type="A", balance=Decimal("0.00"))
        common = {"owner": user, "status": "Completado", "occurred_at": now}
        transaction_model.objects.create(account=main, name="Sueldo", category="  Salario  mensual ", transaction_type="INGRESO", amount=Decimal("300.00"), **common)
        transaction_model.objects.create(account=main, name="Mover", category="Transferencia", transaction_type="GASTO", amount=Decimal("50.00"), count_in_summary=False, **common)
        transaction_model.objects.create(account=twin, name="Mover", category="Transferencia", transaction_type="INGRESO", amount=Decimal("50.00"), count_in_summary=False, owner=user, status="Acreditado", occurred_at=now + timedelta(microseconds=300))
        transaction_model.objects.create(account=twin, name="Depósito", category="Depósito", transaction_type="INGRESO", amount=Decimal("20.00"), **common)
        budget_model.objects.create(owner=user, month="2024-05", category="Ocio", limit_amount=Decimal("10.00"))
        budget_model.objects.create(owner=user, month="2024-05", category="OCIO", limit_amount=Decimal("20.00"), spent_amount=Decimal("99.00"))

        apps = self.migrate(AFTER)
        transaction_model = apps.get_model("core", "FinanceTransaction")
        account_model = apps.get_model("core", "FinanceAccount")
        budget_model = apps.get_model("core", "FinanceBudget")

        kinds = dict(transaction_model.objects.exclude(kind__in=["OPENING", "ADJUSTMENT"]).values_list("name", "kind").distinct())
        self.assertEqual(kinds, {"Sueldo": "REGULAR", "Mover": "TRANSFER", "Depósito": "DEPOSIT"})
        groups = set(transaction_model.objects.filter(kind="TRANSFER").values_list("transfer_group", flat=True))
        self.assertEqual(len(groups), 1)
        self.assertIsNotNone(groups.pop())
        self.assertEqual(transaction_model.objects.get(name="Sueldo").category, "Salario mensual")
        self.assertEqual(sorted(account_model.objects.values_list("name", flat=True)), ["AHORROS (2)", "Ahorros"])
        self.assertEqual(sorted(budget_model.objects.values_list("category", flat=True)), ["OCIO (2)", "Ocio"])

        opening = transaction_model.objects.get(account__name="Ahorros", kind="OPENING")
        self.assertEqual((opening.transaction_type, opening.amount), ("INGRESO", Decimal("250.00")))
        adjustment = transaction_model.objects.get(account__name="AHORROS (2)", kind="ADJUSTMENT")
        self.assertEqual((adjustment.transaction_type, adjustment.amount), ("GASTO", Decimal("70.00")))
        for account in account_model.objects.all():
            movements = transaction_model.objects.filter(account=account)
            total = sum((m.amount if m.transaction_type == "INGRESO" else -m.amount for m in movements), Decimal("0"))
            self.assertEqual(account.balance, total, account.name)


class AlertLevelMigrationTests(MigrationTestCase):
    """Migración 0008: los niveles antiguos (colores) pasan a info|warning|danger|success."""

    def test_legacy_levels_are_normalized(self):
        user = get_user_model().objects.create_user(email="alertas@example.com", full_name="Alertas", password="Finova#2026")
        apps = self.migrate([("core", "0006_computed_budgets_and_constraints")])
        alert_model = apps.get_model("core", "FinanceAlert")
        legacy = ("rojo", "red", "amber", "indigo", "green", "morado")
        for level in legacy:
            alert_model.objects.create(owner_id=user.pk, category="Metas", title=level, description="x", level=level)

        apps = self.migrate([("core", "0008_normalize_alert_levels")])
        alert_model = apps.get_model("core", "FinanceAlert")

        rows = {row["title"]: row for row in alert_model.objects.values("title", "level", "severity", "rule", "dedupe_key")}
        self.assertEqual(
            {title: (rows[title]["level"], rows[title]["severity"]) for title in legacy},
            {"rojo": ("danger", 3), "red": ("danger", 3), "amber": ("warning", 2), "indigo": ("info", 1), "green": ("success", 0), "morado": ("info", 1)},
        )
        self.assertEqual({(row["rule"], row["dedupe_key"]) for row in rows.values()}, {("other", None)})
