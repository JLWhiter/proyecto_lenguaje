from django.urls import path

from .views import (
    AccountBalanceUpdateView,
    AccountListView,
    AlertActionView,
    AlertListView,
    BudgetAdjustView,
    BudgetListView,
    DashboardResumenView,
    DepositView,
    IncomeTaxView,
    RebalanceBudgetView,
    SilenceAlertsView,
    TransactionListView,
    TransactionDetailView,
    TransactionExportView,
    TransferView,
    health,
)

urlpatterns = [
    path("health/", health, name="health"),
    path("dashboard/resumen/", DashboardResumenView.as_view(), name="dashboard-resumen"),
    path("transacciones/", TransactionListView.as_view(), name="transacciones"),
    path("transacciones/exportar/", TransactionExportView.as_view(), name="transacciones-exportar"),
    path("transacciones/transferir/", TransferView.as_view(), name="transacciones-transferir"),
    path("transacciones/depositar/", DepositView.as_view(), name="transacciones-depositar"),
    path("transacciones/<int:pk>/", TransactionDetailView.as_view(), name="transaccion-detalle"),
    path("presupuestos/", BudgetListView.as_view(), name="presupuestos"),
    path("presupuestos/<int:pk>/ajustar/", BudgetAdjustView.as_view(), name="presupuesto-ajustar"),
    path("presupuestos/rebalancear/", RebalanceBudgetView.as_view(), name="presupuestos-rebalancear"),
    path("cuentas/", AccountListView.as_view(), name="cuentas"),
    path("cuentas/<int:pk>/saldo/", AccountBalanceUpdateView.as_view(), name="cuenta-saldo"),
    path("alertas/", AlertListView.as_view(), name="alertas"),
    path("alertas/<int:pk>/accion/", AlertActionView.as_view(), name="alerta-accion"),
    path("alertas/silenciar-todo/", SilenceAlertsView.as_view(), name="alertas-silenciar-todo"),
    path("impuestos/renta/", IncomeTaxView.as_view(), name="impuestos-renta"),
]