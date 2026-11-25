from django.http import JsonResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .csv_export import movements_csv
from .exceptions import FinanceError
from .finance import (
    accounts_payload,
    alerts_payload,
    available_periods,
    budgets_payload,
    category_catalog,
    dashboard_payload,
    filtered_movements,
    serialize_account,
    serialize_alert,
    serialize_budgets,
    serialize_transaction,
    spent_for,
    taxable_income,
    transactions_payload,
)
from .models import FinanceAccount, FinanceAlert, FinanceBudget, FinanceTransaction
from .periods import local_today, period_label
from .renderers import CSVRenderer
from .serializers import (
    AccountBalanceSerializer,
    AccountCreateSerializer,
    AccountSerializer,
    ActionSerializer,
    BudgetAdjustSerializer,
    BudgetCopySerializer,
    BudgetCreateSerializer,
    BudgetRebalanceSerializer,
    BudgetSerializer,
    DepositSerializer,
    IncomeTaxQuerySerializer,
    PeriodQuerySerializer,
    TransactionCreateSerializer,
    TransactionFilterSerializer,
    TransactionListQuerySerializer,
    TransactionUpdateSerializer,
    TransferSerializer,
)
from .taxes import income_tax, uit_for_year


def health(request):
    return JsonResponse({"status": "ok", "service": "proyecto-lenguaje-api"})


def success(message, data=None, status_code=status.HTTP_200_OK, **extra):
    return Response({"success": True, "message": message, "data": data, **extra}, status=status_code)


def copied_message(count, source_month):
    copied = "Se copió 1 presupuesto" if count == 1 else f"Se copiaron {count} presupuestos"
    return f"{copied} de {period_label(source_month)}."


def budget_item(budget):
    return serialize_budgets([budget], budget.owner_id, budget.month, local_today())[0]


class FinanceAPIView(APIView):
    """Base de la API de finanzas: exige sesión y responde 400 a los errores de negocio."""

    permission_classes = [IsAuthenticated]

    def handle_exception(self, exc):
        if isinstance(exc, FinanceError):
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return super().handle_exception(exc)

    def validated(self, serializer_class, data, **kwargs):
        serializer = serializer_class(data=data, context={"request": self.request}, **kwargs)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    def owned(self, records, pk, message):
        """Registro ``pk`` del usuario de la sesión dentro de ``records``; si no existe, 404 con ``message``."""
        record = records.filter(owner=self.request.user, pk=pk).first()
        if record is None:
            raise NotFound(message)
        return record


class DashboardResumenView(FinanceAPIView):
    def get(self, request):
        month = self.validated(PeriodQuerySerializer, request.query_params)["mes"]
        return Response(dashboard_payload(request.user, month, local_today()))


class TransactionListView(FinanceAPIView):
    def get(self, request):
        filters = self.validated(TransactionListQuerySerializer, request.query_params)
        return Response(transactions_payload(request.user, filters, local_today()))

    def post(self, request):
        values = self.validated(TransactionCreateSerializer, request.data)
        account = values["account"]
        register = account.deposit if values["type"] == FinanceTransaction.Type.INCOME else account.withdraw
        movement = register(
            values["amount"],
            name=values["name"],
            category=values["category"],
            kind=FinanceTransaction.Kind.REGULAR,
            occurred_at=values.get("occurred_at"),
        )
        return success("Transacción registrada.", serialize_transaction(movement), status.HTTP_201_CREATED)


class TransactionDetailView(FinanceAPIView):
    def patch(self, request, pk):
        movement = self.owned(FinanceTransaction.objects, pk, "Movimiento no encontrado.")
        values = dict(self.validated(TransactionUpdateSerializer, request.data))
        movement.edit(account=values.pop("account", None), **values)
        return success("Movimiento actualizado.", serialize_transaction(movement))

    def delete(self, request, pk):
        self.owned(FinanceTransaction.objects, pk, "Movimiento no encontrado.").cancel()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TransferView(FinanceAPIView):
    def post(self, request):
        values = self.validated(TransferSerializer, request.data)
        legs = values["source"].transfer_to(
            values["destination"], values["amount"], description=values["description"], occurred_at=values.get("occurred_at")
        )
        movements = [serialize_transaction(leg) for leg in legs]
        return success("Transferencia realizada.", movements[0], status.HTTP_201_CREATED, movimientos=movements)


class DepositView(FinanceAPIView):
    def post(self, request):
        values = self.validated(DepositSerializer, request.data)
        movement = values["account"].deposit(
            values["amount"], name=values["description"] or "Depósito", occurred_at=values.get("occurred_at")
        )
        return success("Depósito realizado.", serialize_transaction(movement), status.HTTP_201_CREATED)


class TransactionExportView(FinanceAPIView):
    renderer_classes = [CSVRenderer]

    def get(self, request):
        filters = self.validated(TransactionFilterSerializer, request.query_params)
        filename = f"finova-transacciones-{filters['mes']}.csv"
        return Response(
            movements_csv(filtered_movements(request.user, filters)),
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )


