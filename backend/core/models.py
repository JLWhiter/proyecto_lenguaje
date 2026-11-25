import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.db import transaction as db_transaction
from django.db.models import F, Q
from django.db.models.functions import Lower, Round
from django.utils import timezone

from .alerts import AlertLevel, AlertRule
from .categories import category_key
from .exceptions import OperacionNoPermitidaError, SaldoInsuficienteError
from .money import money
from .periods import PERIOD_ERROR, PERIOD_REGEX, current_period, period_bounds
from .transaction_filters import normalize_text


def first_matching(records, field, value, key=normalize_text):
    """Primer registro cuyo ``field`` tiene la misma clave que ``value``.

    Por defecto compara sin importar mayúsculas ni espacios; las categorías usan
    ``key=category_key`` (además, sin importar tildes). La comparación se hace en
    Python porque ``LOWER``/``iexact`` de SQLite solo entienden letras ASCII
    ('ALIMENTACIÓN' no coincidiría con 'alimentación').
    """
    target = key(value)
    return next((record for record in records if key(getattr(record, field)) == target), None)


class MovementType(models.TextChoices):
    INCOME = "INGRESO", "Ingreso"
    EXPENSE = "GASTO", "Gasto"


class MovementKind(models.TextChoices):
    REGULAR = "REGULAR", "Movimiento"
    TRANSFER = "TRANSFER", "Transferencia"
    DEPOSIT = "DEPOSIT", "Depósito"
    ADJUSTMENT = "ADJUSTMENT", "Ajuste de saldo"
    OPENING = "OPENING", "Saldo inicial"


class FinanceAccountQuerySet(models.QuerySet):
    def active(self):
        """Cuentas no archivadas (las que se muestran en listas y selectores)."""
        return self.filter(is_archived=False)


