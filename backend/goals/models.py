from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db import transaction as db_transaction
from django.db.models import Q, Sum
from django.db.models.functions import Lower
from django.utils import timezone

from core.exceptions import OperacionNoPermitidaError

from . import planning
from .exceptions import AhorroInsuficienteError

ZERO = Decimal("0.00")
MIN_AMOUNT = Decimal("0.01")
INITIAL_NOTE = "Monto inicial"


class GoalIcon(models.TextChoices):
    LAPTOP = "laptop", "Tecnología"
    PLANE = "plane", "Viaje"
    HOME = "home", "Casa"
    CAR = "car", "Auto"
    GRADUATION = "graduation", "Estudios"
    GIFT = "gift", "Regalo"
    PIGGY = "piggy", "Ahorro"
    HEART = "heart", "Bienestar"


class ContributionKind(models.TextChoices):
    DEPOSIT = "APORTE", "Aporte"
    WITHDRAWAL = "RETIRO", "Retiro"


class SavingsGoalQuerySet(models.QuerySet):
    def active(self):
        return self.filter(archived=False)

    def archived(self):
        return self.filter(archived=True)

    def with_contributions(self):
        """Trae los movimientos en una sola consulta extra (los indicadores se calculan en Python)."""
        return self.prefetch_related("contributions")


class SavingsGoal(models.Model):
    """Meta de ahorro: dinero que el usuario va separando para algo concreto.

    Los aportes y retiros (``GoalContribution``) solo registran lo que el usuario
    separa: no mueven dinero entre cuentas ni tocan el libro de movimientos.
    Lo ahorrado no se guarda: es la suma de aportes menos retiros, así nunca se
    desfasa. Los indicadores (progreso, ritmo, estado) los calcula el módulo
    puro ``goals.planning``.
    """

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="savings_goals")
    name = models.CharField(max_length=120)
    description = models.CharField(max_length=180, blank=True)
    icon = models.CharField(max_length=16, choices=GoalIcon.choices, default=GoalIcon.PIGGY)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(MIN_AMOUNT)])
    target_date = models.DateField()
    archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = SavingsGoalQuerySet.as_manager()

    class Meta:
        ordering = ["target_date", "id"]
        # Las metas archivadas no reservan su nombre (la unicidad sin tildes la revisa el serializer).
        constraints = [
            models.UniqueConstraint(
                "owner", Lower("name"), condition=Q(archived=False), name="unique_active_goal_name_per_owner"
            ),
            models.CheckConstraint(condition=Q(target_amount__gt=0), name="savings_goal_target_positive"),
        ]

    def __str__(self):
        return f"{self.name} ({self.owner_id})"

    @classmethod
    def start(cls, owner, *, name, target_amount, target_date, icon=GoalIcon.PIGGY, description="", initial_amount=ZERO):
        """Crea la meta y, si hay ``initial_amount``, registra ese monto como su primer aporte."""
        with db_transaction.atomic():
            goal = cls.objects.create(
                owner=owner, name=name, target_amount=target_amount, target_date=target_date,
                icon=icon, description=description,
            )
            if initial_amount and initial_amount > 0:
                goal.contribute(initial_amount, note=INITIAL_NOTE)
        return goal

    # --- Indicadores ---------------------------------------------------------------

    @property
    def created_on(self):
        """Día (hora local) en que se creó la meta."""
        return timezone.localtime(self.created_at).date()

    def movements(self):
        """Aportes y retiros con signo para ``goals.planning`` (usa los precargados si los hay)."""
        return [planning.Contribution(item.occurred_at, item.signed_amount) for item in self.contributions.all()]

    @property
    def saved_amount(self):
        return planning.total_saved(self.movements())

    @property
    def remaining(self):
        return planning.remaining(self.saved_amount, self.target_amount)

    @property
    def progress_pct(self):
        return planning.progress_pct(self.saved_amount, self.target_amount)

    def months_left(self, today):
        return planning.months_left(self.target_date, today)

    def required_monthly(self, today):
        return planning.required_monthly(self.saved_amount, self.target_amount, self.target_date, today)

    def expected_progress_pct(self, today):
        return planning.expected_progress_pct(self.created_on, self.target_date, today)

    def status(self, today):
        return planning.goal_status(self.saved_amount, self.target_amount, self.created_on, self.target_date, today)

    def estimated_completion(self, today):
        return planning.estimated_completion(self.movements(), self.target_amount, today)

    def snapshot(self, today):
        """Todos los indicadores de una vez (recorre los movimientos una sola vez)."""
        return planning.snapshot(self.movements(), self.target_amount, self.created_on, self.target_date, today)

    # --- Aportes y retiros ---------------------------------------------------------------

    def contribute(self, amount, occurred_at=None, note=""):
        """Registra ``amount`` como dinero separado para la meta."""
        return self._record(ContributionKind.DEPOSIT, amount, occurred_at, note)

    def withdraw(self, amount, occurred_at=None, note=""):
        """Registra que se usó ``amount`` de lo ahorrado; no puede superar lo que hay en la meta."""
        return self._record(ContributionKind.WITHDRAWAL, amount, occurred_at, note)

    def stored_saved(self):
        """Lo ahorrado según la base de datos (no usa los movimientos precargados)."""
        totals = GoalContribution.objects.filter(goal=self).aggregate(
            deposits=Sum("amount", filter=Q(kind=ContributionKind.DEPOSIT)),
            withdrawals=Sum("amount", filter=Q(kind=ContributionKind.WITHDRAWAL)),
        )
        return (totals["deposits"] or ZERO) - (totals["withdrawals"] or ZERO)

    def ensure_editable(self):
        if self.archived:
            raise OperacionNoPermitidaError(f"La meta «{self.name}» está archivada. Restáurala para registrar aportes o retiros.")

    def _record(self, kind, amount, occurred_at, note):
        day = occurred_at or timezone.localdate()
        self.ensure_editable()
        if amount <= 0:
            raise OperacionNoPermitidaError("El monto debe ser mayor que cero.")
        date_error = planning.contribution_date_error(day, self.created_on, timezone.localdate())
        if date_error:
            raise OperacionNoPermitidaError(date_error)
        with db_transaction.atomic():
            if kind == ContributionKind.WITHDRAWAL:
                saved = self.stored_saved()
                if amount > saved:
                    raise AhorroInsuficienteError(self, saved)
            return GoalContribution.objects.create(goal=self, kind=kind, amount=amount, occurred_at=day, note=note)


