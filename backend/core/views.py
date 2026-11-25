import logging

from django.http import JsonResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .alert_service import alerts_payload, apply_alert_action, ensure_alerts, refresh_alerts, serialize_alert, snooze_all
from .alerts import hours_text
from .csv_export import movements_csv
from .exceptions import FinanceError
from .finance import (
    accounts_payload,
    available_periods,
    budgets_payload,
    category_catalog,
    dashboard_payload,
    filtered_movements,
    income_tax_payload,
    serialize_account,
    serialize_budgets,
    serialize_transaction,
    spent_for,
    transactions_payload,
)
from .models import FinanceAccount, FinanceAlert, FinanceBudget, FinanceTransaction
from .periods import local_today, period_label, period_of_moment
from .renderers import CSVRenderer
from .serializers import (
    AccountBalanceSerializer,
    AccountCreateSerializer,
    AccountSerializer,
    AlertActionSerializer,
    AlertListQuerySerializer,
    BudgetAdjustSerializer,
    BudgetCopySerializer,
    BudgetCreateSerializer,
    BudgetRebalanceSerializer,
    BudgetSerializer,
    DepositSerializer,
    IncomeTaxQuerySerializer,
    PeriodQuerySerializer,
    SnoozeAllSerializer,
    TransactionCreateSerializer,
    TransactionFilterSerializer,
    TransactionListQuerySerializer,
    TransactionUpdateSerializer,
    TransferSerializer,
)
from .taxes import uit_for_year

logger = logging.getLogger(__name__)


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

    def refresh_alerts(self, *changes):
        """Reevalúa las alertas de los meses que tocó una operación ya realizada.

        ``changes`` son movimientos o períodos 'AAAA-MM'. Si el motor de alertas
        falla, la operación (ya guardada) no responde error: solo se registra.
        """
        periods = {change if isinstance(change, str) else period_of_moment(change.occurred_at) for change in changes if change}
        try:
            refresh_alerts(self.request.user, periods)
        except Exception:
            logger.exception("No se pudieron actualizar las alertas de %s", sorted(periods))


class DashboardResumenView(FinanceAPIView):
    def get(self, request):
        month = self.validated(PeriodQuerySerializer, request.query_params)["mes"]
        ensure_alerts(request.user, month)
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
        self.refresh_alerts(movement)
        return success("Transacción registrada.", serialize_transaction(movement), status.HTTP_201_CREATED)


class TransactionDetailView(FinanceAPIView):
    def patch(self, request, pk):
        movement = self.owned(FinanceTransaction.objects, pk, "Movimiento no encontrado.")
        values = dict(self.validated(TransactionUpdateSerializer, request.data, instance=movement))
        previous_period = period_of_moment(movement.occurred_at)
        movement.edit(account=values.pop("account", None), **values)
        self.refresh_alerts(previous_period, movement)
        return success("Movimiento actualizado.", serialize_transaction(movement))

    def delete(self, request, pk):
        movement = self.owned(FinanceTransaction.objects, pk, "Movimiento no encontrado.")
        movement.cancel()
        self.refresh_alerts(movement)
        return Response(status=status.HTTP_204_NO_CONTENT)


class TransferView(FinanceAPIView):
    def post(self, request):
        values = self.validated(TransferSerializer, request.data)
        legs = values["source"].transfer_to(
            values["destination"], values["amount"], description=values["description"], occurred_at=values.get("occurred_at")
        )
        self.refresh_alerts(*legs)
        movements = [serialize_transaction(leg) for leg in legs]
        return success("Transferencia realizada.", movements[0], status.HTTP_201_CREATED, movimientos=movements)


class DepositView(FinanceAPIView):
    def post(self, request):
        values = self.validated(DepositSerializer, request.data)
        movement = values["account"].deposit(
            values["amount"], name=values["description"] or "Depósito", occurred_at=values.get("occurred_at")
        )
        self.refresh_alerts(movement)
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
        self.refresh_alerts(budget.month)
        return success("Presupuesto creado.", budget_item(budget), status.HTTP_201_CREATED)


