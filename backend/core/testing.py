"""Utilidades compartidas por las pruebas de la API de finanzas."""

from datetime import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import FinanceAccount, FinanceTransaction

API = "/api/v1"


def local_datetime(year, month, day, hour=12, minute=0):
    """Fecha y hora en la zona horaria del proyecto (America/Lima)."""
    return timezone.make_aware(datetime(year, month, day, hour, minute))


class FinanceAPITestCase(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(email="finance@example.com", full_name="Finance User", password="Finova#2026")
        self.other_user = user_model.objects.create_user(email="other@example.com", full_name="Other User", password="Finova#2026")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def open_account(self, name="Principal", balance="0.00", opened_at=None, owner=None, **extra):
        return FinanceAccount.open(
            owner or self.user,
            name=name,
            account_type="Ahorros",
            opening_balance=Decimal(balance),
            opened_at=opened_at or local_datetime(2024, 1, 1),
            **extra,
        )

    def post_movement(self, account, name, category, amount, kind, occurred_at):
        response = self.client.post(
            f"{API}/transacciones/",
            {"name": name, "category": category, "amount": amount, "type": kind, "account_id": account.id, "occurred_at": occurred_at},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return FinanceTransaction.objects.get(pk=response.data["data"]["id"])

    def assert_balance(self, account, expected):
        account.refresh_from_db()
        self.assertEqual(account.balance, Decimal(expected))

    def assert_consistent(self, account):
        """El saldo guardado es exactamente la suma de los movimientos de la cuenta."""
        account.refresh_from_db()
        total = sum((movement.signed_amount for movement in account.transactions.all()), Decimal("0.00"))
        self.assertEqual(account.balance, total)
