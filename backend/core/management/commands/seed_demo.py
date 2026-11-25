"""Crea (o regenera) un usuario de demostración con movimientos reales.

    python manage.py seed_demo [--email demo@finova.local] [--password ...] [--reset]

Genera 3 cuentas y 6 meses de movimientos típicos de un trabajador en Lima
(sueldo, alquiler, comida, transporte, servicios, transferencias entre
cuentas y un depósito) hasta hoy, más presupuestos para el mes actual.
Todo pasa por los mismos métodos de dominio que usa la API
(``FinanceAccount.open``, ``deposit``, ``withdraw``, ``transfer_to``), así los
saldos siempre son la suma de los movimientos. Los montos variables salen de
un generador aleatorio con semilla fija: para una misma fecha, cada ejecución
produce los mismos datos.
"""

import random
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.exceptions import SaldoInsuficienteError
from core.models import FinanceAccount, FinanceAlert, FinanceBudget, FinanceTransaction
from core.periods import current_period, days_in_period, parse_period, period_label, shift_month

DEFAULT_EMAIL = "demo@finova.local"
DEFAULT_PASSWORD = "FinovaDemo#2026"
MONTHS = 6
SEED = 2026
MAIN_ACCOUNT = "bcp"

ACCOUNTS = {
    "bcp": {"name": "BCP Cuenta Sueldo", "account_type": "Cuenta de ahorros", "description": "**** 4812", "icon": "piggy", "opening_balance": Decimal("2500.00")},
    "yape": {"name": "Yape", "account_type": "Billetera digital", "description": "987 *** 123", "icon": "phone", "opening_balance": Decimal("150.00")},
    "cash": {"name": "Efectivo", "account_type": "Efectivo", "description": "Billetera física", "icon": "cash", "opening_balance": Decimal("200.00")},
}

# Cada mes: (día, hora, acción, cuenta, monto, descripción, categoría o cuenta destino).
MONTHLY = (
    (1, 9, "income", "bcp", "4200.00", "Sueldo - Andina Tech SAC", "Salario"),
    (2, 10, "transfer", "bcp", "400.00", "Recarga de Yape", "yape"),
    (2, 18, "transfer", "bcp", "300.00", "Retiro en cajero BCP", "cash"),
    (3, 8, "expense", "bcp", "1300.00", "Alquiler del departamento", "Vivienda"),
    (10, 21, "expense", "bcp", "44.90", "Netflix", "Entretenimiento"),
    (15, 19, "expense", "bcp", "119.90", "Claro Hogar - internet y celular", "Servicios"),
)

# Cada mes: (veces, cuentas posibles, (mínimo, máximo) en soles, descripciones, categoría).
VARIABLE = (
    (3, ("bcp", "yape"), (60, 220), ("Plaza Vea", "Tottus", "Wong"), "Alimentación"),
    (2, ("cash", "yape"), (25, 80), ("Mercado de Surquillo",), "Alimentación"),
    (4, ("cash", "yape"), (12, 18), ("Menú del día",), "Alimentación"),
    (2, ("yape", "bcp"), (25, 60), ("Rappi",), "Alimentación"),
    (6, ("yape",), (9, 28), ("Cabify", "InDrive"), "Transporte"),
    (3, ("cash",), (10, 20), ("Recarga tarjeta Metropolitano",), "Transporte"),
    (1, ("bcp",), (85, 140), ("Luz del Sur",), "Servicios"),
    (1, ("bcp",), (40, 75), ("Sedapal",), "Servicios"),
    (1, ("yape", "bcp"), (30, 90), ("Inkafarma", "Mifarma"), "Salud"),
    (1, ("yape", "cash"), (25, 60), ("Cineplanet", "Salida con amigos"), "Entretenimiento"),
)

# Una sola vez: (mes desde el inicio, día, hora, acción, cuenta, monto, descripción, categoría).
ONE_OFF = (
    (1, 20, 16, "expense", "bcp", "89.90", "Curso de Excel - Crehana", "Educación"),
    (2, 12, 11, "income", "bcp", "850.00", "Proyecto freelance - diseño web", "Honorarios"),
    (3, 14, 12, "deposit", "bcp", "500.00", "Depósito de ahorro familiar", ""),
    (4, 22, 17, "expense", "bcp", "179.90", "Saga Falabella - ropa", "Ropa"),
    (4, 25, 10, "income", "bcp", "850.00", "Proyecto freelance - landing page", "Honorarios"),
)

BUDGETS = (
    ("Alimentación", "Supermercado, mercado y delivery", "900.00", "shopping"),
    ("Vivienda", "Alquiler del departamento", "1300.00", "home"),
    ("Transporte", "Taxis por aplicativo y Metropolitano", "250.00", "car"),
    ("Servicios", "Luz, agua, internet y celular", "300.00", "home"),
    ("Entretenimiento", "Streaming, cine y salidas", "120.00", "gamepad"),
    ("Salud", "Farmacia y consultas", "150.00", "health"),
)


