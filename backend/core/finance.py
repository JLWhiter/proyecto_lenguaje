"""Consultas y respuestas de la API de finanzas (capa entre los modelos y las vistas).

Las reglas que cambian saldos viven en los modelos (``FinanceAccount``,
``FinanceTransaction``). Aquí se arman las respuestas JSON: se consulta la base
de datos con pocas consultas agregadas y se reutilizan los módulos puros
(``analytics``, ``budgets``, ``transaction_filters``, ``periods``).
"""

from decimal import Decimal

from django.conf import settings
from django.db.models import BooleanField, Count, ExpressionWrapper, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from . import analytics
from .alert_service import dashboard_alerts
from .alerts import BudgetUsage, budget_insight
from .budgets import STATES, budget_detail, budget_state, projected_spending, usage_percentage
from .models import FinanceAccount, FinanceBudget, FinanceTransaction
from .periods import days_remaining, period_label, period_of, short_date, year_bounds
from .transaction_filters import (
    daily_totals,
    filter_transactions,
    group_by_day,
    normalize_text,
    of_kind,
    of_type,
    page_of,
    total_amount,
)

ZERO = Decimal("0.00")
Kind = FinanceTransaction.Kind
Type = FinanceTransaction.Type

DEFAULT_CATEGORIES = (
    "Alimentación", "Vivienda", "Transporte", "Servicios", "Salud", "Educación",
    "Entretenimiento", "Ropa", "Salario", "Honorarios", "Otros",
)
DEFAULT_CATEGORY_TYPES = {"salario": {Type.INCOME}, "honorarios": {Type.INCOME}, "otros": {Type.INCOME, Type.EXPENSE}}
CATEGORY_ICONS = {
    "alimentación": "shopping", "ropa": "shopping", "transporte": "car", "vivienda": "home", "servicios": "home",
    "salud": "health", "entretenimiento": "gamepad", "salario": "briefcase", "honorarios": "briefcase",
}
KIND_ICONS = {Kind.TRANSFER: "transfer", Kind.DEPOSIT: "income", Kind.OPENING: "income", Kind.ADJUSTMENT: "adjust"}


# --- Movimientos -----------------------------------------------------------

def transaction_icon(movement):
    if movement.kind != Kind.REGULAR:
        return KIND_ICONS[movement.kind]
    default = "income" if movement.transaction_type == Type.INCOME else "shopping"
    return CATEGORY_ICONS.get(normalize_text(movement.category), default)


def serialize_transaction(movement):
    local = timezone.localtime(movement.occurred_at)
    account_name = movement.account.name if movement.account else movement.account_label
    return {
        "id": movement.id,
        "nombre": movement.name,
        "categoria": movement.category,
        "fecha": short_date(local.date()),
        "hora": local.strftime("%H:%M"),
        "occurred_at": local.isoformat(timespec="seconds"),
        "cuenta": account_name,
        "cuenta_id": movement.account_id,
        "subtexto": account_name,
        "monto": movement.signed_amount,
        "tipo": movement.transaction_type,
        "kind": movement.kind,
        "kind_label": movement.get_kind_display(),
        "estado": movement.status,
        "icon": transaction_icon(movement),
        "editable": movement.is_editable,
        "eliminable": movement.is_deletable,
        "custom": movement.is_deletable,
    }


def filtered_movements(user, filters):
    """Movimientos del mes que cumplen los filtros, del más reciente al más antiguo."""
    rows = FinanceTransaction.objects.filter(owner=user).in_period(filters["mes"]).select_related("account")
    if filters.get("account"):
        rows = rows.filter(account=filters["account"])
    return filter_transactions(
        map(serialize_transaction, rows), filters.get("search", ""), filters.get("tipo", ""), filters.get("categoria", "")
    )


def summary_totals(items):
    """Ingresos y gastos (REGULAR y DEPOSIT) de una lista de movimientos serializados."""
    counted = list(filter(of_kind(*FinanceTransaction.SUMMARY_KINDS), items))
    income = total_amount(filter(of_type(Type.INCOME), counted))
    expenses = -total_amount(filter(of_type(Type.EXPENSE), counted))
    return income, expenses


