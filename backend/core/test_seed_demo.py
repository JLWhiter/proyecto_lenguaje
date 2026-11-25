from decimal import Decimal
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.test import TestCase
from django.utils import timezone

from .models import FinanceAccount, FinanceBudget, FinanceTransaction
from .periods import current_period, shift_month

Kind = FinanceTransaction.Kind
EMAIL = "demo@finova.local"


def seed(**options):
    call_command("seed_demo", stdout=StringIO(), **options)
    return get_user_model().objects.get(email=EMAIL)


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
        self.assertEqual(set(movements.values_list("kind", flat=True)), {Kind.OPENING, Kind.REGULAR, Kind.TRANSFER, Kind.DEPOSIT})
        self.assertLessEqual(movements.latest("occurred_at").occurred_at, timezone.now())
        first = timezone.localtime(movements.earliest("occurred_at").occurred_at)
        self.assertEqual(first.strftime("%Y-%m"), shift_month(current_period(), -5))
        self.assertEqual(FinanceBudget.objects.filter(owner=user, month=current_period()).count(), 6)

    def test_existing_data_requires_reset(self):
        user = seed()
        before = FinanceTransaction.objects.filter(owner=user).count()

        with self.assertRaises(CommandError):
            seed()
        seed(reset=True)

        self.assertEqual(FinanceTransaction.objects.filter(owner=user).count(), before)
        self.assertEqual(FinanceAccount.objects.filter(owner=user).count(), 3)

    def test_other_users_are_not_touched(self):
        other = get_user_model().objects.create_user(email="otro@example.com", full_name="Otro", password="Finova#2026")
        FinanceAccount.open(other, name="Mía", account_type="Ahorros", opening_balance=Decimal("10.00"))

        seed()
        seed(reset=True)

        self.assertEqual(FinanceAccount.objects.get(owner=other).balance, Decimal("10.00"))
