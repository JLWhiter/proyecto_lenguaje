"""Migración de datos previa a quitar ``count_in_summary`` y ``spent_amount``.

1. Clasifica los movimientos existentes: "Transferencia" fuera del resumen -> TRANSFER,
   "Depósito" -> DEPOSIT; el resto queda REGULAR.
2. Une las dos patas de cada transferencia antigua con un mismo ``transfer_group``.
3. Limpia espacios sobrantes en las categorías.
4. Renombra cuentas y presupuestos que solo se diferencian en mayúsculas
   ("Ahorros" / "ahorros" -> "ahorros (2)"), para poder crear las restricciones
   únicas sin distinguir mayúsculas. No se borra ningún dato.
5. Registra como movimiento la diferencia entre el saldo de cada cuenta y la
   suma de sus movimientos (saldo inicial o "Actualizar saldo" de antes), así
   la evolución del saldo queda exacta.
"""

import uuid
from datetime import timedelta
from decimal import Decimal

from django.db import migrations
from django.db.models import Min, Q, Sum

LEG_TOLERANCE = timedelta(seconds=5)


def classify_movements(apps, schema_editor):
    Transaction = apps.get_model("core", "FinanceTransaction")
    Transaction.objects.filter(category="Transferencia", count_in_summary=False).update(kind="TRANSFER")
    Transaction.objects.filter(category="Depósito").update(kind="DEPOSIT")


def link_transfer_legs(apps, schema_editor):
    Transaction = apps.get_model("core", "FinanceTransaction")
    unlinked = Transaction.objects.filter(kind="TRANSFER", transfer_group__isnull=True)
    for debit in unlinked.filter(transaction_type="GASTO").order_by("id"):
        credit = (
            unlinked.filter(
                owner_id=debit.owner_id,
                transaction_type="INGRESO",
                amount=debit.amount,
                name=debit.name,
                occurred_at__range=(debit.occurred_at - LEG_TOLERANCE, debit.occurred_at + LEG_TOLERANCE),
            )
            .order_by("id")
            .first()
        )
        if credit:
            Transaction.objects.filter(pk__in=[debit.pk, credit.pk]).update(transfer_group=uuid.uuid4())


def tidy_categories(apps, schema_editor):
    for model_name in ("FinanceTransaction", "FinanceBudget"):
        model = apps.get_model("core", model_name)
        for record in model.objects.only("id", "category"):
            clean = " ".join(record.category.split())
            if clean != record.category:
                model.objects.filter(pk=record.pk).update(category=clean)


def rename_case_duplicates(records, field, scope):
    seen = set()
    for record in records:
        original = getattr(record, field)
        name, copy = original, 2
        while (scope(record), name.casefold()) in seen:
            name, copy = f"{original} ({copy})", copy + 1
        seen.add((scope(record), name.casefold()))
        if name != original:
            type(record).objects.filter(pk=record.pk).update(**{field: name})


def deduplicate_names(apps, schema_editor):
    Account = apps.get_model("core", "FinanceAccount")
    Budget = apps.get_model("core", "FinanceBudget")
    rename_case_duplicates(Account.objects.order_by("id"), "name", lambda account: account.owner_id)
    rename_case_duplicates(Budget.objects.order_by("id"), "category", lambda budget: (budget.owner_id, budget.month))


def reconcile_balances(apps, schema_editor):
    Account = apps.get_model("core", "FinanceAccount")
    Transaction = apps.get_model("core", "FinanceTransaction")
    for account in Account.objects.all():
        totals = Transaction.objects.filter(account=account).aggregate(
            income=Sum("amount", filter=Q(transaction_type="INGRESO")),
            expense=Sum("amount", filter=Q(transaction_type="GASTO")),
            first=Min("occurred_at"),
        )
        difference = account.balance - ((totals["income"] or Decimal("0")) - (totals["expense"] or Decimal("0")))
        common = {"owner_id": account.owner_id, "account": account, "amount": abs(difference), "count_in_summary": False}
        if difference > 0:
            opened_at = min(filter(None, (account.created_at, totals["first"]))) - timedelta(seconds=1)
            Transaction.objects.create(
                name="Saldo inicial", category="Saldo inicial", kind="OPENING",
                transaction_type="INGRESO", status="Acreditado", occurred_at=opened_at, **common,
            )
        elif difference < 0:
            Transaction.objects.create(
                name="Ajuste de saldo", category="Ajuste de saldo", kind="ADJUSTMENT",
                transaction_type="GASTO", status="Completado", occurred_at=account.updated_at, **common,
            )


def forwards(apps, schema_editor):
    classify_movements(apps, schema_editor)
    link_transfer_legs(apps, schema_editor)
    tidy_categories(apps, schema_editor)
    deduplicate_names(apps, schema_editor)
    reconcile_balances(apps, schema_editor)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_movement_kind_and_archived_accounts"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
