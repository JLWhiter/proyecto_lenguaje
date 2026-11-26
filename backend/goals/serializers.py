from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from core.categories import category_key
from core.models import first_matching
from core.serializers import MoneyField

from . import planning
from .models import ContributionKind, GoalIcon, SavingsGoal

ACTIVE, ARCHIVED = "activas", "archivadas"
NAME_MAX = 120
DESCRIPTION_MAX = 180
NOTE_MAX = 160
NAME_TAKEN = "Ya tienes una meta activa con ese nombre."
FUTURE_TARGET = "La fecha objetivo debe ser posterior a hoy."


def max_length_message(limit):
    return f"Usa como máximo {limit} caracteres."


def clean_text(value):
    """'  Viaje   a Cusco ' -> 'Viaje a Cusco'."""
    return " ".join(value.split())


class GoalDateField(serializers.DateField):
    """Fecha 'AAAA-MM-DD' con mensajes en el tono de la app."""

    def __init__(self, **kwargs):
        super().__init__(
            input_formats=["%Y-%m-%d", "iso-8601"],
            error_messages={
                "invalid": "Ingresa una fecha válida (AAAA-MM-DD).",
                "required": "Elige una fecha.",
                "null": "Elige una fecha.",
                "datetime": "Ingresa solo la fecha (AAAA-MM-DD).",
            },
            **kwargs,
        )


class GoalListQuerySerializer(serializers.Serializer):
    estado = serializers.ChoiceField(
        choices=[ACTIVE, ARCHIVED], default=ACTIVE, error_messages={"invalid_choice": "Usa estado=activas o estado=archivadas."}
    )


class GoalSerializer(serializers.Serializer):
    """Datos editables de una meta (PATCH usa ``partial=True``).

    No puede haber dos metas activas con el mismo nombre (comparados con
    ``category_key``: sin importar mayúsculas, espacios ni tildes).
    """

    name = serializers.CharField(
        max_length=NAME_MAX,
        error_messages={
            "required": "Escribe un nombre para tu meta.",
            "blank": "Escribe un nombre para tu meta.",
            "max_length": max_length_message(NAME_MAX),
        },
    )
    description = serializers.CharField(
        max_length=DESCRIPTION_MAX, allow_blank=True, default="", error_messages={"max_length": max_length_message(DESCRIPTION_MAX)}
    )
    icon = serializers.ChoiceField(choices=GoalIcon.choices, default=GoalIcon.PIGGY, error_messages={"invalid_choice": "Elige un ícono válido."})
    target_amount = MoneyField()
    target_date = GoalDateField()

    def validate_name(self, value):
        return clean_text(value)

    def validate_description(self, value):
        return value.strip()

    def validate_target_date(self, value):
        unchanged = self.instance is not None and value == self.instance.target_date
        if not unchanged and value <= timezone.localdate():
            raise serializers.ValidationError(FUTURE_TARGET)
        return value

    def validate(self, attrs):
        archived = attrs.get("archived", getattr(self.instance, "archived", False))
        restoring = self.instance is not None and self.instance.archived and not archived
        name = attrs.get("name", getattr(self.instance, "name", ""))
        if not archived and ("name" in attrs or restoring) and self.name_taken(name):
            raise serializers.ValidationError({"name": [NAME_TAKEN]})
        return attrs

    def name_taken(self, name):
        goals = SavingsGoal.objects.active().filter(owner=self.context["request"].user)
        if self.instance is not None:
            goals = goals.exclude(pk=self.instance.pk)
        return first_matching(goals, "name", name, key=category_key) is not None


class GoalCreateSerializer(GoalSerializer):
    initial_amount = MoneyField(allow_zero=True, required=False, default=Decimal("0.00"))


class GoalUpdateSerializer(GoalSerializer):
    archived = serializers.BooleanField(required=False, error_messages={"invalid": "Usa archived=true o archived=false."})


class ContributionSerializer(serializers.Serializer):
    """Aporte o retiro de la meta que la vista pasa en ``context['goal']``."""

    tipo = serializers.ChoiceField(
        choices=ContributionKind.choices,
        default=ContributionKind.DEPOSIT,
        error_messages={"invalid_choice": "Usa tipo=APORTE o tipo=RETIRO."},
    )
    amount = MoneyField()
    occurred_at = GoalDateField(required=False)
    note = serializers.CharField(max_length=NOTE_MAX, allow_blank=True, default="", error_messages={"max_length": max_length_message(NOTE_MAX)})

    def validate_occurred_at(self, value):
        error = planning.contribution_date_error(value, self.context["goal"].created_on, timezone.localdate())
        if error:
            raise serializers.ValidationError(error)
        return value

    def validate_note(self, value):
        return value.strip()
