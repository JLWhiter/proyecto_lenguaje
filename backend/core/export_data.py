"""Datos de la exportación de movimientos (``GET /transacciones/exportar/``).

Consulta la base de datos y arma lo que necesitan ``xlsx_export`` (el libro de
Excel) y ``csv_export``. Con ``todo`` se exporta todo el historial y se ignora
``mes``; los demás filtros (tipo, categoría, cuenta y búsqueda) son los mismos
del listado de movimientos.
"""

from django.db.models import Count, Sum
from django.utils import timezone

from .finance import budget_items, serialize_transaction
from .models import FinanceAccount, FinanceTransaction, MovementType
from .transaction_filters import filter_transactions
from .xlsx_export import ZERO, ExportReport

FILENAME_PREFIXES = {"xlsx": "finova-movimientos", "csv": "finova-transacciones"}
HISTORY_FILENAME = "finova-historial-completo"


def export_movements(user, filters):
    """Movimientos que cumplen los filtros (del mes o de todo el historial), del más reciente al más antiguo."""
    rows = FinanceTransaction.objects.filter(owner=user).select_related("account")
    if not filters["todo"]:
        rows = rows.in_period(filters["mes"])
    if filters["account"] is not None:
        rows = rows.filter(account=filters["account"])
    return filter_transactions(map(serialize_transaction, rows), filters["search"], filters["tipo"], filters["categoria"])


def export_filename(filters, extension):
    """'finova-movimientos-2026-11.xlsx', 'finova-historial-completo.xlsx' o, en CSV, 'finova-transacciones-2026-11.csv'."""
    if filters["todo"]:
        return f"{HISTORY_FILENAME}.{extension}"
    return f"{FILENAME_PREFIXES[extension]}-{filters['mes']}.{extension}"


def filter_labels(filters):
    """Filtros aplicados como pares (etiqueta, valor) para el encabezado del Excel."""
    account = filters["account"]
    labels = (
        ("Tipo", MovementType(filters["tipo"]).label if filters["tipo"] else ""),
        ("Categoría", filters["categoria"].strip()),
        ("Cuenta", account.name if account is not None else ""),
        ("Búsqueda", filters["search"].strip()),
    )
    return tuple((label, value) for label, value in labels if value)


def export_report(user, filters, items, today):
    """Todo lo que muestra el libro de Excel para el usuario de la sesión."""
    month = None if filters["todo"] else filters["mes"]
    accounts = FinanceAccount.objects.filter(owner=user).active().aggregate(total=Sum("balance"), count=Count("id"))
    budgets = budget_items(user, month, today) if month else []
    return ExportReport(
        owner=user.full_name or user.email,
        currency=user.currency,
        month=month,
        items=tuple(items),
        generated_at=timezone.localtime().replace(tzinfo=None),
        filters=filter_labels(filters),
        balance=accounts["total"] or ZERO,
        accounts=accounts["count"],
        budgets=tuple(budgets),
    )
