"""Impuesto a la Renta anual de trabajo dependiente (quinta categoría) en el Perú.

Reglas de la Ley del Impuesto a la Renta que se aplican:
- Deducción fija de 7 UIT sobre la renta bruta anual (art. 46).
- Deducción adicional por gastos sustentados de hasta 3 UIT (art. 46).
- Escala progresiva acumulativa sobre la renta neta (art. 53):
  hasta 5 UIT 8 %, más de 5 hasta 20 UIT 14 %, más de 20 hasta 35 UIT 17 %,
  más de 35 hasta 45 UIT 20 % y más de 45 UIT 30 %.

Todo se calcula con ``Decimal``. El impuesto de cada tramo se redondea a
céntimos (ROUND_HALF_UP) y el total es la suma de los tramos, así el detalle
siempre cuadra con el total. Es una estimación: no considera retenciones,
créditos ni otras rentas.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")
FIXED_DEDUCTION_UIT = 7
MAX_ADDITIONAL_DEDUCTION_UIT = 3

# Unidad Impositiva Tributaria por año, fijada cada año por decreto supremo.
UIT_BY_YEAR = {
    2023: Decimal("4950"),
    2024: Decimal("5150"),
    2025: Decimal("5350"),
    2026: Decimal("5500"),
}

# (límite superior del tramo en UIT, tasa). ``None`` es el último tramo, sin tope.
BRACKETS = (
    (5, Decimal("0.08")),
    (20, Decimal("0.14")),
    (35, Decimal("0.17")),
    (45, Decimal("0.20")),
    (None, Decimal("0.30")),
)


@dataclass(frozen=True)
class BracketTax:
    lower: Decimal
    upper: Decimal | None
    rate: Decimal
    taxable: Decimal
    tax: Decimal


@dataclass(frozen=True)
class IncomeTaxResult:
    gross_income: Decimal
    uit: Decimal
    deductions: Decimal
    net_income: Decimal
    tax: Decimal
    effective_rate: Decimal
    brackets: tuple


def to_cents(value):
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def uit_for_year(year):
    """Valor de la UIT del año; lanza ``ValueError`` si no está registrado."""
    try:
        return UIT_BY_YEAR[year]
    except KeyError:
        raise ValueError(f"No hay un valor de UIT registrado para el año {year}.") from None


def income_tax(gross_income, uit, additional_deductions=0):
    """Calcula el impuesto anual sobre la renta bruta ``gross_income``.

    ``additional_deductions`` son los gastos deducibles sustentados; se
    aceptan como máximo 3 UIT. Las deducciones nunca superan la renta bruta.
    """
    gross = to_cents(gross_income)
    uit = Decimal(uit)
    additional = Decimal(additional_deductions)
    if gross < 0 or additional < 0:
        raise ValueError("La renta y las deducciones no pueden ser negativas.")
    if uit <= 0:
        raise ValueError("La UIT debe ser mayor que cero.")

    allowed_additional = min(additional, MAX_ADDITIONAL_DEDUCTION_UIT * uit)
    deductions = to_cents(min(FIXED_DEDUCTION_UIT * uit + allowed_additional, gross))
    net = gross - deductions

    details = []
    lower = Decimal("0")
    for limit, rate in BRACKETS:
        upper = limit * uit if limit is not None else None
        taxable = (net if upper is None else min(net, upper)) - lower
        if taxable <= 0:
            break
        details.append(BracketTax(to_cents(lower), to_cents(upper) if upper is not None else None, rate, to_cents(taxable), to_cents(taxable * rate)))
        lower = upper

    tax = sum((item.tax for item in details), Decimal("0.00"))
    effective_rate = to_cents(tax / gross * 100) if gross else Decimal("0.00")
    return IncomeTaxResult(gross, to_cents(uit), deductions, net, tax, effective_rate, tuple(details))
