"""Formato de montos según la moneda del usuario (sin dependencias de Django)."""

from decimal import Decimal

CURRENCY_SYMBOLS = {"PEN": "S/", "USD": "$", "EUR": "€"}


def money(amount, currency="PEN"):
    """Decimal('1234.5') -> 'S/ 1,234.50' (símbolo según la moneda del usuario)."""
    value = Decimal(amount)
    symbol = CURRENCY_SYMBOLS.get(currency, "S/")
    sign = "-" if value < 0 else ""
    return f"{sign}{symbol} {abs(value):,.2f}"