@dataclass(frozen=True)
class Planned:
    when: datetime
    action: str
    account: str
    amount: Decimal
    name: str
    target: str


def at(period, day, hour, minute=0):
    """Fecha y hora local dentro del período (el día se ajusta a meses cortos)."""
    year, month = parse_period(period)
    return timezone.make_aware(datetime(year, month, min(day, days_in_period(period)), hour, minute))


def month_plan(period, rng):
    fixed = [
        Planned(at(period, day, hour), action, account, Decimal(amount), name, target)
        for day, hour, action, account, amount, name, target in MONTHLY
    ]
    variable = [
        Planned(
            at(period, rng.randint(1, 28), rng.randint(8, 21), rng.choice((0, 15, 30, 45))),
            "expense",
            rng.choice(accounts),
            Decimal(rng.randint(low * 100, high * 100)) / 100,
            rng.choice(names),
            category,
        )
        for times, accounts, (low, high), names, category in VARIABLE
        for _ in range(times)
    ]
    return fixed + variable


def build_plan(months, now, rng):
    """Movimientos de todos los meses en orden cronológico, sin fechas futuras."""
    planned = [item for period in months for item in month_plan(period, rng)]
    planned += [
        Planned(at(months[index], day, hour), action, account, Decimal(amount), name, target)
        for index, day, hour, action, account, amount, name, target in ONE_OFF
    ]
    return sorted((item for item in planned if item.when <= now), key=lambda item: item.when)


def pay(item, account, fallback):
    """Registra un gasto; si la billetera no alcanza, se paga desde la cuenta principal."""
    expense = {"name": item.name, "category": item.target, "occurred_at": item.when}
    try:
        account.withdraw(item.amount, **expense)
    except SaldoInsuficienteError:
        fallback.withdraw(item.amount, **expense)


def apply(item, accounts):
    account = accounts[item.account]
    if item.action == "transfer":
        account.transfer_to(accounts[item.target], item.amount, description=item.name, occurred_at=item.when)
    elif item.action == "income":
        account.deposit(item.amount, name=item.name, category=item.target, kind=FinanceTransaction.Kind.REGULAR, occurred_at=item.when)
    elif item.action == "deposit":
        account.deposit(item.amount, name=item.name, occurred_at=item.when)
    else:
        pay(item, account, accounts[MAIN_ACCOUNT])


def has_finance_data(user):
    return any(model.objects.filter(owner=user).exists() for model in (FinanceAccount, FinanceTransaction, FinanceBudget))


def clear_finance_data(user):
    for model in (FinanceTransaction, FinanceBudget, FinanceAccount, FinanceAlert):
        model.objects.filter(owner=user).delete()


class Command(BaseCommand):
    help = "Crea o regenera un usuario de demostración con 6 meses de movimientos reales."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=DEFAULT_EMAIL, help=f"Correo del usuario demo (por defecto {DEFAULT_EMAIL}).")
        parser.add_argument("--password", help=f"Contraseña. Al crear el usuario, por defecto {DEFAULT_PASSWORD}.")
        parser.add_argument("--reset", action="store_true", help="Borra y regenera los datos financieros si el usuario ya tiene.")

    @transaction.atomic
    def handle(self, *args, email, password, reset, **options):
        email = email.strip().lower()
        user, created = self.demo_user(email, password, reset)
        months = [shift_month(current_period(), offset) for offset in range(1 - MONTHS, 1)]
        opened_at = at(months[0], 1, 7)
        accounts = {key: FinanceAccount.open(user, opened_at=opened_at, **fields) for key, fields in ACCOUNTS.items()}
        for item in build_plan(months, timezone.now(), random.Random(SEED)):
            apply(item, accounts)
        FinanceBudget.objects.bulk_create(
            FinanceBudget(owner=user, month=months[-1], category=category, description=description, limit_amount=Decimal(limit), icon=icon)
            for category, description, limit, icon in BUDGETS
        )
        shown_password = (password or DEFAULT_PASSWORD) if created else (password or "(sin cambios)")
        movements = FinanceTransaction.objects.filter(owner=user).count()
        self.stdout.write(self.style.SUCCESS(
            f"Usuario demo listo: {email} / contraseña: {shown_password}\n"
            f"{movements} movimientos en {len(accounts)} cuentas desde {period_label(months[0])} "
            f"y {len(BUDGETS)} presupuestos para {period_label(months[-1])}."
        ))

    def demo_user(self, email, password, reset):
        """Devuelve ``(usuario, creado)``; nunca borra datos sin ``--reset``."""
        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            user = User.objects.create_user(
                email=email, password=password or DEFAULT_PASSWORD, full_name="Usuario Demo", email_verified=True
            )
            return user, True
        if has_finance_data(user):
            if not reset:
                raise CommandError(f"{email} ya tiene datos financieros. Usa --reset para borrarlos y regenerarlos.")
            clear_finance_data(user)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user, False
