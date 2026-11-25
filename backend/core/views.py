import csv
from decimal import Decimal
import re

from django.conf import settings
from django.db import transaction as db_transaction
from django.db.models import Sum
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import analytics
from .finance import (
    empty_dashboard_payload,
    finance_totals,
    initialize_finance_profile,
    serialize_account,
    serialize_alert,
    serialize_budget,
    serialize_transaction,
)
from .models import FinanceAccount, FinanceAlert, FinanceBudget, FinanceTransaction
from .serializers import (
    AccountBalanceSerializer,
    AccountCreateSerializer,
    AccountSerializer,
    ActionSerializer,
    AlertSerializer,
    BudgetAdjustSerializer,
    BudgetCreateSerializer,
    BudgetRebalanceSerializer,
    BudgetSerializer,
    DepositSerializer,
    DashboardSummarySerializer,
    IncomeTaxQuerySerializer,
    TransactionCreateSerializer,
    TransactionFilterSerializer,
    TransferSerializer,
)
from .taxes import income_tax, uit_for_year
from .transaction_filters import filter_transactions, total_amount


def health(request):
    return JsonResponse({"status": "ok", "service": "proyecto-lenguaje-api"})


def build_dashboard_payload():
    return {
        "balance_total": 8450.0,
        "balance_variacion": "+12.4% vs mes anterior",
        "ingresos_mensuales": 5800.0,
        "ingresos_variacion": "+8.2%",
        "gastos_mensuales": 3250.0,
        "gastos_variacion": "-4.1%",
        "presupuesto_porcentaje": 81.25,
        "presupuesto_limite": 4000.0,
        "presupuesto_consumido": 3250.0,
        "presupuesto_restante": 750.0,
        "evolucion_saldo": [
            {"name": "Dic", "value": 5100},
            {"name": "Ene", "value": 5600},
            {"name": "Feb", "value": 6100},
            {"name": "Mar", "value": 7200},
            {"name": "Abr", "value": 7800},
            {"name": "May", "value": 8450},
        ],
        "evolucion_periodo": "Dic 23 - May 24",
        "evolucion_tendencia": "+65.7%",
        "distribucion_gastos": [
            {"name": "Alimentación", "value": 35, "color": "#ef4444"},
            {"name": "Vivienda", "value": 25, "color": "#10b981"},
            {"name": "Transporte", "value": 15, "color": "#f59e0b"},
            {"name": "Servicios", "value": 13, "color": "#60a5fa"},
            {"name": "Entretenimiento", "value": 12, "color": "#4f46e5"},
        ],
        "alertas_activas": [
            {
                "id": 1,
                "tipo": "warning",
                "titulo": "Desvío de Presupuesto Mensual",
                "tiempo": "Hace 15 min",
                "descripcion": "Has consumido el 81.25% de tu presupuesto mensual previsto (S/ 3,250.00 de S/ 4,000.00) a falta de 7 días de cierre.",
                "accion": "Ajustar Presupuesto",
            },
            {
                "id": 2,
                "tipo": "danger",
                "titulo": "Sobrecosto en Alimentación",
                "tiempo": "Hoy 09:30",
                "descripcion": "La categoría Alimentación representa el 35% del egreso total del mes (S/ 1,137.50). Supera la cuota sugerida del 25%.",
                "accion": "Ver desglose detallado",
            },
            {
                "id": 3,
                "tipo": "info",
                "titulo": "Límite Próximo: Transporte",
                "tiempo": "Ayer",
                "descripcion": "Tu categoría de Transporte ha alcanzado el 88% de su techo mensual asignado (S/ 487.50 / S/ 550.00).",
                "accion": "Ver detalle",
            },
        ],
        "ultimas_transacciones": [
            {
                "id": 1,
                "nombre": "Supermercados Metro",
                "categoria": "Alimentación",
                "fecha": "24 May",
                "cuenta": "BCP Débito",
                "monto": -185.50,
                "tipo": "GASTO",
                "estado": "Completado",
            },
            {
                "id": 2,
                "nombre": "Pago de Nómina Tech Corp",
                "categoria": "Salario",
                "fecha": "23 May",
                "cuenta": "BBVA Cuenta Sueldo",
                "monto": 5800.00,
                "tipo": "INGRESO",
                "estado": "Acreditado",
            },
            {
                "id": 3,
                "nombre": "Suscripción Netflix & Spotify",
                "categoria": "Entretenimiento",
                "fecha": "22 May",
                "cuenta": "Tarjeta Crédito Interbank",
                "monto": -64.90,
                "tipo": "GASTO",
                "estado": "Automático",
            },
            {
                "id": 4,
                "nombre": "Gasolina Primax",
                "categoria": "Transporte",
                "fecha": "20 May",
                "cuenta": "Yape / BCP",
                "monto": -120.00,
                "tipo": "GASTO",
                "estado": "Completado",
            },
        ],
    }


