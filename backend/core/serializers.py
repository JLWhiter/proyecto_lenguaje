from decimal import Decimal

from rest_framework import serializers
from rest_framework.fields import empty

from .alerts import ALERT_ACTIONS, DEFAULT_SNOOZE_HOURS, MAX_SNOOZE_HOURS
from .categories import category_key
from .finance import existing_category
from .models import FinanceAccount, FinanceBudget, FinanceTransaction, first_matching
from .periods import PERIOD_ERROR, PERIOD_REGEX, current_period, end_of_today, period_label, shift_month
from .transaction_filters import category_label

MONEY_DIGITS = 12  # como los DecimalField de los modelos: hasta 9,999,999,999.99
MONEY_DECIMALS = 2
ACCOUNT_ICONS = ["credit", "piggy", "phone", "cash"]
BUDGET_ICONS = ["shopping", "car", "home", "gamepad", "health"]
EXPORT_FORMATS = ["xlsx", "csv"]


def largest_amount(max_digits=MONEY_DIGITS, decimal_places=MONEY_DECIMALS):
    """Mayor monto que cabe en ``max_digits`` dígitos: 12 -> '9,999,999,999.99'."""
    return f"{int('9' * (max_digits - decimal_places)):,}.{'9' * decimal_places}"


def money_error_messages(max_digits=MONEY_DIGITS, decimal_places=MONEY_DECIMALS, allow_zero=False):
    """Mensajes de error de todos los campos de dinero, en el tono de la app."""
    too_large = f"El monto es demasiado grande (máximo {largest_amount(max_digits, decimal_places)})."
    return {
        "invalid": "Ingresa un monto válido.",
        "max_digits": too_large,
        "max_whole_digits": too_large,
        "max_string_length": too_large,
        "max_decimal_places": f"Usa como máximo {decimal_places} decimales.",
        "min_value": "El monto no puede ser negativo." if allow_zero else "El monto debe ser mayor que cero.",
    }


class MoneyField(serializers.DecimalField):
    """Monto con 2 decimales: mayor que cero o, con ``allow_zero``, mayor o igual a cero.

    Revisa los decimales antes que el tamaño, así '1234567890.123' responde
    "Usa como máximo 2 decimales." y no que el monto es demasiado grande.
    """

    def __init__(self, *, max_digits=MONEY_DIGITS, allow_zero=False, **kwargs):
        super().__init__(
            max_digits=max_digits,
            decimal_places=MONEY_DECIMALS,
            min_value=Decimal("0.00") if allow_zero else Decimal("0.01"),
            error_messages=money_error_messages(max_digits, MONEY_DECIMALS, allow_zero),
            **kwargs,
        )

    def validate_precision(self, value):
        exponent = value.as_tuple().exponent
        if isinstance(exponent, int) and -exponent > self.decimal_places:
            self.fail("max_decimal_places", max_decimal_places=self.decimal_places)
        return super().validate_precision(value)


class PeriodField(serializers.RegexField):
    """Período 'AAAA-MM'. Si no se envía (o llega vacío) se usa el mes actual."""

    default_error_messages = {"invalid": PERIOD_ERROR}

    def __init__(self, **kwargs):
        kwargs.setdefault("default", current_period)
        super().__init__(PERIOD_REGEX, **kwargs)

    def validate_empty_values(self, data):
        return super().validate_empty_values(empty if data == "" else data)


class MovementDateTimeField(serializers.DateTimeField):
    """Fecha de un movimiento: ISO 8601 o solo 'AAAA-MM-DD' (hora de Lima); nunca posterior a hoy."""

    def __init__(self, **kwargs):
        super().__init__(input_formats=["iso-8601", "%Y-%m-%d"], **kwargs)

    def to_internal_value(self, value):
        moment = super().to_internal_value(value)
        if moment >= end_of_today():
            raise serializers.ValidationError("La fecha no puede ser posterior a hoy.")
        return moment


class CategoryField(serializers.CharField):
    """Categoría sin espacios sobrantes y con mayúscula inicial ('  comida   rápida' -> 'Comida rápida')."""

    def __init__(self, **kwargs):
        super().__init__(max_length=80, **kwargs)

    def to_internal_value(self, data):
        return category_label(super().to_internal_value(data))