def transactions_payload(user, filters, today):
    items = filtered_movements(user, filters)
    page_items, pages = page_of(items, filters["page"], filters["page_size"])
    income, expenses = summary_totals(items)
    return {
        "mes": filters["mes"],
        "total_ingresos": income,
        "total_gastos": expenses,
        "neto": income - expenses,
        "count": len(items),
        "page": filters["page"],
        "pages": pages,
        "page_size": filters["page_size"],
        "grupos": group_by_day(page_items, today, daily_totals(items)),
    }


def analytics_records(user):
    """Movimientos del usuario en el formato que espera ``analytics``."""
    counts = ExpressionWrapper(Q(kind__in=FinanceTransaction.SUMMARY_KINDS), output_field=BooleanField())
    return FinanceTransaction.objects.filter(owner=user).annotate(count_in_summary=counts).values(*analytics.FIELDS)


def taxable_income(user, year):
    """Ingresos REGULAR del año (renta de trabajo): sin depósitos, transferencias ni ajustes."""
    start, end = year_bounds(year)
    incomes = FinanceTransaction.objects.filter(
        owner=user,
        kind__in=FinanceTransaction.TAXABLE_KINDS,
        transaction_type=Type.INCOME,
        status__in=analytics.SUMMARY_STATUSES,
        occurred_at__gte=start,
        occurred_at__lt=end,
    )
    return incomes.aggregate(total=Sum("amount"))["total"] or ZERO


# --- Presupuestos ----------------------------------------------------------

def spent_by_category(user, month):
    """Gasto REGULAR del mes por categoría normalizada, en una sola consulta agregada."""
    rows = (
        FinanceTransaction.objects.filter(
            owner=user, kind=Kind.REGULAR, transaction_type=Type.EXPENSE, status__in=analytics.SUMMARY_STATUSES
        )
        .in_period(month)
        .values("category")
        .annotate(total=Sum("amount"))
    )
    spent = {}
    for row in rows:
        key = normalize_text(row["category"])
        spent[key] = spent.get(key, ZERO) + row["total"]
    return spent


def serialize_budget(budget, spent, today):
    percentage = usage_percentage(spent, budget.limit_amount)
    state = budget_state(percentage)
    remaining = budget.limit_amount - spent
    projection = projected_spending(spent, budget.month, today)
    return {
        "id": budget.id,
        "mes": budget.month,
        "nombre": budget.category,
        "categoria": budget.category,
        "descripcion": budget.description,
        "presupuesto": budget.limit_amount,
        "gastado": spent,
        "restante": remaining,
        "porcentaje": round(percentage, 1),
        "estado": state.name,
        "badge": state.badge,
        "color": state.color,
        "proyeccion": projection,
        "detalle": budget_detail(remaining, projection, budget.month, today),
        "icon": budget.icon,
    }


def serialize_budgets(budgets, user, month, today):
    spent = spent_by_category(user, month)
    return [serialize_budget(budget, spent.get(normalize_text(budget.category), ZERO), today) for budget in budgets]


def budget_items(user, month, today):
    return serialize_budgets(FinanceBudget.objects.filter(owner=user, month=month), user, month, today)


def spent_for(budget):
    return spent_by_category(budget.owner_id, budget.month).get(normalize_text(budget.category), ZERO)


def insight_for(items, user, month, today):
    """Sugerencia calculada por reglas (``alerts.budget_insight``) a partir de los presupuestos ya serializados."""
    usages = [BudgetUsage(item["id"], item["categoria"], month, item["presupuesto"], item["gastado"]) for item in items]
    return budget_insight(usages, month, today, getattr(user, "currency", "PEN"))


def budgets_payload(user, month, today):
    items = budget_items(user, month, today)
    spent = sum((item["gastado"] for item in items), ZERO)
    limit = sum((item["presupuesto"] for item in items), ZERO)
    return {
        "mes": month,
        "summary": {
            "total_consumido": spent,
            "total_asignado": limit,
            "porcentaje": round(usage_percentage(spent, limit), 1),
            "restante": limit - spent,
            "proyeccion": sum((item["proyeccion"] for item in items), ZERO),
            "dias_restantes": days_remaining(month, today),
        },
        "ia_alert": insight_for(items, user, month, today),
        "filtros": [f"Todos {len(items)}", *(f"{state.name} {sum(item['estado'] == state.name for item in items)}" for state in STATES)],
        "categorias": items,
    }