def build_transactions_payload():
    return {
        "total_ingresos": 5800.0,
        "total_gastos": 3250.0,
        "neto": 2550.0,
        "grupos": [
            {
                "titulo": "HOY, 24 DE MAYO",
                "total": -114.50,
                "items": [
                    {
                        "id": 1,
                        "nombre": "Supermercados Wong",
                        "subtexto": "BCP Débito",
                        "categoria": "Alimentación",
                        "monto": -84.50,
                        "hora": "14:32",
                        "tipo": "GASTO",
                        "icon": "shopping",
                    },
                    {
                        "id": 2,
                        "nombre": "Uber Ride",
                        "subtexto": "Tarjeta Interbank",
                        "categoria": "Transporte",
                        "monto": -30.00,
                        "hora": "10:15",
                        "tipo": "GASTO",
                        "icon": "car",
                    },
                ],
            },
            {
                "titulo": "AYER, 23 DE MAYO",
                "total": 1465.0,
                "items": [
                    {
                        "id": 3,
                        "nombre": "Consultoría UX - Pago",
                        "subtexto": "BCP Débito",
                        "categoria": "Honorarios",
                        "monto": 1500.0,
                        "hora": "16:40",
                        "tipo": "INGRESO",
                        "icon": "briefcase",
                    },
                    {
                        "id": 4,
                        "nombre": "Cafetería Tostado",
                        "subtexto": "Yape Móvil",
                        "categoria": "Alimentación",
                        "monto": -35.0,
                        "hora": "08:20",
                        "tipo": "GASTO",
                        "icon": "coffee",
                    },
                ],
            },
            {
                "titulo": "21 DE MAYO",
                "total": -480.0,
                "items": [
                    {
                        "id": 5,
                        "nombre": "Luz del Sur",
                        "subtexto": "Interbank Visa",
                        "categoria": "Vivienda",
                        "monto": -180.0,
                        "hora": "May 21",
                        "tipo": "GASTO",
                        "icon": "home",
                    },
                    {
                        "id": 6,
                        "nombre": "Inkafarma San Borja",
                        "subtexto": "Efectivo Billetera",
                        "categoria": "Salud",
                        "monto": -65.0,
                        "hora": "May 21",
                        "tipo": "GASTO",
                        "icon": "health",
                    },
                ],
            },
        ],
    }