class FinanceAccount(models.Model):
    """Cuenta de dinero del usuario: banco, billetera digital o efectivo.

    El saldo nunca se edita directamente: cada cambio pasa por ``deposit``,
    ``withdraw``, ``transfer_to`` o ``adjust_balance``, que registran el
    movimiento y actualizan el saldo en la misma transacción de base de datos.
    Así el saldo de la cuenta siempre es la suma de sus movimientos.
    """

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_accounts")
    name = models.CharField(max_length=120)
    account_type = models.CharField(max_length=80)
    description = models.CharField(max_length=160, blank=True)
    status = models.CharField(max_length=40, default="Activa")
    badge = models.CharField(max_length=40, blank=True)
    icon = models.CharField(max_length=24, default="credit")
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = FinanceAccountQuerySet.as_manager()

    class Meta:
        ordering = ["id"]
        # Las cuentas archivadas no reservan su nombre: se puede crear otra "Yape".
        constraints = [
            models.UniqueConstraint(
                "owner", Lower("name"), condition=Q(is_archived=False), name="unique_active_account_name_per_owner"
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.owner_id})"

    @classmethod
    def open(cls, owner, *, name, account_type, description="", icon="credit", opening_balance=Decimal("0.00"), opened_at=None):
        """Crea la cuenta y registra su saldo inicial como un movimiento de apertura (OPENING)."""
        with db_transaction.atomic():
            account = cls.objects.create(
                owner=owner, name=name, account_type=account_type, description=description,
                icon=icon, status="Activa", badge="Activa",
            )
            if opening_balance > 0:
                account.deposit(
                    opening_balance, name="Saldo inicial", category="Saldo inicial",
                    kind=MovementKind.OPENING, occurred_at=opened_at,
                )
        return account

    def deposit(self, amount, *, name="Depósito", category="Depósito", kind=MovementKind.DEPOSIT, occurred_at=None, transfer_group=None):
        """Ingresa ``amount`` a la cuenta y registra el movimiento de ingreso."""
        return self._record(
            MovementType.INCOME, amount, name=name, category=category, kind=kind,
            occurred_at=occurred_at, transfer_group=transfer_group,
        )

    def withdraw(self, amount, *, name, category, kind=MovementKind.REGULAR, occurred_at=None, transfer_group=None):
        """Retira ``amount`` y registra el gasto; lanza ``SaldoInsuficienteError`` si no alcanza el saldo."""
        return self._record(
            MovementType.EXPENSE, amount, name=name, category=category, kind=kind,
            occurred_at=occurred_at, transfer_group=transfer_group,
        )

    def transfer_to(self, destination, amount, *, description="", occurred_at=None):
        """Mueve dinero a otra cuenta del mismo usuario.

        Crea dos movimientos TRANSFER (salida y entrada) unidos por el mismo
        ``transfer_group``; no cuentan como ingreso ni gasto del mes.
        Devuelve la tupla ``(salida, entrada)``.
        """
        if destination.pk == self.pk:
            raise OperacionNoPermitidaError("Selecciona dos cuentas distintas.")
        if destination.owner_id != self.owner_id:
            raise OperacionNoPermitidaError("Solo puedes transferir entre tus propias cuentas.")
        legs = {
            "category": "Transferencia",
            "kind": MovementKind.TRANSFER,
            "occurred_at": occurred_at or timezone.now(),
            "transfer_group": uuid.uuid4(),
        }
        with db_transaction.atomic():
            debit = self.withdraw(amount, name=description or f"Transferencia a {destination.name}", **legs)
            credit = destination.deposit(amount, name=description or f"Transferencia desde {self.name}", **legs)
        return debit, credit

    def adjust_balance(self, new_balance, *, occurred_at=None):
        """Lleva el saldo a ``new_balance`` registrando un ajuste (ADJUSTMENT) por la diferencia.

        Devuelve el movimiento creado, o ``None`` si el saldo no cambia.
        """
        self.refresh_from_db(fields=["balance"])
        difference = new_balance - self.balance
        adjustment = {"name": "Ajuste de saldo", "category": "Ajuste de saldo", "kind": MovementKind.ADJUSTMENT, "occurred_at": occurred_at}
        if difference > 0:
            return self.deposit(difference, **adjustment)
        if difference < 0:
            return self.withdraw(-difference, **adjustment)
        return None

    def close(self):
        """Cierra una cuenta con saldo cero.

        Si tiene movimientos se archiva (para no perder el historial); si no,
        se elimina. Devuelve ``True`` si quedó archivada.
        """
        with db_transaction.atomic():
            has_history = self.transactions.exists()
            closable = FinanceAccount.objects.filter(pk=self.pk, balance=0)
            if has_history:
                closed = closable.update(is_archived=True, status="Archivada", badge="Archivada", updated_at=timezone.now())
            else:
                closed, _ = closable.delete()
            if not closed:
                raise OperacionNoPermitidaError(
                    f"Solo puedes eliminar una cuenta con saldo {money(0, self.owner.currency)}. "
                    "Transfiere o ajusta su saldo primero."
                )
        return has_history

    def _record(self, transaction_type, amount, *, occurred_at=None, **fields):
        """Aplica el movimiento al saldo y lo registra, todo o nada."""
        if amount <= 0:
            raise OperacionNoPermitidaError("El monto debe ser mayor que cero.")
        is_income = transaction_type == MovementType.INCOME
        with db_transaction.atomic():
            self._apply_delta(amount if is_income else -amount)
            return FinanceTransaction.objects.create(
                owner_id=self.owner_id,
                account=self,
                transaction_type=transaction_type,
                amount=amount,
                status="Acreditado" if is_income else "Completado",
                occurred_at=occurred_at or timezone.now(),
                **fields,
            )

    def _apply_delta(self, delta):
        """Suma ``delta`` al saldo con un UPDATE condicional.

        Uso interno: quien lo llama registra o elimina el movimiento dentro de la
        misma transacción. La condición ``saldo >= retiro`` la evalúa la base de
        datos en la misma sentencia, así dos retiros simultáneos no pueden dejar
        la cuenta en negativo (SQLite ignora ``select_for_update``).
        """
        rows = FinanceAccount.objects.filter(pk=self.pk, is_archived=False)
        if delta < 0:
            rows = rows.filter(balance__gte=-delta)
        updated = rows.update(balance=Round(F("balance") + delta, 2), updated_at=timezone.now())
        self.refresh_from_db(fields=["balance", "is_archived", "updated_at"])
        if self.is_archived:
            raise OperacionNoPermitidaError(f"La cuenta {self.name} está archivada.")
        if not updated:
            raise SaldoInsuficienteError(self)