class ExistingCategoryMixin:
    """Guarda ``category`` con la forma que el usuario ya usa o la predeterminada
    ("alimentacion" -> "Alimentación"); el registro que se edita (``instance``) no cuenta."""

    def validate_category(self, value):
        return existing_category(self.context["request"].user, value, editing=self.instance)


class OwnedAccountField(serializers.PrimaryKeyRelatedField):
    """Id de una cuenta del usuario de la sesión; por defecto solo cuentas activas."""

    default_error_messages = {
        "does_not_exist": "La cuenta no existe o está archivada.",
        "incorrect_type": "Cuenta inválida.",
    }

    def __init__(self, include_archived=False, **kwargs):
        self.include_archived = include_archived
        super().__init__(**kwargs)

    def get_queryset(self):
        accounts = FinanceAccount.objects.filter(owner=self.context["request"].user)
        return accounts if self.include_archived else accounts.active()


class PeriodQuerySerializer(serializers.Serializer):
    mes = PeriodField()


class TransactionFilterSerializer(PeriodQuerySerializer):
    search = serializers.CharField(allow_blank=True, default="")
    tipo = serializers.ChoiceField(choices=FinanceTransaction.Type.choices, allow_blank=True, default="")
    categoria = serializers.CharField(allow_blank=True, default="")
    cuenta_id = OwnedAccountField(source="account", include_archived=True, allow_null=True, default=None)


class TransactionListQuerySerializer(TransactionFilterSerializer):
    page = serializers.IntegerField(min_value=1, default=1)
    page_size = serializers.IntegerField(min_value=1, max_value=500, default=100)


class TransactionExportQuerySerializer(TransactionFilterSerializer):
    """Exportación: los filtros del listado más ``formato`` (xlsx o csv) y ``todo=1`` (todo el historial, sin ``mes``)."""

    formato = serializers.ChoiceField(
        choices=EXPORT_FORMATS,
        allow_blank=True,
        default="",
        error_messages={"invalid_choice": "Formato no válido. Usa xlsx (Excel) o csv."},
    )
    todo = serializers.BooleanField(default=False, error_messages={"invalid": "Usa todo=1 para exportar todo el historial."})


class IncomeTaxQuerySerializer(serializers.Serializer):
    anio = serializers.IntegerField(required=False, min_value=2000, max_value=2100)
    ingreso_anual = MoneyField(max_digits=14, allow_zero=True, required=False)
    deducciones_adicionales = MoneyField(max_digits=14, allow_zero=True, required=False, default=Decimal("0.00"))
    proyectar = serializers.BooleanField(required=False, default=False, error_messages={"invalid": "Usa proyectar=1 o proyectar=0."})


class TransactionCreateSerializer(ExistingCategoryMixin, serializers.Serializer):
    name = serializers.CharField(max_length=160)
    category = CategoryField()
    amount = MoneyField()
    type = serializers.ChoiceField(choices=FinanceTransaction.Type.choices)
    account_id = OwnedAccountField(source="account")
    occurred_at = MovementDateTimeField(required=False)


class TransactionUpdateSerializer(ExistingCategoryMixin, serializers.Serializer):
    """Datos editables de un movimiento; la vista pasa el movimiento como ``instance``."""

    name = serializers.CharField(max_length=160, required=False)
    category = CategoryField(required=False)
    amount = MoneyField(required=False)
    account_id = OwnedAccountField(source="account", required=False)
    occurred_at = MovementDateTimeField(required=False)


class TransferSerializer(serializers.Serializer):
    source_account_id = OwnedAccountField(source="source")
    destination_account_id = OwnedAccountField(source="destination")
    amount = MoneyField()
    description = serializers.CharField(max_length=160, allow_blank=True, default="")
    occurred_at = MovementDateTimeField(required=False)


class DepositSerializer(serializers.Serializer):
    account_id = OwnedAccountField(source="account")
    amount = MoneyField()
    description = serializers.CharField(max_length=160, allow_blank=True, default="")
    occurred_at = MovementDateTimeField(required=False)


