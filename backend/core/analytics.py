"""Análisis de movimientos con Pandas y NumPy.

- Pandas arma un ``DataFrame`` con los movimientos del usuario y lo limpia.
- NumPy calcula el neto de cada mes y reconstruye el saldo al cierre de cada mes.

El módulo no depende de Django: recibe registros simples (por ejemplo, el
resultado de ``QuerySet.values(*FIELDS)``), así que se puede probar con
``unittest`` sin base de datos.

Los montos se manejan en céntimos (enteros ``int64``) para que las sumas
sean exactas y no arrastren errores de punto flotante.
"""

import numpy as np
import pandas as pd

INCOME = "INGRESO"
EXPENSE = "GASTO"
SUMMARY_STATUSES = ("Completado", "Acreditado")
UNCATEGORIZED = "Sin categoría"
OTHERS = "Otras categorías"
FIELDS = ("id", "occurred_at", "category", "transaction_type", "amount", "status", "count_in_summary")
MONTH_NAMES = ("Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic")
PALETTE = ("#ef4444", "#10b981", "#f59e0b", "#60a5fa", "#4f46e5")
OTHERS_COLOR = "#94a3b8"
CLEAN_COLUMNS = ["id", "occurred_at", "month", "category", "type", "amount_cents", "signed_cents", "in_summary"]


def normalize_category(value):
    """'  comida   rápida ' -> 'Comida rápida'; vacía o nula -> 'Sin categoría'."""
    if value is None or pd.isna(value):
        return UNCATEGORIZED
    text = " ".join(str(value).split())
    return text[:1].upper() + text[1:] if text else UNCATEGORIZED


def clean_transactions(records, tz):
    """Construye un DataFrame limpio con una fila por movimiento válido.

    Limpieza aplicada:
    - se descartan montos nulos, no numéricos o menores o iguales a cero;
    - se descartan fechas nulas o inválidas, y el resto se pasa a la hora local ``tz``;
    - se descartan tipos distintos de INGRESO/GASTO (sin importar mayúsculas ni espacios);
    - las categorías se normalizan y las vacías pasan a "Sin categoría";
    - se elimina cualquier movimiento repetido (mismo ``id``).
    """
    raw = pd.DataFrame.from_records(list(records), columns=list(FIELDS))
    cents = (pd.to_numeric(raw["amount"], errors="coerce") * 100).round()
    occurred = pd.to_datetime(raw["occurred_at"], errors="coerce", utc=True)
    kind = raw["transaction_type"].astype("string").str.strip().str.upper()
    counted = raw["count_in_summary"].astype("boolean").fillna(True).astype(bool)
    in_summary = counted & raw["status"].isin(SUMMARY_STATUSES)

    valid = (cents.gt(0) & occurred.notna() & kind.isin([INCOME, EXPENSE])).astype(bool)
    valid_ids = raw["id"].where(valid)
    repeated = valid_ids.notna() & valid_ids.duplicated()
    keep = (valid & ~repeated).to_numpy()

    local = occurred[keep].dt.tz_convert(tz)
    amount_cents = cents[keep].astype("int64")
    is_income = (kind[keep] == INCOME).to_numpy(dtype=bool)
    frame = pd.DataFrame(
        {
            "id": raw["id"][keep],
            "occurred_at": local,
            "month": local.dt.strftime("%Y-%m"),
            "category": raw["category"][keep].map(normalize_category),
            "type": kind[keep].astype(str),
            "amount_cents": amount_cents,
            "signed_cents": np.where(is_income, amount_cents, -amount_cents).astype("int64"),
            "in_summary": in_summary[keep],
        },
        columns=CLEAN_COLUMNS,
    )
    return frame.reset_index(drop=True)


def shift_month(month, offset):
    """Suma ``offset`` meses a un período 'AAAA-MM'."""
    year, number = map(int, month.split("-"))
    index = year * 12 + (number - 1) + offset
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def month_window(end_month, size=6):
    """Los ``size`` períodos consecutivos que terminan en ``end_month`` (incluido)."""
    return [shift_month(end_month, offset) for offset in range(-size + 1, 1)]


def month_label(month, with_year=False):
    """'2024-05' -> 'May' (o 'May 24' con ``with_year``)."""
    year, number = month.split("-")
    name = MONTH_NAMES[int(number) - 1]
    return f"{name} {year[2:]}" if with_year else name


