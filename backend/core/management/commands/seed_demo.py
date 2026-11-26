"""Crea (o regenera) un usuario de demostración con movimientos reales.

    python manage.py seed_demo [--email demo@finova.local] [--password ...] [--reset]

Sin ``--password``, el usuario nuevo recibe una contraseña aleatoria (``secrets``)
que se muestra una sola vez al terminar; si el usuario ya existía, conserva la suya.

Genera 3 cuentas y 6 meses de movimientos típicos de un trabajador en Lima
(sueldo, alquiler, comida, transporte, servicios, transferencias entre
cuentas y un depósito) hasta hoy, más presupuestos para el mes actual y dos
metas de ahorro con aportes de los últimos meses (una al día y otra atrasada),
y al final evalúa el motor de alertas para que el usuario tenga alertas reales.
Todo pasa por los mismos métodos de dominio que usa la API
(``FinanceAccount.open``, ``deposit``, ``withdraw``, ``transfer_to``), así los
saldos siempre son la suma de los movimientos. Los montos variables salen de
un generador aleatorio con semilla fija: para una misma fecha, cada ejecución
produce los mismos datos.
"""

import random
import secrets
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.alert_service import evaluate_goal_alerts, refresh_alerts
from core.exceptions import SaldoInsuficienteError
from core.models import AlertEvaluation, FinanceAccount, FinanceAlert, FinanceBudget, FinanceTransaction, MovementKind
from core.periods import current_period, days_in_period, first_day, local_today, parse_period, period_label, shift_month
from goals.models import INITIAL_NOTE, ContributionKind, SavingsGoal

DEFAULT_EMAIL = "demo@finova.local"
GENERATED_SECRET_BYTES = 12  # secrets.token_urlsafe: 16 caracteres aleatorios
MONTHS = 6
SEED = 2026
MAIN_ACCOUNT = "bcp"
FOOD = "Alimentación"
SALARY_SAVING = "Separado del sueldo"

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
    (3, ("bcp", "yape"), (60, 220), ("Plaza Vea", "Tottus", "Wong"), FOOD),
    (2, ("cash", "yape"), (25, 80), ("Mercado de Surquillo",), FOOD),
    (4, ("cash", "yape"), (12, 18), ("Menú del día",), FOOD),
    (2, ("yape", "bcp"), (25, 60), ("Rappi",), FOOD),
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
    (5, 12, 20, "expense", "yape", "95.00", "Concierto - Teleticket", "Entretenimiento"),
)

# Presupuestos del mes actual para los gastos variables. El alquiler no tiene
# presupuesto: es un pago fijo a inicio de mes y la proyección lineal lo
# extrapolaría como si se fuera a pagar otra vez.
BUDGETS = (
    (FOOD, "Supermercado, mercado y delivery", "900.00", "shopping"),
    ("Ropa", "Ropa y calzado", "200.00", "shopping"),
    ("Transporte", "Taxis por aplicativo y Metropolitano", "250.00", "car"),
    ("Servicios", "Luz, agua, internet y celular", "300.00", "home"),
    ("Entretenimiento", "Streaming, cine y salidas", "120.00", "gamepad"),
    ("Salud", "Farmacia y consultas", "150.00", "health"),
)


