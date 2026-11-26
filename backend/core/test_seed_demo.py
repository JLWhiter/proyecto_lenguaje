import re
from decimal import Decimal
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.test import TestCase
from django.utils import timezone

from .alerts import AlertRule
from .models import AlertEvaluation, FinanceAccount, FinanceAlert, FinanceBudget, FinanceTransaction, MovementKind
from .periods import current_period, shift_month

EMAIL = "demo@finova.local"


def seed(**options):
    return seed_with_output(**options)[0]


def seed_with_output(**options):
    """Ejecuta el comando y devuelve ``(usuario demo, texto impreso)``."""
    out = StringIO()
    call_command("seed_demo", stdout=out, **options)
    return get_user_model().objects.get(email=EMAIL), out.getvalue()


def shown_password(output):
    """La contraseña que el comando muestra después de «contraseña: »."""
    return re.search(r"contraseña: (\S+)", output).group(1)


class SeedDemoTests(TestCase):
    def test_creates_consistent_demo_data(self):
        user = seed(password="Demo#Segura2026")

        self.assertTrue(user.check_password("Demo#Segura2026"))
        accounts = FinanceAccount.objects.filter(owner=user)
        self.assertEqual(accounts.count(), 3)
        for account in accounts:
            total = sum((movement.signed_amount for movement in account.transactions.all()), Decimal("0.00"))
            self.assertEqual(account.balance, total, account.name)
            self.assertGreaterEqual(account.balance, 0)

        movements = FinanceTransaction.objects.filter(owner=user)
        self.assertEqual(set(movements.values_list("kind", flat=True)), {MovementKind.OPENING, MovementKind.REGULAR, MovementKind.TRANSFER, MovementKind.DEPOSIT})
        self.assertLessEqual(movements.latest("occurred_at").occurred_at, timezone.now())
        first = timezone.localtime(movements.earliest("occurred_at").occurred_at)
        self.assertEqual(first.strftime("%Y-%m"), shift_month(current_period(), -5))
        self.assertEqual(FinanceBudget.objects.filter(owner=user, month=current_period()).count(), 6)
        self.assertTrue(AlertEvaluation.objects.filter(owner=user, period=current_period()).exists())
        self.assertFalse(FinanceAlert.objects.filter(owner=user, rule=AlertRule.OTHER).exists())

    def test_existing_data_requires_reset(self):
        user = seed()
        before = FinanceTransaction.objects.filter(owner=user).count()

        with self.assertRaises(CommandError):
            seed()
        seed(reset=True)

        self.assertEqual(FinanceTransaction.objects.filter(owner=user).count(), before)
        self.assertEqual(FinanceAccount.objects.filter(owner=user).count(), 3)

    def test_without_password_a_new_user_gets_a_random_one_shown_once(self):
        user, output = seed_with_output()
        generated = shown_password(output)

        self.assertIn("generada al azar", output)
        self.assertGreaterEqual(len(generated), 16)
        self.assertTrue(user.check_password(generated))
        self.assertFalse(user.check_password("FinovaDemo#2026"))  # ya no hay contraseña fija

        user, output = seed_with_output(reset=True)
        self.assertIn("contraseña: (sin cambios)", output)
        self.assertNotIn(generated, output)
        self.assertTrue(user.check_password(generated))

    def test_each_new_demo_user_gets_a_different_password(self):
        first = shown_password(seed_with_output()[1])
        out = StringIO()
        call_command("seed_demo", email="otro-demo@finova.local", stdout=out)

        self.assertNotEqual(first, shown_password(out.getvalue()))

    def test_password_option_replaces_the_password_of_an_existing_user(self):
        seed()
        user, output = seed_with_output(reset=True, password="Nueva#Clave2026")

        self.assertIn("contraseña: Nueva#Clave2026", output)
        self.assertTrue(user.check_password("Nueva#Clave2026"))

    def test_other_users_are_not_touched(self):
        other = get_user_model().objects.create_user(email="otro@example.com", full_name="Otro", password="Finova#2026")
        FinanceAccount.open(other, name="Mía", account_type="Ahorros", opening_balance=Decimal("10.00"))

        seed()
        seed(reset=True)

        self.assertEqual(FinanceAccount.objects.get(owner=other).balance, Decimal("10.00"))