# --- Cuentas ---------------------------------------------------------------

def serialize_account(account):
    return {
        "id": account.id,
        "nombre": account.name,
        "tipo": account.account_type,
        "estado": account.status,
        "saldo": account.balance,
        "descripcion": account.description,
        "badge": account.badge,
        "icon": account.icon,
        "archivada": account.is_archived,
    }


def accounts_payload(user):
    accounts = list(FinanceAccount.objects.filter(owner=user).active())
    items = [serialize_account(account) for account in accounts]
    total = sum((account.balance for account in accounts), ZERO)
    cash = sum((account.balance for account in accounts if account.icon == "cash"), ZERO)
    return {"patrimonio": total, "liquidez": total - cash, "efectivo": cash, "cuentas": items, "accounts": items}


# --- Dashboard y catálogos -------------------------------------------------

def dashboard_payload(user, month, today):
    balance = FinanceAccount.objects.filter(owner=user).active().aggregate(total=Sum("balance"))["total"] or ZERO
    budgets = budget_items(user, month, today)
    limit = sum((item["presupuesto"] for item in budgets), ZERO)
    spent = sum((item["gastado"] for item in budgets), ZERO)
    recent = FinanceTransaction.objects.filter(owner=user).in_period(month).select_related("account")[:4]
    alerts, pending = dashboard_alerts(user)
    return {
        "mes": month,
        "balance_total": balance,
        **analytics.dashboard_charts(analytics_records(user), month, balance, settings.TIME_ZONE),
        "presupuesto_porcentaje": round(usage_percentage(spent, limit), 1),
        "presupuesto_limite": limit,
        "presupuesto_consumido": spent,
        "presupuesto_restante": limit - spent,
        "alertas_activas": alerts,
        "alertas_pendientes": pending,
        "ultimas_transacciones": [serialize_transaction(movement) for movement in recent],
    }


def available_periods(user, today):
    """Meses con movimientos o presupuestos, más el mes actual, del más reciente al más antiguo."""
    movement_months = (
        FinanceTransaction.objects.filter(owner=user)
        .annotate(period=TruncMonth("occurred_at", tzinfo=timezone.get_current_timezone()))
        .order_by()
        .values_list("period", flat=True)
        .distinct()
    )
    budget_months = FinanceBudget.objects.filter(owner=user).order_by().values_list("month", flat=True).distinct()
    current = period_of(today)
    periods = sorted({current, *budget_months, *map(period_of, movement_months)}, reverse=True)
    return {
        "actual": current,
        "periodos": [{"mes": period, "etiqueta": period_label(period), "es_actual": period == current} for period in periods],
    }


def category_entry(name, default, types=(), uses=0):
    return {"nombre": name, "predeterminada": default, "tipos": set(types), "movimientos": uses}


def category_catalog(user):
    """Categorías de los movimientos regulares y presupuestos del usuario, junto con las predeterminadas."""
    catalog = {
        normalize_text(name): category_entry(name, True, DEFAULT_CATEGORY_TYPES.get(normalize_text(name), {Type.EXPENSE}))
        for name in DEFAULT_CATEGORIES
    }
    usage = (
        FinanceTransaction.objects.filter(owner=user, kind=Kind.REGULAR)
        .values("category", "transaction_type")
        .annotate(total=Count("id"))
    )
    for row in usage:
        entry = catalog.setdefault(normalize_text(row["category"]), category_entry(row["category"], False))
        entry["tipos"].add(row["transaction_type"])
        entry["movimientos"] += row["total"]
    for name in FinanceBudget.objects.filter(owner=user).order_by().values_list("category", flat=True).distinct():
        catalog.setdefault(normalize_text(name), category_entry(name, False, {Type.EXPENSE}))
    ordered = sorted(catalog.values(), key=lambda entry: (-entry["movimientos"], entry["nombre"].casefold()))
    return {"categorias": [{**entry, "tipos": sorted(entry["tipos"])} for entry in ordered]}