class AccountSerializer(serializers.Serializer):
    """Datos editables de una cuenta (PATCH usa ``partial=True``)."""

    name = serializers.CharField(max_length=120)
    account_type = serializers.CharField(max_length=80)
    description = serializers.CharField(max_length=160, allow_blank=True, default="")
    icon = serializers.ChoiceField(choices=ACCOUNT_ICONS, default="credit")

    def validate_name(self, value):
        accounts = FinanceAccount.objects.active().filter(owner=self.context["request"].user)
        if self.instance is not None:
            accounts = accounts.exclude(pk=self.instance.pk)
        if first_matching(accounts, "name", value):
            raise serializers.ValidationError("Ya existe una cuenta con ese nombre.")
        return value


class AccountCreateSerializer(AccountSerializer):
    balance = MoneyField(allow_zero=True, default=Decimal("0.00"))


class AccountBalanceSerializer(serializers.Serializer):
    balance = MoneyField(allow_zero=True)


class BudgetSerializer(ExistingCategoryMixin, serializers.Serializer):
    """Datos editables de un presupuesto (PATCH usa ``partial=True``).

    No puede haber dos presupuestos del mismo mes con la misma categoría
    (comparadas con ``category_key``: sin importar mayúsculas, espacios ni tildes).
    """

    category = CategoryField()
    description = serializers.CharField(max_length=180, allow_blank=True, default="")
    limit_amount = MoneyField()
    icon = serializers.ChoiceField(choices=BUDGET_ICONS, default="shopping")

    def validate(self, attrs):
        category = attrs.get("category")
        if category:
            month = attrs.get("month") or self.instance.month
            budgets = FinanceBudget.objects.filter(owner=self.context["request"].user, month=month)
            if self.instance is not None:
                budgets = budgets.exclude(pk=self.instance.pk)
            if first_matching(budgets, "category", category, key=category_key):
                raise serializers.ValidationError({"category": ["Ya existe un presupuesto para esta categoría en este mes."]})
        return attrs


class BudgetCreateSerializer(BudgetSerializer):
    month = PeriodField()


class BudgetAdjustSerializer(serializers.Serializer):
    limit_amount = MoneyField()


class BudgetRebalanceSerializer(serializers.Serializer):
    month = PeriodField()
    source_category = CategoryField()
    target_category = CategoryField()
    amount = MoneyField()

    def validate(self, attrs):
        budgets = FinanceBudget.objects.filter(owner=self.context["request"].user, month=attrs["month"])
        found = {
            field: first_matching(budgets, "category", attrs[field], key=category_key)
            for field in ("source_category", "target_category")
        }
        missing = {
            field: [f"No existe un presupuesto de {attrs[field]} en {period_label(attrs['month'])}."]
            for field, budget in found.items()
            if budget is None
        }
        if missing:
            raise serializers.ValidationError(missing)
        return {**attrs, "source": found["source_category"], "target": found["target_category"]}


class BudgetCopySerializer(serializers.Serializer):
    month = PeriodField()
    source_month = PeriodField(default=None)

    def validate(self, attrs):
        source = attrs["source_month"] or shift_month(attrs["month"], -1)
        if source == attrs["month"]:
            raise serializers.ValidationError({"source_month": ["El mes de origen debe ser distinto al de destino."]})
        return {**attrs, "source_month": source}


class SnoozeHoursField(serializers.IntegerField):
    def __init__(self, **kwargs):
        super().__init__(min_value=1, max_value=MAX_SNOOZE_HOURS, default=DEFAULT_SNOOZE_HOURS, **kwargs)


class AlertListQuerySerializer(serializers.Serializer):
    estado = serializers.ChoiceField(
        choices=["activas", "todas"], default="activas", error_messages={"invalid_choice": "Usa estado=activas o estado=todas."}
    )
    tipo = serializers.CharField(allow_blank=True, default="", max_length=80)


class AlertActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=sorted(ALERT_ACTIONS), error_messages={"invalid_choice": "Acción de alerta no válida."})
    hours = SnoozeHoursField()


class SnoozeAllSerializer(serializers.Serializer):
    hours = SnoozeHoursField()