def build_budgets_payload():
    return {
        "summary": {
            "total_consumido": 3250.0,
            "total_asignado": 4000.0,
            "porcentaje": 81.25,
            "restante": 750.0,
            "dias_restantes": 7,
        },
        "ia_alert": {
            "titulo": "Alerta de Ritmo de Gasto",
            "resumen": "A este ritmo, tu categoría de Alimentación excederá el límite asignado en aproximadamente 3 días (+S/ 185.00 proyectados).",
            "sugerencia": "Rebalancear Presupuesto",
        },
        "filtros": ["Todos 6", "Normal 3", "Precaución 2", "Crítico 1"],
        "categorias": [
            {
                "id": 1,
                "nombre": "Alimentación",
                "descripcion": "Supermercados, delivery y restaurantes",
                "presupuesto": 1200.0,
                "gastado": 1137.5,
                "restante": 62.5,
                "porcentaje": 94.8,
                "estado": "Crítico",
                "badge": "Crítico: Cerca del límite",
                "proyeccion": 1385.0,
                "detalle": "Proyección a fin de mes: S/ 1,385.00",
                "color": "red",
                "icon": "shopping",
            },
            {
                "id": 2,
                "nombre": "Transporte",
                "descripcion": "Combustible, peajes y apps de taxi",
                "presupuesto": 500.0,
                "gastado": 440.0,
                "restante": 60.0,
                "porcentaje": 88.0,
                "estado": "Precaución",
                "badge": "Precaución",
                "proyeccion": 515.0,
                "detalle": "Proyección estimada: S/ 515.00",
                "color": "amber",
                "icon": "car",
            },
            {
                "id": 3,
                "nombre": "Vivienda & Servicios",
                "descripcion": "Alquiler, luz, agua, internet y mantenimiento",
                "presupuesto": 1400.0,
                "gastado": 950.0,
                "restante": 450.0,
                "porcentaje": 67.8,
                "estado": "Normal",
                "badge": "En control",
                "proyeccion": 950.0,
                "detalle": "Meta mensual dentro de rango planeado",
                "color": "green",
                "icon": "home",
            },
            {
                "id": 4,
                "nombre": "Entretenimiento & Ocio",
                "descripcion": "Cine, streaming y salidas de fin de semana",
                "presupuesto": 500.0,
                "gastado": 390.0,
                "restante": 110.0,
                "porcentaje": 78.0,
                "estado": "Precaución",
                "badge": "Precaución",
                "proyeccion": 390.0,
                "detalle": "Quedan S/ 15.70 diarios asignables",
                "color": "amber",
                "icon": "gamepad",
            },
            {
                "id": 5,
                "nombre": "Salud & Cuidado",
                "descripcion": "Farmacia, consultas médicas y bienestar",
                "presupuesto": 400.0,
                "gastado": 180.0,
                "restante": 220.0,
                "porcentaje": 45.0,
                "estado": "Normal",
                "badge": "En control",
                "proyeccion": 180.0,
                "detalle": "Excelente balance a fin de mes",
                "color": "green",
                "icon": "health",
            },
        ],
    }


def build_accounts_payload():
    return {
        "patrimonio": 8450.00,
        "liquidez": 7750.00,
        "efectivo": 700.00,
        "cuentas": [
            {"id": 1, "nombre": "BCP Débito Soles", "tipo": "Cuenta Corriente", "estado": "Activa", "saldo": 4280.0, "descripcion": "**** 4812", "badge": "Activa", "icon": "credit"},
            {"id": 2, "nombre": "BBVA Ahorros Sueldo", "tipo": "Ahorros Automáticos", "estado": "Activa", "saldo": 2850.0, "descripcion": "**** 9104", "badge": "Activa", "icon": "piggy"},
            {"id": 3, "nombre": "Billetera Digital Yape / Plin", "tipo": "Vinculada a teléfono", "estado": "Instantánea", "saldo": 620.0, "descripcion": "987 - *** - 123", "badge": "Instantánea", "icon": "phone"},
            {"id": 4, "nombre": "Efectivo Disponible en Bóveda", "tipo": "Fondo manual de emergencia", "estado": "Físico", "saldo": 700.0, "descripcion": "Fondo manual de emergencia", "badge": "Físico", "icon": "cash"},
        ],
    }


def build_alerts_payload():
    return {
        "filters": ["Todas (5)", "Presupuesto (2)", "Gastos Inusuales (1)", "Vencimientos (1)", "Metas (1)"],
        "items": [
            {
                "id": 1,
                "tipo": "Presupuesto",
                "titulo": "Límite de presupuesto excedido en Alimentación",
                "descripcion": "Consumo al 94.8% del tope asignado. Solo restan S/ 62.50 para los próximos 8 días.",
                "nivel": "rojo",
                "tiempo": "Hace 2h",
                "porcentaje": 94.8,
                "badge": "PRESUPUESTO CRÍTICO",
            },
            {
                "id": 2,
                "tipo": "Gastos Inusuales",
                "titulo": "Consumo atípico detectado",
                "descripcion": "Pago de S/ 380.00 en Tiendas Ripley supera tu promedio histórico semanal en compras de comercio minorista.",
                "nivel": "amber",
                "tiempo": "Ayer",
                "badge": "GASTO INUSUAL",
            },
            {
                "id": 3,
                "tipo": "Vencimientos",
                "titulo": "Vencimiento Tarjeta Interbank",
                "descripcion": "Pago mínimo sugerido de S/ 480.00 para evitar penalidades e intereses moratorios.",
                "nivel": "indigo",
                "tiempo": "En 3 días",
                "badge": "VENCIMIENTO",
            },
            {
                "id": 4,
                "tipo": "Metas",
                "titulo": "Ahorro mensual alcanzó nuevo récord",
                "descripcion": "Has logrado consolidar +S/ 1,200.00 ahorrados en este ciclo, superando tu objetivo por un 20%.",
                "nivel": "green",
                "tiempo": "Hoy",
                "badge": "META SUPERADA",
            },
        ],
    }


class FinanceAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def prepare_user_data(self, user):
        return initialize_finance_profile(user)


class DashboardResumenView(FinanceAPIView):
    def get(self, request):
        use_sample_data = self.prepare_user_data(request.user)
        month = request.query_params.get("mes", "2024-05")
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
            return Response({"mes": ["El período debe tener formato AAAA-MM."]}, status=status.HTTP_400_BAD_REQUEST)
        data = build_dashboard_payload() if use_sample_data else empty_dashboard_payload()
        accounts = FinanceAccount.objects.filter(owner=request.user)
        budgets = FinanceBudget.objects.filter(owner=request.user, month=month)
        balance = accounts.aggregate(total=Sum("balance"))["total"] or Decimal("0.00")
        total_limit = budgets.aggregate(total=Sum("limit_amount"))["total"] or Decimal("0.00")
        total_spent = budgets.aggregate(total=Sum("spent_amount"))["total"] or Decimal("0.00")
        added_income, added_expenses = finance_totals(request.user, month)
        data["balance_total"] = balance
        base_income = Decimal("5800.00") if use_sample_data and month == "2024-05" else Decimal("0.00")
        base_expenses = Decimal("3250.00") if use_sample_data and month == "2024-05" else Decimal("0.00")
        data["ingresos_mensuales"] = base_income + added_income
        data["gastos_mensuales"] = base_expenses + added_expenses
        data["presupuesto_limite"] = total_limit
        data["presupuesto_consumido"] = total_spent
        data["presupuesto_restante"] = total_limit - total_spent
        data["presupuesto_porcentaje"] = float(total_spent / total_limit * 100) if total_limit else 0
        if not use_sample_data:
            records = FinanceTransaction.objects.filter(owner=request.user).values(*analytics.FIELDS)
            data.update(analytics.dashboard_charts(records, month, balance, settings.TIME_ZONE))
        alert_type ={"rojo": "danger", "amber": "warning", "indigo": "info", "green": "info"}
        data["alertas_activas"] = [
            {
                "id": alert.id,
                "tipo": alert_type.get(alert.level, "info"),
                "titulo": alert.title,
                "tiempo": "Leída" if alert.is_read else "Activa",
                "descripcion": alert.description,
                "accion": alert.action_label,
            }
            for alert in FinanceAlert.objects.filter(owner=request.user, dismissed=False)
        ]
        recent = [serialize_transaction(item) for item in FinanceTransaction.objects.filter(owner=request.user, occurred_at__year=int(month[:4]), occurred_at__month=int(month[5:7])).order_by("-occurred_at", "-id")[:4]]
        if recent:
            data["ultimas_transacciones"] = (recent + data["ultimas_transacciones"])[:4]
        serializer = DashboardSummarySerializer(data=data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class TransactionListView(FinanceAPIView):
    def get(self, request):
        use_sample_data = self.prepare_user_data(request.user)
        filters = TransactionFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        params = filters.validated_data
        month = params.get("mes", "2024-05")
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
            return Response({"mes": ["El período debe tener formato AAAA-MM."]}, status=status.HTTP_400_BAD_REQUEST)
        data = build_transactions_payload() if use_sample_data else {
            "total_ingresos": Decimal("0.00"),
            "total_gastos": Decimal("0.00"),
            "neto": Decimal("0.00"),
            "grupos": [],
        }
        if not use_sample_data or month != "2024-05":
            data["grupos"] = []
        search = params.get("search", "")
        transaction_type = params.get("tipo", "")
        category = params.get("categoria", "")
        selected_account = None
        if params.get("cuenta_id"):
            selected_account = get_object_or_404(FinanceAccount, pk=params["cuenta_id"], owner=request.user)

        sample_account_filter = []
        if selected_account:
            account_name = selected_account.name.casefold()
            sample_account_filter.append(lambda item: account_name in item["subtexto"].casefold())
        for group in data["grupos"]:
            group["items"] = filter_transactions(group["items"], search, transaction_type, category, extra=sample_account_filter)
            group["total"] = total_amount(group["items"])
        data["grupos"] = [group for group in data["grupos"] if group["items"]]

        added = FinanceTransaction.objects.filter(owner=request.user, occurred_at__year=int(month[:4]), occurred_at__month=int(month[5:7]))
        if selected_account:
            added = added.filter(account=selected_account)
        new_items = filter_transactions(map(serialize_transaction, added.select_related("account")), search, transaction_type, category)
        if new_items:
            data["grupos"].insert(0, {"titulo": "NUEVOS MOVIMIENTOS", "total": total_amount(new_items), "items": new_items})
        added_income, added_expenses = finance_totals(request.user, month)
        base_income = Decimal("5800.00") if use_sample_data and month == "2024-05" else Decimal("0.00")
        base_expenses = Decimal("3250.00") if use_sample_data and month == "2024-05" else Decimal("0.00")
        data["total_ingresos"] = base_income + added_income
        data["total_gastos"] = base_expenses + added_expenses
        data["neto"] = data["total_ingresos"] - data["total_gastos"]
        return Response(data)

    def post(self, request):
        self.prepare_user_data(request.user)
        serializer = TransactionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        account = get_object_or_404(FinanceAccount, pk=values["account_id"], owner=request.user)
        amount = values["amount"]
        is_expense = values["type"] == FinanceTransaction.Type.EXPENSE
        if is_expense and account.balance < amount:
            return Response({"detail": "La cuenta no tiene saldo suficiente."}, status=status.HTTP_400_BAD_REQUEST)

        with db_transaction.atomic():
            account.balance += -amount if is_expense else amount
            account.save(update_fields=["balance", "updated_at"])
            movement = FinanceTransaction.objects.create(
                owner=request.user,
                account=account,
                name=values["name"],
                category=values["category"],
                transaction_type=values["type"],
                amount=amount,
                status="Completado" if is_expense else "Acreditado",
                occurred_at=values.get("occurred_at", timezone.now()),
            )
            if is_expense:
                budget = FinanceBudget.objects.filter(owner=request.user, category__iexact=values["category"], month=values.get("occurred_at", timezone.now()).strftime("%Y-%m")).first()
                if budget:
                    budget.spent_amount += amount
                    budget.save(update_fields=["spent_amount", "updated_at"])
        return Response({"success": True, "message": "Transacción registrada.", "data": serialize_transaction(movement)}, status=status.HTTP_201_CREATED)


class TransactionDetailView(FinanceAPIView):
    def delete(self, request, pk):
        self.prepare_user_data(request.user)
        movement_id = pk - 1000000
        movement = get_object_or_404(FinanceTransaction, pk=movement_id, owner=request.user)
        with db_transaction.atomic():
            if movement.account_id:
                if movement.transaction_type == FinanceTransaction.Type.INCOME:
                    if movement.account.balance < movement.amount:
                        return Response({"detail": "No se puede anular: el saldo de la cuenta ya fue utilizado."}, status=status.HTTP_400_BAD_REQUEST)
                    movement.account.balance -= movement.amount
                else:
                    movement.account.balance += movement.amount
                movement.account.save(update_fields=["balance", "updated_at"])
            if movement.transaction_type == FinanceTransaction.Type.EXPENSE:
                budget = FinanceBudget.objects.filter(owner=request.user, category__iexact=movement.category).first()
                if budget:
                    budget.spent_amount = max(Decimal("0.00"), budget.spent_amount - movement.amount)
                    budget.save(update_fields=["spent_amount", "updated_at"])
            movement.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TransferView(FinanceAPIView):
    def post(self, request):
        self.prepare_user_data(request.user)
        serializer = TransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        source = get_object_or_404(FinanceAccount, pk=values["source_account_id"], owner=request.user)
        destination = get_object_or_404(FinanceAccount, pk=values["destination_account_id"], owner=request.user)
        amount = values["amount"]
        if source.pk == destination.pk:
            return Response({"detail": "Selecciona dos cuentas distintas."}, status=status.HTTP_400_BAD_REQUEST)
        if source.balance < amount:
            return Response({"detail": "La cuenta de origen no tiene saldo suficiente."}, status=status.HTTP_400_BAD_REQUEST)
        with db_transaction.atomic():
            source.balance -= amount
            destination.balance += amount
            source.save(update_fields=["balance", "updated_at"])
            destination.save(update_fields=["balance", "updated_at"])
            description = values.get("description") or "Transferencia entre cuentas"
            common = {"owner": request.user, "category": "Transferencia", "name": description, "amount": amount, "count_in_summary": False}
            debit = FinanceTransaction.objects.create(account=source, transaction_type=FinanceTransaction.Type.EXPENSE, status="Completado", **common)
            FinanceTransaction.objects.create(account=destination, transaction_type=FinanceTransaction.Type.INCOME, status="Acreditado", **common)
        return Response({"success": True, "message": "Transferencia realizada.", "data": serialize_transaction(debit)}, status=status.HTTP_201_CREATED)


class DepositView(FinanceAPIView):
    def post(self, request):
        self.prepare_user_data(request.user)
        serializer = DepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        account = get_object_or_404(FinanceAccount, pk=values["account_id"], owner=request.user)
        with db_transaction.atomic():
            account.balance += values["amount"]
            account.save(update_fields=["balance", "updated_at"])
            movement = FinanceTransaction.objects.create(
                owner=request.user,
                account=account,
                name=values.get("description") or "Depósito",
                category="Depósito",
                transaction_type=FinanceTransaction.Type.INCOME,
                amount=values["amount"],
                status="Acreditado",
            )
        return Response({"success": True, "message": "Depósito realizado.", "data": serialize_transaction(movement)}, status=status.HTTP_201_CREATED)


class BudgetListView(FinanceAPIView):
    def get(self, request):
        self.prepare_user_data(request.user)
        month = request.query_params.get("mes", "2024-05")
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
            return Response({"mes": ["El período debe tener formato AAAA-MM."]}, status=status.HTTP_400_BAD_REQUEST)
        budgets = list(FinanceBudget.objects.filter(owner=request.user, month=month))
        categories = [serialize_budget(item) for item in budgets]
        total_spent = sum((item.spent_amount for item in budgets), Decimal("0.00"))
        total_limit = sum((item.limit_amount for item in budgets), Decimal("0.00"))
        percentage = float(total_spent / total_limit * 100) if total_limit else 0
        return Response({
            "summary": {"total_consumido": total_spent, "total_asignado": total_limit, "porcentaje": percentage, "restante": total_limit - total_spent, "dias_restantes": 7},
            "ia_alert": build_budgets_payload()["ia_alert"] if categories else {
                "titulo": "Empieza con un presupuesto",
                "resumen": "Todavía no tienes presupuestos para este período.",
                "sugerencia": "Crear presupuesto",
            },
            "filtros": [f"Todos {len(categories)}", f"Normal {sum(1 for item in categories if item['color'] == 'green')}", f"Precaución {sum(1 for item in categories if item['color'] == 'amber')}", f"Crítico {sum(1 for item in categories if item['color'] == 'red')}"],
            "categorias": categories,
        })

    def post(self, request):
        self.prepare_user_data(request.user)
        serializer = BudgetCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        if FinanceBudget.objects.filter(owner=request.user, category__iexact=values["category"], month=values["month"]).exists():
            return Response({"category": ["Ya existe un presupuesto para esta categoría."]}, status=status.HTTP_400_BAD_REQUEST)
        budget = FinanceBudget.objects.create(owner=request.user, **values)
        return Response({"success": True, "message": "Presupuesto creado.", "data": serialize_budget(budget)}, status=status.HTTP_201_CREATED)


class BudgetAdjustView(FinanceAPIView):
    def patch(self, request, pk):
        self.prepare_user_data(request.user)
        budget = get_object_or_404(FinanceBudget, pk=pk, owner=request.user)
        serializer = BudgetAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        budget.limit_amount = serializer.validated_data["limit_amount"]
        budget.save(update_fields=["limit_amount", "updated_at"])
        return Response({"success": True, "message": "Presupuesto actualizado.", "data": serialize_budget(budget)})

    def delete(self, request, pk):
        self.prepare_user_data(request.user)
        budget = get_object_or_404(FinanceBudget, pk=pk, owner=request.user)
        budget.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RebalanceBudgetView(FinanceAPIView):
    def post(self, request):
        self.prepare_user_data(request.user)
        serializer = BudgetRebalanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        source = get_object_or_404(FinanceBudget, owner=request.user, category__iexact=values["source_category"], month=values["month"])
        target = get_object_or_404(FinanceBudget, owner=request.user, category__iexact=values["target_category"], month=values["month"])
        amount = values["amount"]
        if source.pk == target.pk or source.limit_amount - source.spent_amount < amount:
            return Response({"detail": "No hay saldo disponible suficiente para rebalancear."}, status=status.HTTP_400_BAD_REQUEST)
        with db_transaction.atomic():
            source.limit_amount -= amount
            target.limit_amount += amount
            source.save(update_fields=["limit_amount", "updated_at"])
            target.save(update_fields=["limit_amount", "updated_at"])
        return Response({"success": True, "message": "Presupuesto rebalanceado.", "transfer": {"monto": amount, "origen": source.category, "destino": target.category}})


class AccountListView(FinanceAPIView):
    def get(self, request):
        self.prepare_user_data(request.user)
        account_records = FinanceAccount.objects.filter(owner=request.user)
        accounts = [serialize_account(item) for item in account_records]
        balance = sum((item.balance for item in account_records), Decimal("0.00"))
        liquidity = sum((item.balance for item in account_records if item.icon != "cash"), Decimal("0.00"))
        cash = sum((item.balance for item in account_records if item.icon == "cash"), Decimal("0.00"))
        return Response({"patrimonio": balance, "liquidez": liquidity, "efectivo": cash, "cuentas": accounts, "accounts": accounts})

    def post(self, request):
        self.prepare_user_data(request.user)
        serializer = AccountCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        if FinanceAccount.objects.filter(owner=request.user, name__iexact=values["name"]).exists():
            return Response({"name": ["Ya existe una cuenta con ese nombre."]}, status=status.HTTP_400_BAD_REQUEST)
        account = FinanceAccount.objects.create(owner=request.user, status="Activa", badge="Activa", **values)
        return Response({"success": True, "message": "Cuenta creada.", "data": serialize_account(account)}, status=status.HTTP_201_CREATED)


class AccountBalanceUpdateView(FinanceAPIView):
    def patch(self, request, pk):
        self.prepare_user_data(request.user)
        account = get_object_or_404(FinanceAccount, pk=pk, owner=request.user)
        serializer = AccountBalanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account.balance = serializer.validated_data["balance"]
        account.save(update_fields=["balance", "updated_at"])
        return Response({"success": True, "message": "Saldo actualizado.", "data": serialize_account(account)})


class AlertListView(FinanceAPIView):
    def get(self, request):
        self.prepare_user_data(request.user)
        alerts = FinanceAlert.objects.filter(owner=request.user, dismissed=False)
        category = request.query_params.get("tipo")
        if category:
            alerts = alerts.filter(category=category)
        items = [serialize_alert(item) for item in alerts]
        categories = ["Presupuesto", "Gastos Inusuales", "Vencimientos", "Metas"]
        filters = [f"Todas ({FinanceAlert.objects.filter(owner=request.user, dismissed=False).count()})"]
        filters.extend(f"{category} ({FinanceAlert.objects.filter(owner=request.user, dismissed=False, category=category).count()})" for category in categories)
        return Response({"filters": filters, "items": items})


class AlertActionView(FinanceAPIView):
    def post(self, request, pk):
        self.prepare_user_data(request.user)
        serializer = ActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        alert = get_object_or_404(FinanceAlert, pk=pk, owner=request.user)
        action = serializer.validated_data["action"]
        if action in {"read", "mark_read", "confirm", "confirm_fraud", "pay", "reassign"}:
            alert.is_read = True
        elif action in {"dismiss", "discard"}:
            alert.dismissed = True
            alert.is_read = True
        elif action in {"snooze", "postpone"}:
            alert.snoozed_until = timezone.now() + timezone.timedelta(hours=24)
            alert.is_read = True
        else:
            return Response({"action": ["Acción de alerta no válida."]}, status=status.HTTP_400_BAD_REQUEST)
        alert.save(update_fields=["is_read", "dismissed", "snoozed_until"])
        return Response({"success": True, "message": "Acción aplicada.", "data": serialize_alert(alert)})


class SilenceAlertsView(FinanceAPIView):
    def post(self, request):
        self.prepare_user_data(request.user)
        FinanceAlert.objects.filter(owner=request.user, dismissed=False).update(dismissed=True, is_read=True)
        return Response({"success": True, "message": "Todas las alertas fueron silenciadas."})


class TransactionExportView(FinanceAPIView):
    def get(self, request):
        use_sample_data = self.prepare_user_data(request.user)
        rows = FinanceTransaction.objects.filter(owner=request.user).select_related("account")
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="finova-transacciones.csv"'
        response.write("\ufeff")
        writer = csv.writer(response)
        writer.writerow(["Fecha", "Descripción", "Categoría", "Tipo", "Cuenta", "Monto", "Estado"])
        if use_sample_data:
            for group in build_transactions_payload()["grupos"]:
                for item in group["items"]:
                    writer.writerow([item["hora"], item["nombre"], item["categoria"], item["tipo"], item["subtexto"], f"{item['monto']:.2f}", "Completado"])
        for item in rows:
            account_name = item.account.name if item.account else item.account_label
            amount = item.amount if item.transaction_type == FinanceTransaction.Type.INCOME else -item.amount
            writer.writerow([item.occurred_at.strftime("%Y-%m-%d %H:%M"), item.name, item.category, item.transaction_type, account_name, f"{amount:.2f}", item.status])
        return response


class IncomeTaxView(FinanceAPIView):
    """Estimación del Impuesto a la Renta anual de quinta categoría.

    Usa ``ingreso_anual`` si se envía; si no, suma los ingresos registrados en el año.
    """

    def get(self, request):
        self.prepare_user_data(request.user)
        query = IncomeTaxQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        values = query.validated_data
        year = values.get("anio", timezone.localdate().year)
        try:
            uit = uit_for_year(year)
        except ValueError as error:
            return Response({"anio": [str(error)]}, status=status.HTTP_400_BAD_REQUEST)

        if "ingreso_anual" in values:
            gross, source = values["ingreso_anual"], "manual"
        else:
            incomes = FinanceTransaction.objects.filter(
                owner=request.user,
                transaction_type=FinanceTransaction.Type.INCOME,
                status__in=analytics.SUMMARY_STATUSES,
                count_in_summary=True,
                occurred_at__year=year,
            )
            gross, source = incomes.aggregate(total=Sum("amount"))["total"] or Decimal("0.00"), "movimientos"

        result = income_tax(gross, uit, values["deducciones_adicionales"])
        return Response(
            {
                "anio": year,
                "uit": result.uit,
                "fuente": source,
                "ingreso_bruto": result.gross_income,
                "deducciones": result.deductions,
                "renta_neta": result.net_income,
                "impuesto": result.tax,
                "tasa_efectiva": result.effective_rate,
                "tramos": [
                    {"desde": item.lower, "hasta": item.upper, "tasa": item.rate * 100, "base": item.taxable, "impuesto": item.tax}
                    for item in result.brackets
                ],
                "nota": "Estimación de rentas de quinta categoría. No incluye retenciones, créditos ni otras rentas.",
            }
        )