class BudgetListView(FinanceAPIView):
    def get(self, request):
        month = self.validated(PeriodQuerySerializer, request.query_params)["mes"]
        return Response(budgets_payload(request.user, month, local_today()))

    def post(self, request):
        values = self.validated(BudgetCreateSerializer, request.data)
        budget = FinanceBudget.objects.create(owner=request.user, **values)
        return success("Presupuesto creado.", budget_item(budget), status.HTTP_201_CREATED)


class BudgetDetailView(FinanceAPIView):
    update_serializer = BudgetSerializer

    def patch(self, request, pk):
        budget = self.owned(FinanceBudget.objects, pk, "Presupuesto no encontrado.")
        values = self.validated(self.update_serializer, request.data, instance=budget, partial=True)
        for field, value in values.items():
            setattr(budget, field, value)
        budget.save()
        return success("Presupuesto actualizado.", budget_item(budget))

    def delete(self, request, pk):
        self.owned(FinanceBudget.objects, pk, "Presupuesto no encontrado.").delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BudgetAdjustView(BudgetDetailView):
    """Ruta antigua ``/ajustar/``: el PATCH solo cambia el límite."""

    update_serializer = BudgetAdjustSerializer


class BudgetCopyView(FinanceAPIView):
    def post(self, request):
        values = self.validated(BudgetCopySerializer, request.data)
        created, skipped = FinanceBudget.copy_month(request.user, values["source_month"], values["month"])
        return success(
            copied_message(len(created), values["source_month"]),
            serialize_budgets(created, request.user, values["month"], local_today()),
            copiados=len(created),
            omitidos=skipped,
        )


class RebalanceBudgetView(FinanceAPIView):
    def post(self, request):
        values = self.validated(BudgetRebalanceSerializer, request.data)
        source, target, amount = values["source"], values["target"], values["amount"]
        source.move_limit_to(target, amount, spent=spent_for(source))
        return success(
            "Presupuesto rebalanceado.",
            serialize_budgets([source, target], request.user, values["month"], local_today()),
            transfer={"monto": amount, "origen": source.category, "destino": target.category},
        )


class AccountListView(FinanceAPIView):
    def get(self, request):
        return Response(accounts_payload(request.user))

    def post(self, request):
        values = self.validated(AccountCreateSerializer, request.data)
        account = FinanceAccount.open(
            request.user,
            name=values["name"],
            account_type=values["account_type"],
            description=values["description"],
            icon=values["icon"],
            opening_balance=values["balance"],
        )
        return success("Cuenta creada.", serialize_account(account), status.HTTP_201_CREATED)


def active_accounts():
    return FinanceAccount.objects.active()


class AccountDetailView(FinanceAPIView):
    def patch(self, request, pk):
        account = self.owned(active_accounts(), pk, "Cuenta no encontrada.")
        values = self.validated(AccountSerializer, request.data, instance=account, partial=True)
        for field, value in values.items():
            setattr(account, field, value)
        account.save()
        return success("Cuenta actualizada.", serialize_account(account))

    def delete(self, request, pk):
        archived = self.owned(active_accounts(), pk, "Cuenta no encontrada.").close()
        message = "La cuenta tenía movimientos, así que se archivó." if archived else "Cuenta eliminada."
        return success(message, accion="archivada" if archived else "eliminada")


class AccountBalanceUpdateView(FinanceAPIView):
    def patch(self, request, pk):
        account = self.owned(active_accounts(), pk, "Cuenta no encontrada.")
        values = self.validated(AccountBalanceSerializer, request.data)
        movement = account.adjust_balance(values["balance"])
        return success(
            "Saldo actualizado.",
            serialize_account(account),
            movimiento=serialize_transaction(movement) if movement else None,
        )


class PeriodListView(FinanceAPIView):
    def get(self, request):
        return Response(available_periods(request.user, local_today()))


class CategoryListView(FinanceAPIView):
    def get(self, request):
        return Response(category_catalog(request.user))


class AlertListView(FinanceAPIView):
    def get(self, request):
        return Response(alerts_payload(request.user, request.query_params.get("tipo")))


class AlertActionView(FinanceAPIView):
    def post(self, request, pk):
        values = self.validated(ActionSerializer, request.data)
        alert = self.owned(FinanceAlert.objects, pk, "Alerta no encontrada.")
        action = values["action"]
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
        return success("Acción aplicada.", serialize_alert(alert))


class SilenceAlertsView(FinanceAPIView):
    def post(self, request):
        FinanceAlert.objects.filter(owner=request.user, dismissed=False).update(dismissed=True, is_read=True)
        return Response({"success": True, "message": "Todas las alertas fueron silenciadas."})


class IncomeTaxView(FinanceAPIView):
    """Estimación del Impuesto a la Renta anual de quinta categoría.

    Usa ``ingreso_anual`` si se envía; si no, suma los ingresos REGULAR del año
    (sin depósitos, transferencias, ajustes ni saldos iniciales).
    """

    def get(self, request):
        values = self.validated(IncomeTaxQuerySerializer, request.query_params)
        year = values.get("anio", local_today().year)
        try:
            uit = uit_for_year(year)
        except ValueError as error:
            return Response({"anio": [str(error)]}, status=status.HTTP_400_BAD_REQUEST)

        if "ingreso_anual" in values:
            gross, source = values["ingreso_anual"], "manual"
        else:
            gross, source = taxable_income(request.user, year), "movimientos"

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