class FinanceTransactionQuerySet(models.QuerySet):
    def in_period(self, period):
        """Movimientos del mes 'AAAA-MM' en hora local."""
        start, end = period_bounds(period)
        return self.filter(occurred_at__gte=start, occurred_at__lt=end)


class FinanceTransaction(models.Model):
    """Movimiento de dinero de una cuenta, siempre con monto positivo.

    ``transaction_type`` dice si el dinero entra (INGRESO) o sale (GASTO) y
    ``kind`` qué lo originó:

    - REGULAR: ingreso o gasto registrado por el usuario. Cuenta en los totales
      del mes, en los presupuestos y (si es ingreso) como renta de trabajo.
    - DEPOSIT: depósito de dinero. Cuenta como ingreso del mes, pero no como renta.
    - TRANSFER, ADJUSTMENT, OPENING: solo mueven saldos; no son ingresos ni gastos.
    """

    Type = MovementType
    Kind = MovementKind
    SUMMARY_KINDS = (MovementKind.REGULAR, MovementKind.DEPOSIT)
    TAXABLE_KINDS = (MovementKind.REGULAR,)
    DELETABLE_KINDS = (MovementKind.REGULAR, MovementKind.DEPOSIT, MovementKind.TRANSFER)

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_transactions")
    account = models.ForeignKey(FinanceAccount, null=True, blank=True, on_delete=models.SET_NULL, related_name="transactions")
    account_label = models.CharField(max_length=120, blank=True)
    name = models.CharField(max_length=160)
    category = models.CharField(max_length=80)
    transaction_type = models.CharField(max_length=8, choices=MovementType.choices)
    kind = models.CharField(max_length=10, choices=MovementKind.choices, default=MovementKind.REGULAR)
    transfer_group = models.UUIDField(null=True, blank=True, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    status = models.CharField(max_length=40, default="Completado")
    occurred_at = models.DateTimeField(default=timezone.now)

    objects = FinanceTransactionQuerySet.as_manager()

    class Meta:
        ordering = ["-occurred_at", "-id"]
        indexes = [models.Index(fields=["owner", "-occurred_at"], name="finance_tx_owner_date_idx")]
        constraints = [models.CheckConstraint(condition=Q(amount__gt=0), name="finance_tx_amount_positive")]

    def __str__(self):
        return f"{self.name} ({self.amount})"

    @property
    def signed_amount(self):
        """Monto con signo: positivo si entra dinero, negativo si sale."""
        return self.amount if self.transaction_type == MovementType.INCOME else -self.amount

    @property
    def is_editable(self):
        return self.kind == MovementKind.REGULAR

    @property
    def is_deletable(self):
        return self.kind in self.DELETABLE_KINDS

    def edit(self, *, account=None, amount=None, **fields):
        """Edita un movimiento regular y reajusta los saldos en la misma transacción.

        ``fields`` admite ``name``, ``category`` y ``occurred_at``. Si cambia
        la cuenta, se revierte el efecto en la cuenta anterior y se aplica en
        la nueva; si es la misma, solo se aplica la diferencia.
        """
        if not self.is_editable:
            raise OperacionNoPermitidaError("Solo se pueden editar ingresos y gastos regulares.")
        account = account or self.account
        if account is None:
            raise OperacionNoPermitidaError("Selecciona la cuenta del movimiento.")
        amount = amount or self.amount
        signed = amount if self.transaction_type == MovementType.INCOME else -amount
        with db_transaction.atomic():
            for target, delta in self._balance_changes(account, signed):
                target._apply_delta(delta)
            for field, value in {"account": account, "amount": amount, **fields}.items():
                setattr(self, field, value)
            self.save()
        return self

    def cancel(self):
        """Elimina el movimiento y revierte su efecto en el saldo.

        Una transferencia se anula completa: se eliminan sus dos movimientos.
        Los saldos iniciales y ajustes no se eliminan (se corrigen con otro ajuste).
        """
        if not self.is_deletable:
            raise OperacionNoPermitidaError(
                "Los movimientos de saldo inicial o de ajuste no se pueden eliminar. "
                "Usa «Actualizar saldo» para corregir el saldo de la cuenta."
            )
        with db_transaction.atomic():
            legs = self._legs()
            for leg in legs:
                leg._revert()
            FinanceTransaction.objects.filter(pk__in=[leg.pk for leg in legs]).delete()

    def _balance_changes(self, account, signed_amount):
        """Cambios de saldo ``[(cuenta, delta)]`` para pasar del estado actual al editado."""
        if self.account_id == account.pk:
            return [(account, signed_amount - self.signed_amount)]
        previous = [(self.account, -self.signed_amount)] if self.account_id else []
        return [*previous, (account, signed_amount)]

    def _legs(self):
        """El propio movimiento o, si es una transferencia, sus dos movimientos."""
        if self.kind != MovementKind.TRANSFER:
            return [self]
        if self.transfer_group is None:
            raise OperacionNoPermitidaError("Esta transferencia no tiene registrada su contrapartida; no se puede eliminar.")
        return list(
            FinanceTransaction.objects.filter(owner_id=self.owner_id, transfer_group=self.transfer_group).select_related("account")
        )

    def _revert(self):
        if self.account is None:
            return
        try:
            self.account._apply_delta(-self.signed_amount)
        except SaldoInsuficienteError as error:
            raise SaldoInsuficienteError(
                self.account,
                f"No se puede anular «{self.name}»: el saldo de la cuenta {self.account.name} ya fue utilizado.",
            ) from error


class FinanceBudget(models.Model):
    """Límite de gasto mensual para una categoría.

    Lo gastado no se guarda: se calcula sumando los gastos REGULAR de la
    categoría en el mes (``finance.spent_by_category``), así nunca se desfasa.
    """

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_budgets")
    month = models.CharField(max_length=7, default=current_period, validators=[RegexValidator(PERIOD_REGEX, PERIOD_ERROR)])
    category = models.CharField(max_length=80)
    description = models.CharField(max_length=180, blank=True)
    limit_amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    icon = models.CharField(max_length=24, default="shopping")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]
        constraints = [models.UniqueConstraint("owner", Lower("category"), "month", name="unique_finance_budget_category_per_month")]

    def __str__(self):
        return f"{self.category} ({self.owner_id})"

    @classmethod
    def copy_month(cls, owner, source, target):
        """Copia los presupuestos del mes ``source`` al mes ``target``.

        Omite las categorías que ya tienen presupuesto en ``target`` (comparadas con ``category_key``).
        Devuelve ``(presupuestos_creados, cantidad_omitida)``.
        """
        taken = {category_key(category) for category in cls.objects.filter(owner=owner, month=target).values_list("category", flat=True)}
        originals = list(cls.objects.filter(owner=owner, month=source))
        copies = [
            cls(owner=owner, month=target, category=budget.category, description=budget.description, limit_amount=budget.limit_amount, icon=budget.icon)
            for budget in originals
            if category_key(budget.category) not in taken
        ]
        return cls.objects.bulk_create(copies), len(originals) - len(copies)

    def move_limit_to(self, target, amount, spent):
        """Pasa ``amount`` del límite de este presupuesto al de ``target``.

        ``spent`` es lo ya gastado en este presupuesto: solo se puede mover lo
        que queda libre.
        """
        if target.pk == self.pk:
            raise OperacionNoPermitidaError("Elige dos presupuestos distintos.")
        available = self.limit_amount - spent
        if amount > available:
            raise OperacionNoPermitidaError(
                f"No hay saldo disponible suficiente para rebalancear: {self.category} tiene "
                f"{money(max(available, Decimal('0')), self.owner.currency)} libres."
            )
        with db_transaction.atomic():
            FinanceBudget.objects.filter(pk=self.pk).update(limit_amount=Round(F("limit_amount") - amount, 2), updated_at=timezone.now())
            FinanceBudget.objects.filter(pk=target.pk).update(limit_amount=Round(F("limit_amount") + amount, 2), updated_at=timezone.now())
        self.refresh_from_db(fields=["limit_amount", "updated_at"])
        target.refresh_from_db(fields=["limit_amount", "updated_at"])


