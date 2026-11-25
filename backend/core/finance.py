from decimal import Decimal

from django.db.models import Sum

from .models import FinanceAccount, FinanceAlert, FinanceBudget, FinanceProfile, FinanceTransaction


def initialize_finance_profile(user):
    profile, _ = FinanceProfile.objects.get_or_create(
        owner=user,
        defaults={"use_sample_data": False},
    )
    return profile.use_sample_data


def empty_dashboard_payload():
    return {
        "balance_total": Decimal("0.00"),
        "balance_variacion": "0.0% vs mes anterior",
        "ingresos_mensuales": Decimal("0.00"),
        "ingresos_variacion": "0.0%",
        "gastos_mensuales": Decimal("0.00"),
        "gastos_variacion": "0.0%",
        "presupuesto_porcentaje": 0,
        "presupuesto_limite": Decimal("0.00"),
        "presupuesto_consumido": Decimal("0.00"),
        "presupuesto_restante": Decimal("0.00"),
        "evolucion_saldo": [],
        "evolucion_periodo": "",
        "evolucion_tendencia": "0.0%",
        "distribucion_gastos": [],
        "alertas_activas": [],
        "ultimas_transacciones": [],
    }


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
    }


def serialize_budget(budget):
    remaining = budget.limit_amount - budget.spent_amount
    percentage = float((budget.spent_amount / budget.limit_amount) * 100) if budget.limit_amount else 0
    if percentage >= 90:
        color = "red"
        badge = "Crítico: Cerca del límite"
    elif percentage >= 75:
        color = "amber"
        badge = "Precaución"
    else:
        color = "green"
        badge = "En control"
    return {
        "id": budget.id,
        "nombre": budget.category,
        "descripcion": budget.description,
        "presupuesto": budget.limit_amount,
        "gastado": budget.spent_amount,
        "restante": remaining,
        "porcentaje": percentage,
        "estado": "Crítico" if color == "red" else "Precaución" if color == "amber" else "Normal",
        "badge": badge,
        "proyeccion": budget.projected_amount or budget.spent_amount,
        "detalle": f"Restan S/ {remaining:.2f} de este presupuesto",
        "color": color,
        "icon": budget.icon,
    }


def serialize_alert(alert):
    return {
        "id": alert.id,
        "tipo": alert.category,
        "titulo": alert.title,
        "descripcion": alert.description,
        "nivel": alert.level,
        "tiempo": "Ahora" if not alert.is_read else "Leída",
        "porcentaje": alert.percentage,
        "badge": alert.action_label.upper() if alert.action_label else alert.category.upper(),
        "leida": alert.is_read,
        "descartada": alert.dismissed,
    }


def serialize_transaction(transaction):
    signed_amount = transaction.amount if transaction.transaction_type == FinanceTransaction.Type.INCOME else -transaction.amount
    account_name = transaction.account.name if transaction.account else transaction.account_label
    return {
        "id": transaction.id + 1000000,
        "nombre": transaction.name,
        "categoria": transaction.category,
        "fecha": transaction.occurred_at.strftime("%d %b"),
        "cuenta": account_name,
        "monto": signed_amount,
        "tipo": transaction.transaction_type,
        "estado": transaction.status,
        "hora": transaction.occurred_at.strftime("%H:%M"),
        "subtexto": account_name,
        "icon": "income" if transaction.transaction_type == FinanceTransaction.Type.INCOME else "shopping",
        "custom": True,
    }


def finance_totals(user, month=None):
    transactions = FinanceTransaction.objects.filter(owner=user, status__in=["Completado", "Acreditado"], count_in_summary=True)
    if month:
        transactions = transactions.filter(occurred_at__year=int(month[:4]), occurred_at__month=int(month[5:7]))
    income = transactions.filter(transaction_type=FinanceTransaction.Type.INCOME).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    expenses = transactions.filter(transaction_type=FinanceTransaction.Type.EXPENSE).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    return income, expenses