class GoalContribution(models.Model):
    """Aporte (dinero que se separa) o retiro (dinero que se usa) de una meta, con monto positivo."""

    goal = models.ForeignKey(SavingsGoal, on_delete=models.CASCADE, related_name="contributions")
    kind = models.CharField(max_length=6, choices=ContributionKind.choices, default=ContributionKind.DEPOSIT)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(MIN_AMOUNT)])
    occurred_at = models.DateField(default=timezone.localdate)
    note = models.CharField(max_length=160, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]
        constraints = [models.CheckConstraint(condition=Q(amount__gt=0), name="goal_contribution_amount_positive")]

    def __str__(self):
        return f"{self.get_kind_display()} {self.amount} ({self.goal_id})"

    @property
    def signed_amount(self):
        return self.amount if self.kind == ContributionKind.DEPOSIT else -self.amount

    def cancel(self):
        """Elimina el movimiento. Un aporte no se puede eliminar si lo ahorrado quedaría en negativo."""
        goal = self.goal
        goal.ensure_editable()
        with db_transaction.atomic():
            if self.kind == ContributionKind.DEPOSIT and goal.stored_saved() - self.amount < 0:
                raise OperacionNoPermitidaError(
                    "No puedes eliminar este aporte: ya retiraste parte de ese dinero. Elimina primero el retiro."
                )
            self.delete()