def active_alert(now):
    """Condición de alerta visible: no descartada y sin posponer (o con la posposición ya vencida)."""
    return Q(dismissed=False) & (Q(snoozed_until__isnull=True) | Q(snoozed_until__lte=now))


class FinanceAlertQuerySet(models.QuerySet):
    def active(self, now=None):
        return self.filter(active_alert(now or timezone.now()))


class FinanceAlert(models.Model):
    """Aviso para el usuario generado por el motor de alertas (``core.alerts``).

    Cada alerta generada tiene una ``dedupe_key`` única por usuario (por ejemplo
    ``budget_threshold:12``): al reevaluar, la alerta existente se actualiza o
    escala en lugar de duplicarse, y se elimina si la condición desaparece.
    ``severity`` ordena las alertas y detecta escaladas (un presupuesto excedido
    es más grave que uno al 95 %, aunque ambos tengan nivel ``danger``).
    Las alertas sin ``dedupe_key`` (``rule=other``) no las toca el motor.
    """

    Rule = AlertRule
    Level = AlertLevel

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_alerts")
    rule = models.CharField(max_length=32, choices=AlertRule.choices, default=AlertRule.OTHER)
    level = models.CharField(max_length=16, choices=AlertLevel.choices, default=AlertLevel.INFO)
    severity = models.PositiveSmallIntegerField(default=1)
    period = models.CharField(max_length=7, blank=True)
    budget = models.ForeignKey(FinanceBudget, null=True, blank=True, on_delete=models.CASCADE, related_name="alerts")
    transaction = models.ForeignKey(FinanceTransaction, null=True, blank=True, on_delete=models.CASCADE, related_name="alerts")
    dedupe_key = models.CharField(max_length=80, null=True, blank=True)
    title = models.CharField(max_length=160)
    description = models.TextField()
    action_label = models.CharField(max_length=80, blank=True)
    action = models.JSONField(default=dict, blank=True)
    percentage = models.FloatField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    dismissed = models.BooleanField(default=False)
    snoozed_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    objects = FinanceAlertQuerySet.as_manager()

    class Meta:
        ordering = ["-severity", "-created_at", "id"]
        indexes = [models.Index(fields=["owner", "period"], name="finance_alert_owner_period_idx")]
        constraints = [models.UniqueConstraint(fields=["owner", "dedupe_key"], name="unique_finance_alert_key_per_owner")]

    def __str__(self):
        return self.title


class AlertEvaluation(models.Model):
    """Última vez que el motor de alertas evaluó un mes de un usuario.

    Permite evaluar de forma perezosa (al abrir el dashboard o las alertas)
    solo si el mes no se evaluó hoy, o si cerró después de su última evaluación.
    """

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="alert_evaluations")
    period = models.CharField(max_length=7)
    evaluated_at = models.DateTimeField()
    # Moneda con la que se redactaron los textos; si el usuario la cambia, se reevalúa.
    currency = models.CharField(max_length=3, default="PEN")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "period"], name="unique_alert_evaluation_per_period")]

    def __str__(self):
        return f"{self.period} ({self.owner_id})"
