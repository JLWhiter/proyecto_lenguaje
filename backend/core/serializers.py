from decimal import Decimal

from rest_framework import serializers

from .models import FinanceTransaction


class DashboardSummarySerializer(serializers.Serializer):
    balance_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    balance_variacion = serializers.CharField()
    ingresos_mensuales = serializers.DecimalField(max_digits=12, decimal_places=2)
    ingresos_variacion = serializers.CharField()
    gastos_mensuales = serializers.DecimalField(max_digits=12, decimal_places=2)
    gastos_variacion = serializers.CharField()
    presupuesto_porcentaje = serializers.FloatField()
    presupuesto_limite = serializers.DecimalField(max_digits=12, decimal_places=2)
    presupuesto_consumido = serializers.DecimalField(max_digits=12, decimal_places=2)
    presupuesto_restante = serializers.DecimalField(max_digits=12, decimal_places=2)
    evolucion_saldo = serializers.ListField(child=serializers.DictField())
    evolucion_periodo = serializers.CharField(allow_blank=True)
    evolucion_tendencia = serializers.CharField()
    distribucion_gastos = serializers.ListField(child=serializers.DictField())
    alertas_activas = serializers.ListField(child=serializers.DictField())
    ultimas_transacciones = serializers.ListField(child=serializers.DictField())


class TransactionFilterSerializer(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True)
    tipo = serializers.ChoiceField(choices=["INGRESO", "GASTO"], required=False, allow_blank=True)
    categoria = serializers.CharField(required=False, allow_blank=True)
    cuenta_id = serializers.IntegerField(required=False, allow_null=True)
    mes = serializers.CharField(required=False, allow_blank=True)


class IncomeTaxQuerySerializer(serializers.Serializer):
    anio = serializers.IntegerField(required=False, min_value=2000, max_value=2100)
    ingreso_anual = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, min_value=0)
    deducciones_adicionales = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, min_value=0, default=0)


class TransactionCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160)
    category = serializers.CharField(max_length=80)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    type = serializers.ChoiceField(choices=FinanceTransaction.Type.choices)
    account_id = serializers.IntegerField()
    occurred_at = serializers.DateTimeField(required=False)


class TransferSerializer(serializers.Serializer):
    source_account_id = serializers.IntegerField()
    destination_account_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    description = serializers.CharField(max_length=160, required=False, allow_blank=True)


class DepositSerializer(serializers.Serializer):
    account_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    description = serializers.CharField(max_length=160, required=False, allow_blank=True)


class AccountCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    account_type = serializers.CharField(max_length=80)
    description = serializers.CharField(max_length=160, required=False, allow_blank=True)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.00"), required=False, default=Decimal("0.00"))
    icon = serializers.ChoiceField(choices=["credit", "piggy", "phone", "cash"], default="credit")


class AccountBalanceSerializer(serializers.Serializer):
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.00"))


class BudgetCreateSerializer(serializers.Serializer):
    month = serializers.RegexField(r"^\d{4}-(0[1-9]|1[0-2])$", required=False, default="2024-05")
    category = serializers.CharField(max_length=80)
    description = serializers.CharField(max_length=180, required=False, allow_blank=True)
    limit_amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    icon = serializers.ChoiceField(choices=["shopping", "car", "home", "gamepad", "health"], default="shopping")


class BudgetAdjustSerializer(serializers.Serializer):
    limit_amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))


class BudgetRebalanceSerializer(serializers.Serializer):
    month = serializers.RegexField(r"^\d{4}-(0[1-9]|1[0-2])$", required=False, default="2024-05")
    source_category = serializers.CharField(max_length=80)
    target_category = serializers.CharField(max_length=80)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))


class BudgetSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre = serializers.CharField()
    estado = serializers.CharField()
    descripcion = serializers.CharField()
    presupuestado = serializers.DecimalField(max_digits=12, decimal_places=2)
    gastado = serializers.DecimalField(max_digits=12, decimal_places=2)
    restante = serializers.DecimalField(max_digits=12, decimal_places=2)
    porcentaje = serializers.FloatField()
    proyeccion = serializers.DecimalField(max_digits=12, decimal_places=2)
    detalle = serializers.CharField()
    color = serializers.CharField(required=False, allow_blank=True)


class AccountSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre = serializers.CharField()
    tipo = serializers.CharField()
    estado = serializers.CharField()
    saldo = serializers.DecimalField(max_digits=12, decimal_places=2)
    subtexto = serializers.CharField()
    badge = serializers.CharField(required=False, allow_blank=True)


class AlertSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    tipo = serializers.CharField()
    titulo = serializers.CharField()
    descripcion = serializers.CharField()
    nivel = serializers.CharField()
    tiempo = serializers.CharField()
    porcentaje = serializers.FloatField(required=False, allow_null=True)
    accion = serializers.CharField(required=False, allow_blank=True)


class ActionSerializer(serializers.Serializer):
    action = serializers.CharField(max_length=80)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    target_category = serializers.CharField(required=False, allow_blank=True)
    source_category = serializers.CharField(required=False, allow_blank=True)