class BudgetDetailView(FinanceAPIView):
    update_serializer = BudgetSerializer

    def patch(self, request, pk):
        budget = self.owned(FinanceBudget.objects, pk, "Presupuesto no encontrado.")
        values = self.validated(self.update_serializer, request.data, instance=budget, partial=True)
        for field, value in values.items():
            setattr(budget, field, value)
        budget.save()
        self.refresh_alerts(budget.month)
        return success("Presupuesto actualizado.", budget_item(budget))

    def delete(self, request, pk):
        budget = self.owned(FinanceBudget.objects, pk, "Presupuesto no encontrado.")
        budget.delete()
        self.refresh_alerts(budget.month)
        return Response(status=status.HTTP_204_NO_CONTENT)


class BudgetAdjustView(BudgetDetailView):
    """Ruta antigua ``/ajustar/``: el PATCH solo cambia el límite."""

    update_serializer = BudgetAdjustSerializer


class BudgetCopyView(FinanceAPIView):
    def post(self, request):
        values = self.validated(BudgetCopySerializer, request.data)
        created, skipped = FinanceBudget.copy_month(request.user, values["source_month"], values["month"])
        self.refresh_alerts(values["month"])
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
        self.refresh_alerts(values["month"])
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
        self.refresh_alerts(movement)
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
    """``GET /alertas/?estado=activas|todas&tipo=<regla, etiqueta o nivel>``.

    Antes de responder evalúa (si hace falta) el mes en curso y el anterior.
    """

    def get(self, request):
        params = self.validated(AlertListQuerySerializer, request.query_params)
        ensure_alerts(request.user)
        return Response(alerts_payload(request.user, params["estado"], params["tipo"], timezone.now()))


class AlertActionView(FinanceAPIView):
    """``POST /alertas/<id>/accion/`` con ``action``: read | unread | dismiss | snooze (``hours``, 24 por defecto) | restore."""

    def post(self, request, pk):
        alert = self.owned(FinanceAlert.objects, pk, "Alerta no encontrada.")
        values = self.validated(AlertActionSerializer, request.data)
        now = timezone.now()
        message = apply_alert_action(alert, values["action"], hours=values["hours"], now=now)
        return success(message, serialize_alert(alert, now))


class SilenceAlertsView(FinanceAPIView):
    """Pospone todas las alertas activas (24 h por defecto). No las descarta: vuelven a aparecer después."""

    def post(self, request):
        hours = self.validated(SnoozeAllSerializer, request.data)["hours"]
        count, until = snooze_all(request.user, hours=hours)
        if count == 0:
            message = "No tienes alertas activas para silenciar."
        elif count == 1:
            message = f"Se silenció 1 alerta por {hours_text(hours)}."
        else:
            message = f"Se silenciaron {count} alertas por {hours_text(hours)}."
        return success(message, pospuestas=count, pospuesta_hasta=timezone.localtime(until).isoformat(timespec="seconds"))


class IncomeTaxView(FinanceAPIView):
    """Estimación del Impuesto a la Renta anual de quinta categoría.

    ``GET /impuestos/renta/?anio=&ingreso_anual=&deducciones_adicionales=&proyectar=1``.
    Usa ``ingreso_anual`` si se envía; si no, suma los ingresos REGULAR del año
    (sin depósitos, transferencias, ajustes ni saldos iniciales). Con
    ``proyectar=1`` en el año en curso, calcula sobre la proyección a 12 meses.
    """

    def get(self, request):
        values = self.validated(IncomeTaxQuerySerializer, request.query_params)
        today = local_today()
        year = values.get("anio", today.year)
        try:
            uit = uit_for_year(year)
        except ValueError as error:
            return Response({"anio": [str(error)]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(income_tax_payload(request.user, year, uit, values, today))