def monthly_net(frame, months):
    """Neto (ingresos menos gastos) en céntimos de cada período de ``months``."""
    totals = np.zeros(len(months), dtype=np.int64)
    position = frame["month"].map({month: index for index, month in enumerate(months)})
    inside = position.notna().to_numpy()
    np.add.at(totals, position.to_numpy()[inside].astype(np.int64), frame["signed_cents"].to_numpy()[inside])
    return totals


def balance_evolution(frame, months, current_balance_cents):
    """Saldo al cierre de cada período, reconstruido hacia atrás desde el saldo actual.

    saldo_cierre[k] = saldo_actual - (neto de los movimientos posteriores al período k)
    """
    net = monthly_net(frame, months)
    after_window = int(frame.loc[frame["month"] > months[-1], "signed_cents"].sum())
    later_in_window = net.sum() - np.cumsum(net)
    return int(current_balance_cents) - after_window - later_in_window


def trend_percentage(values):
    """Variación porcentual entre el primer y el último valor de la serie."""
    series = np.asarray(values, dtype=np.float64)
    if series.size < 2 or series[0] == 0:
        return 0.0
    return float((series[-1] - series[0]) / abs(series[0]) * 100)


def format_trend(percentage):
    """12.345 -> '+12.3%'; valores casi nulos -> '0.0%'."""
    return "0.0%" if round(percentage, 1) == 0 else f"{percentage:+.1f}%"


def percentages_summing_100(amounts):
    """Porcentajes con un decimal que suman exactamente 100 (método del mayor resto)."""
    amounts = np.asarray(amounts, dtype=np.float64)
    shares = amounts / amounts.sum() * 1000
    tenths = np.floor(shares).astype(np.int64)
    missing = 1000 - int(tenths.sum())
    order = np.argsort(-(shares - tenths), kind="stable")
    tenths[order[:missing]] += 1
    return tenths / 10


def expense_distribution(frame, month, top=5):
    """Gastos del período agrupados por categoría, en porcentaje del total.

    Si hay más de ``top`` categorías, las menores se juntan en "Otras categorías".
    """
    expenses = frame.loc[(frame["type"] == EXPENSE) & frame["in_summary"] & (frame["month"] == month)]
    if expenses.empty:
        return []
    grouped = (
        expenses.assign(key=expenses["category"].str.casefold())
        .groupby("key", sort=False)
        .agg(name=("category", "first"), cents=("amount_cents", "sum"))
        .sort_values("cents", ascending=False, kind="stable")
        .reset_index(drop=True)
    )
    if len(grouped) > top:
        rest = pd.DataFrame({"name": [OTHERS], "cents": [grouped["cents"].iloc[top - 1:].sum()]})
        grouped = pd.concat([grouped.iloc[: top - 1], rest], ignore_index=True)
    percentages = percentages_summing_100(grouped["cents"])
    colors = [OTHERS_COLOR if name == OTHERS else PALETTE[index % len(PALETTE)] for index, name in enumerate(grouped["name"])]
    return [
        {"name": name, "value": float(percentage), "monto": int(cents) / 100, "color": color}
        for name, percentage, cents, color in zip(grouped["name"], percentages, grouped["cents"], colors)
    ]


def dashboard_charts(records, month, current_balance, tz, window=6):
    """Datos de los gráficos del dashboard para el período ``month`` ('AAAA-MM').

    La evolución del saldo cubre hasta ``window`` meses y empieza un mes antes
    del primer movimiento registrado, para mostrar el saldo inicial.
    """
    frame = clean_transactions(records, tz)
    charts = {
        "evolucion_saldo": [],
        "evolucion_periodo": "",
        "evolucion_tendencia": "0.0%",
        "distribucion_gastos": expense_distribution(frame, month),
    }
    if frame.empty:
        return charts

    start = shift_month(frame["month"].min(), -1)
    months = [period for period in month_window(month, window) if period >= start]
    if not months:
        return charts

    balances = balance_evolution(frame, months, round(current_balance * 100))
    charts["evolucion_saldo"] = [
        {"name": month_label(period), "periodo": period, "value": int(cents) / 100}
        for period, cents in zip(months, balances)
    ]
    charts["evolucion_periodo"] = f"{month_label(months[0], with_year=True)} - {month_label(months[-1], with_year=True)}"
    charts["evolucion_tendencia"] = format_trend(trend_percentage(balances))
    return charts