# Metas de ahorro. Solo registran lo que el usuario separa: no mueven dinero entre cuentas.
# "created": (meses antes del actual, día); "target_months": la fecha objetivo es el último día
# de ese mes contado desde el actual; "movements": (meses desde la creación, día, tipo, monto, nota).
# Los montos son soles enteros.
APORTE, RETIRO = ContributionKind.DEPOSIT, ContributionKind.WITHDRAWAL
GOALS = (
    {
        "name": "Laptop nueva",
        "description": "Para trabajar y estudiar desde casa",
        "icon": "laptop",
        "target_amount": 3500,
        "created": (4, 3),
        "target_months": 4,
        "movements": (
            (0, 3, APORTE, 600, INITIAL_NOTE),
            (1, 2, APORTE, 380, SALARY_SAVING),
            (2, 2, APORTE, 380, SALARY_SAVING),
            (3, 2, APORTE, 380, SALARY_SAVING),
            (4, 2, APORTE, 380, SALARY_SAVING),
        ),
    },
    {
        "name": "Viaje a Cusco",
        "description": "Pasajes y hospedaje para las vacaciones",
        "icon": "plane",
        "target_amount": 2000,
        "created": (5, 10),
        "target_months": 2,
        "movements": (
            (0, 10, APORTE, 300, INITIAL_NOTE),
            (1, 5, APORTE, 150, ""),
            (2, 5, APORTE, 150, ""),
            (3, 18, RETIRO, 100, "Imprevisto: reparación del celular"),
            (4, 5, APORTE, 120, ""),
        ),
    },
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
        account.deposit(item.amount, name=item.name, category=item.target, kind=MovementKind.REGULAR, occurred_at=item.when)
    elif item.action == "deposit":
        account.deposit(item.amount, name=item.name, occurred_at=item.when)
    else:
        pay(item, account, accounts[MAIN_ACCOUNT])


def create_goal(user, current, spec):
    """Crea una meta con fecha de creación en el pasado y registra sus aportes y retiros hasta hoy."""
    months_ago, day = spec["created"]
    created_period = shift_month(current, -months_ago)
    target_period = shift_month(current, spec["target_months"])
    goal = SavingsGoal.objects.create(
        owner=user,
        name=spec["name"],
        description=spec["description"],
        icon=spec["icon"],
        target_amount=Decimal(spec["target_amount"]),
        target_date=first_day(target_period).replace(day=days_in_period(target_period)),
        created_at=at(created_period, day, 9),
    )
    today = local_today()
    for offset, movement_day, kind, amount, note in spec["movements"]:
        when = at(shift_month(created_period, offset), movement_day, 9).date()
        if goal.created_on <= when <= today:
            register = goal.contribute if kind == APORTE else goal.withdraw
            register(Decimal(amount), occurred_at=when, note=note)
    return goal


def random_password():
    """Contraseña aleatoria para un usuario demo nuevo (se muestra una sola vez)."""
    return secrets.token_urlsafe(GENERATED_SECRET_BYTES)


def has_finance_data(user):
    owned = (FinanceAccount, FinanceTransaction, FinanceBudget, SavingsGoal)
    return any(model.objects.filter(owner=user).exists() for model in owned)


def clear_finance_data(user):
    for model in (FinanceAlert, AlertEvaluation, FinanceTransaction, FinanceBudget, FinanceAccount, SavingsGoal):
        model.objects.filter(owner=user).delete()


class Command(BaseCommand):
    help = "Crea o regenera un usuario de demostración con 6 meses de movimientos reales."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=DEFAULT_EMAIL, help=f"Correo del usuario demo (por defecto {DEFAULT_EMAIL}).")
        parser.add_argument(
            "--password",
            help="Contraseña del usuario demo. Si se omite, un usuario nuevo recibe una contraseña aleatoria "
            "(se muestra una sola vez) y uno existente conserva la suya.",
        )
        parser.add_argument("--reset", action="store_true", help="Borra y regenera los datos financieros si el usuario ya tiene.")

    @transaction.atomic
    def handle(self, *args, email, password, reset, **options):
        email = email.strip().lower()
        user, shown_password = self.demo_user(email, password, reset)
        months = [shift_month(current_period(), offset) for offset in range(1 - MONTHS, 1)]
        opened_at = at(months[0], 1, 7)
        accounts = {key: FinanceAccount.open(user, opened_at=opened_at, **fields) for key, fields in ACCOUNTS.items()}
        for item in build_plan(months, timezone.now(), random.Random(SEED)):
            apply(item, accounts)
        FinanceBudget.objects.bulk_create(
            FinanceBudget(owner=user, month=months[-1], category=category, description=description, limit_amount=Decimal(limit), icon=icon)
            for category, description, limit, icon in BUDGETS
        )
        for spec in GOALS:
            create_goal(user, months[-1], spec)
        refresh_alerts(user, months)
        evaluate_goal_alerts(user)
        movements = FinanceTransaction.objects.filter(owner=user).count()
        alerts = FinanceAlert.objects.filter(owner=user).count()
        self.stdout.write(self.style.SUCCESS(
            f"Usuario demo listo: {email} / contraseña: {shown_password}\n"
            f"{movements} movimientos en {len(accounts)} cuentas desde {period_label(months[0])}, "
            f"{len(BUDGETS)} presupuestos para {period_label(months[-1])}, {len(GOALS)} metas de ahorro y {alerts} alertas."
        ))

    def demo_user(self, email, password, reset):
        """Devuelve ``(usuario, contraseña a mostrar)``; nunca borra datos sin ``--reset``.

        Sin ``password``, un usuario nuevo recibe una contraseña aleatoria y uno
        existente conserva la suya.
        """
        user_model = get_user_model()
        user = user_model.objects.filter(email__iexact=email).first()
        if user is None:
            secret = password or random_password()
            user = user_model.objects.create_user(email=email, password=secret, full_name="Usuario Demo", email_verified=True)
            return user, secret if password else f"{secret} (generada al azar: guárdala, no se volverá a mostrar)"
        if has_finance_data(user):
            if not reset:
                raise CommandError(f"{email} ya tiene datos financieros. Usa --reset para borrarlos y regenerarlos.")
            clear_finance_data(user)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user, password or "(sin cambios)"
