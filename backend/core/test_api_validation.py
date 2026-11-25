"""Mensajes de validación de los montos (tono de la app, en español)."""

from decimal import Decimal

from django.test import SimpleTestCase

from .models import FinanceBudget
from .periods import current_period
from .serializers import MoneyField, largest_amount
from .testing import API, FinanceAPITestCase

TOO_LARGE = "El monto es demasiado grande (máximo 9,999,999,999.99)."
DECIMALS = "Usa como máximo 2 decimales."
INVALID = "Ingresa un monto válido."
POSITIVE = "El monto debe ser mayor que cero."
NOT_NEGATIVE = "El monto no puede ser negativo."


class MoneyMessagesTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.account = self.open_account(balance="100.00")
        self.wallet = self.open_account(name="Billetera")
        self.budget = FinanceBudget.objects.create(owner=self.user, category="Ocio", limit_amount=Decimal("100.00"))
        FinanceBudget.objects.create(owner=self.user, category="Salud", limit_amount=Decimal("100.00"))

    def expense(self, amount):
        payload = {"name": "Gasto", "category": "Ocio", "amount": amount, "type": "GASTO", "account_id": self.account.id}
        return self.client.post(f"{API}/transacciones/", payload, format="json")

    def assert_error(self, response, field, message):
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(response.data[field], [message])

    def test_amount_messages(self):
        cases = [
            ("99999999999.99", TOO_LARGE),  # 13 dígitos
            ("100000000000", TOO_LARGE),  # 12 dígitos enteros
            (1e20, TOO_LARGE),
            ("10.555", DECIMALS),
            ("1234567890.123", DECIMALS),  # demasiados decimales, aunque también sea largo
            ("abc", INVALID),
            ("NaN", INVALID),
            ("Infinity", INVALID),
            ("0", POSITIVE),
            ("-5", POSITIVE),
            ("9" * 1001, TOO_LARGE),
        ]
        for amount, message in cases:
            with self.subTest(amount=amount):
                self.assert_error(self.expense(amount), "amount", message)

    def test_largest_amount_is_accepted_by_validation(self):
        response = self.expense("9999999999.99")

        self.assertEqual((response.status_code, response.data["detail"]), (400, "La cuenta Principal no tiene saldo suficiente."))

    def test_every_money_field_uses_the_same_messages(self):
        movement = self.account.withdraw(Decimal("1.00"), name="Cine", category="Ocio")
        requests = {
            "edit": lambda amount: self.client.patch(f"{API}/transacciones/{movement.id}/", {"amount": amount}, format="json"),
            "transfer": lambda amount: self.client.post(
                f"{API}/transacciones/transferir/",
                {"source_account_id": self.account.id, "destination_account_id": self.wallet.id, "amount": amount},
                format="json",
            ),
            "deposit": lambda amount: self.client.post(
                f"{API}/transacciones/depositar/", {"account_id": self.account.id, "amount": amount}, format="json"
            ),
            "budget": lambda amount: self.client.post(
                f"{API}/presupuestos/", {"category": "Viajes", "limit_amount": amount}, format="json"
            ),
            "budget_edit": lambda amount: self.client.patch(
                f"{API}/presupuestos/{self.budget.id}/", {"limit_amount": amount}, format="json"
            ),
            "budget_adjust": lambda amount: self.client.patch(
                f"{API}/presupuestos/{self.budget.id}/ajustar/", {"limit_amount": amount}, format="json"
            ),
            "rebalance": lambda amount: self.client.post(
                f"{API}/presupuestos/rebalancear/",
                {"month": current_period(), "source_category": "Ocio", "target_category": "Salud", "amount": amount},
                format="json",
            ),
        }
        fields = {"budget": "limit_amount", "budget_edit": "limit_amount", "budget_adjust": "limit_amount"}
        for name, send in requests.items():
            field = fields.get(name, "amount")
            with self.subTest(name):
                self.assert_error(send("12345678901"), field, TOO_LARGE)
                self.assert_error(send("1.001"), field, DECIMALS)
                self.assert_error(send("x"), field, INVALID)
                self.assert_error(send("0"), field, POSITIVE)

    def test_balances_accept_zero_but_not_negative_values(self):
        create = lambda balance: self.client.post(  # noqa: E731
            f"{API}/cuentas/", {"name": f"Cuenta {balance}", "account_type": "Ahorros", "balance": balance}, format="json"
        )
        update = lambda balance: self.client.patch(f"{API}/cuentas/{self.account.id}/saldo/", {"balance": balance}, format="json")  # noqa: E731

        for send in (create, update):
            with self.subTest(send=send):
                self.assert_error(send("-1"), "balance", NOT_NEGATIVE)
                self.assert_error(send("99999999999"), "balance", TOO_LARGE)
                self.assert_error(send("5.5.5"), "balance", INVALID)
        self.assertEqual(create("0").status_code, 201)
        self.assertEqual(update("0").status_code, 200)

    def test_tax_amounts_allow_larger_values(self):
        too_large = "El monto es demasiado grande (máximo 999,999,999,999.99)."

        def tax(**params):
            return self.client.get(f"{API}/impuestos/renta/", {"anio": 2025, **params})

        self.assert_error(tax(ingreso_anual="-5"), "ingreso_anual", NOT_NEGATIVE)
        self.assert_error(tax(ingreso_anual="1000000000000"), "ingreso_anual", too_large)
        self.assert_error(tax(deducciones_adicionales="1.234"), "deducciones_adicionales", DECIMALS)
        self.assert_error(tax(deducciones_adicionales="mucho"), "deducciones_adicionales", INVALID)
        self.assertEqual(tax(ingreso_anual="999999999999.99").status_code, 200)
        self.assertEqual(tax(ingreso_anual="0").status_code, 200)


class MoneyFieldTests(SimpleTestCase):
    def test_largest_amount_text(self):
        self.assertEqual(largest_amount(), "9,999,999,999.99")
        self.assertEqual(largest_amount(14), "999,999,999,999.99")

    def test_field_quantizes_and_sets_the_minimum(self):
        field = MoneyField()

        self.assertEqual(field.run_validation("45.5"), Decimal("45.50"))
        self.assertEqual(field.max_digits, 12)
        self.assertEqual(field.min_value, Decimal("0.01"))
        self.assertEqual(MoneyField(allow_zero=True).min_value, Decimal("0.00"))
