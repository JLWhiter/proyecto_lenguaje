"""Exportación de movimientos a un libro de Excel (.xlsx) con el estilo de Finova (sin Django).

El libro tiene hasta tres hojas:

- **Movimientos**: encabezado con el período, el titular, los filtros y la fecha
  de generación; una tabla de Excel (filtros, orden y franjas) con fechas, horas
  y montos reales en la moneda del usuario; y los totales con fórmulas ``SUMIFS``.
- **Resumen**: tarjetas con ingresos, gastos, neto y saldo total; los gastos por
  categoría con barras de datos y un gráfico; y, en el historial completo, los
  ingresos y gastos de cada mes con un gráfico combinado.
- **Presupuestos** (solo al exportar un mes que tiene presupuestos): límite,
  gastado, restante y porcentaje usado con semáforo.

Seguridad: openpyxl guarda como fórmula cualquier texto que empiece con ``=``.
Por eso ``put`` escribe los textos siempre como texto (``data_type = "s"``) y
marca con ``quotePrefix`` los que empiezan con ``= + - @``, tabulación o
retorno, para que Excel tampoco los evalúe si el usuario edita la celda. Las
únicas fórmulas son las de los totales, que arma este módulo con ``put_formula``.

Los ingresos y gastos cuentan solo las clases REGULAR y DEPOSIT, igual que los
totales de la app (``finance.summary_totals``); las transferencias, ajustes y
saldos iniciales se listan, pero no suman.

Se prueba con ``unittest`` sin base de datos: ``python -m unittest core.test_xlsx_export``.
"""

import math
from dataclasses import dataclass, replace
from datetime import datetime
from decimal import Decimal
from io import BytesIO

from openpyxl import Workbook
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.chart.axis import ChartLines
from openpyxl.chart.label import DataLabelList
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.drawing.line import LineProperties
from openpyxl.formatting.rule import DataBarRule, FormulaRule, IconSetRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.page import PageMargins
from openpyxl.worksheet.pagebreak import Break
from openpyxl.worksheet.properties import PageSetupProperties
from openpyxl.worksheet.table import Table, TableStyleInfo

from .budgets import CAUTION_FROM, CRITICAL_FROM
from .categories import category_key
from .csv_export import FORMULA_PREFIXES
from .money import CURRENCY_SYMBOLS
from .periods import period_label, shift_month
from .transaction_filters import of_kind, of_type, total_amount

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
APP_NAME = "Finova"
ZERO = Decimal("0.00")

INCOME = "INGRESO"
EXPENSE = "GASTO"
TYPE_LABELS = {INCOME: "Ingreso", EXPENSE: "Gasto"}
# Clases que cuentan como ingreso o gasto (FinanceTransaction.SUMMARY_KINDS) y su nombre visible.
SUMMARY_KINDS = ("REGULAR", "DEPOSIT")
SUMMARY_KIND_LABELS = ("Movimiento", "Depósito")
UNCATEGORIZED = "Sin categoría"
CATEGORY_HEADER = "Categoría"

MOVEMENTS_SHEET = "Movimientos"
SUMMARY_SHEET = "Resumen"
BUDGETS_SHEET = "Presupuestos"
MOVEMENTS_TABLE = "TablaMovimientos"

# --- Paleta de la marca (Tailwind: esmeralda y pizarra) ---------------------
EMERALD = "10B981"
EMERALD_DARK = "047857"
EMERALD_LIGHT = "6EE7B7"
EMERALD_BAR = "34D399"
INK = "0F172A"
SLATE_700 = "334155"
SLATE_500 = "64748B"
SLATE_400 = "94A3B8"
SLATE_300 = "CBD5E1"
SLATE_200 = "E2E8F0"
SLATE_100 = "F1F5F9"
SLATE_50 = "F8FAFC"
RED = "DC2626"
RED_LIGHT = "F87171"
AMBER = "D97706"
SKY = "0284C7"
WHITE = "FFFFFF"
FONT_NAME = "Calibri"

DATE_FORMAT = "dd/mm/yyyy"
TIME_FORMAT = "hh:mm"
PERCENT_FORMAT = "0.0%"
COUNT_FORMAT = "#,##0"

# Hoja Movimientos: filas fijas del encabezado y columnas de la tabla.
FILTERS_ROW = 4
HEADER_ROW = 6
FIRST_DATA_ROW = HEADER_ROW + 1
MOVEMENT_HEADERS = ("Fecha", "Hora", "Descripción", CATEGORY_HEADER, "Tipo", "Clase", "Cuenta", "Monto", "Estado")
TYPE_COLUMN, KIND_COLUMN, AMOUNT_COLUMN = 5, 6, 8
DESCRIPTION_COLUMN = 3
TOTAL_LABEL_COLUMN = AMOUNT_COLUMN - 1
EMPTY_MOVEMENTS = "No hay movimientos para el período y los filtros elegidos."
TOTALS_NOTE = (
    "Ingresos y gastos suman solo movimientos y depósitos (como en Finova). Las transferencias entre "
    "tus cuentas, los ajustes y los saldos iniciales se listan, pero no se cuentan."
)

# Hoja Resumen: columnas B a E para tarjetas y tablas; el gráfico va desde la columna G.
SUMMARY_FIRST_COLUMN = 2
SUMMARY_WIDTH = 22
CHART_COLUMN = "G"
CHART_COLUMNS = 9
CHART_COLUMN_WIDTH = 9.5
CHART_WIDTH_CM = 16.5
ROW_HEIGHT_CM = 0.53
CHARS_PER_WIDTH = 1.1  # letras promedio de Calibri 11 por unidad de ancho de columna
CATEGORY_HEADERS = (CATEGORY_HEADER, "Monto", "% del total", "Movimientos")
MONTH_HEADERS = ("Mes", "Ingresos", "Gastos", "Neto")
BUDGET_HEADERS = (CATEGORY_HEADER, "Límite", "Gastado", "Restante", "% usado", "Estado")
BUDGET_STATE_COLORS = {"Normal": EMERALD_DARK, "Precaución": AMBER, "Crítico": RED, "Excedido": RED}
# Semáforo del % usado con los umbrales de los estados de ``budgets``: verde, ámbar (75 %) y rojo (90 %).
BUDGET_LIGHTS = [0, CAUTION_FROM / 100, CRITICAL_FROM / 100]


@dataclass(frozen=True)
class ExportReport:
    """Datos del libro.

    ``items`` son movimientos serializados (``finance.serialize_transaction``), del
    más reciente al más antiguo. ``month`` es ``None`` al exportar todo el historial.
    ``filters`` son pares (etiqueta, valor) de los filtros aplicados y ``budgets``
    los presupuestos serializados del mes (``finance.serialize_budgets``).
    """

    owner: str
    currency: str
    month: str | None
    items: tuple
    generated_at: datetime
    filters: tuple = ()
    balance: Decimal = ZERO
    accounts: int = 0
    budgets: tuple = ()

    @property
    def history(self):
        return self.month is None


@dataclass(frozen=True)
class Totals:
    income: Decimal
    expenses: Decimal

    @property
    def net(self):
        return self.income - self.expenses


@dataclass(frozen=True)
class CategoryRow:
    name: str
    amount: Decimal
    count: int
    share: float


@dataclass(frozen=True)
class MonthRow:
    month: str
    income: Decimal
    expenses: Decimal

    @property
    def net(self):
        return self.income - self.expenses


@dataclass(frozen=True)
class Kpi:
    label: str
    value: Decimal
    caption: str
    accent: str


@dataclass(frozen=True)
class SheetLayout:
    """Columnas de una hoja: el banner va de la columna 1 a ``last_column`` y el
    texto empieza en ``first_column``; las ``right_span`` últimas llevan la fecha y el titular."""

    first_column: int
    last_column: int
    right_span: int


MOVEMENTS_LAYOUT = SheetLayout(first_column=1, last_column=len(MOVEMENT_HEADERS), right_span=3)
SUMMARY_LAYOUT = SheetLayout(first_column=SUMMARY_FIRST_COLUMN, last_column=6 + CHART_COLUMNS, right_span=4)
BUDGETS_LAYOUT = SheetLayout(first_column=2, last_column=2 + len(BUDGET_HEADERS) - 1, right_span=3)


# --- Cálculos (los mismos criterios que los totales de la app) -----------------

def counted(items):
    """Movimientos que cuentan como ingreso o gasto (clases REGULAR y DEPOSIT)."""
    return list(filter(of_kind(*SUMMARY_KINDS), items))


def summary_totals(items):
    """Ingresos y gastos (positivos) de los movimientos, como ``finance.summary_totals``."""
    rows = counted(items)
    return Totals(total_amount(filter(of_type(INCOME), rows)), -total_amount(filter(of_type(EXPENSE), rows)))


def expenses_by_category(items):
    """Gastos agrupados por categoría (sin importar tildes ni mayúsculas), del mayor al menor."""
    groups = {}
    for item in filter(of_type(EXPENSE), counted(items)):
        name = item["categoria"] or UNCATEGORIZED
        current_name, amount, count = groups.get(category_key(name), (name, ZERO, 0))
        groups[category_key(name)] = (current_name, amount - item["monto"], count + 1)
    total = sum((amount for _, amount, _ in groups.values()), ZERO)
    ordered = sorted(groups.values(), key=lambda group: (-group[1], category_key(group[0])))
    return [CategoryRow(name, amount, count, float(amount / total) if total else 0.0) for name, amount, count in ordered]


def item_month(item):
    """Período 'AAAA-MM' (hora local) de un movimiento serializado."""
    return item["occurred_at"][:7]


def month_span(items):
    """Todos los meses entre el primer y el último movimiento, en orden cronológico."""
    months = sorted({item_month(item) for item in items})
    if not months:
        return []
    span = [months[0]]
    while span[-1] < months[-1]:
        span.append(shift_month(span[-1], 1))
    return span


def monthly_flows(items):
    """Ingresos y gastos de cada mes del historial (incluye los meses sin movimientos)."""
    flows = {month: Totals(ZERO, ZERO) for month in month_span(items)}
    for item in counted(items):
        month = item_month(item)
        current = flows[month]
        if item["tipo"] == INCOME:
            flows[month] = Totals(current.income + item["monto"], current.expenses)
        else:
            flows[month] = Totals(current.income, current.expenses - item["monto"])
    return [MonthRow(month, totals.income, totals.expenses) for month, totals in flows.items()]


def report_period(report):
    """'Noviembre 2026' o 'Historial completo: Junio 2026 – Noviembre 2026'."""
    if not report.history:
        return period_label(report.month)
    months = month_span(report.items)
    if not months:
        return "Historial completo (sin movimientos)"
    if len(months) == 1:
        return f"Historial completo: {period_label(months[0])}"
    return f"Historial completo: {period_label(months[0])} – {period_label(months[-1])}"


def generated_text(report):
    """'Generado el 26/11/2026 18:05'."""
    return f"Generado el {report.generated_at:%d/%m/%Y %H:%M}"


def plural(count, singular, many):
    return f"{count} {singular if count == 1 else many}"


def filters_text(filters):
    """'Filtros: Tipo: Gasto · Categoría: Comida' o 'Sin filtros'."""
    if not filters:
        return "Sin filtros: todos los movimientos"
    return "Filtros: " + " · ".join(f"{label}: {value}" for label, value in filters)


def currency_symbol(currency):
    return CURRENCY_SYMBOLS.get(currency, CURRENCY_SYMBOLS["PEN"])


def axis_format(currency):
    """Formato sin decimales para el eje de un gráfico: '"S/" #,##0'."""
    return f'"{currency_symbol(currency)}" #,##0'


def currency_format(currency, red_negatives=False):
    """Formato de número con el símbolo de la moneda: '"S/" #,##0.00;-"S/" #,##0.00'."""
    symbol = currency_symbol(currency)
    color = "[Red]" if red_negatives else ""
    return f'"{symbol}" #,##0.00;{color}-"{symbol}" #,##0.00'


# --- Estilos y escritura segura -------------------------------------------------

def font(size=11, color=INK, bold=False, italic=False):
    return Font(name=FONT_NAME, size=size, color=color, bold=bold, italic=italic)


def solid(color):
    return PatternFill(fill_type="solid", start_color=color, end_color=color)


def side(color=SLATE_200, style="thin"):
    return Side(style=style, color=color)


def align(horizontal="left", wrap=False, indent=0, vertical="center"):
    return Alignment(horizontal=horizontal, vertical=vertical, wrap_text=wrap, indent=indent)


@dataclass(frozen=True)
class Look:
    """Estilo de una celda; solo se aplican los atributos definidos."""

    font: Font | None = None
    fill: PatternFill | None = None
    alignment: Alignment | None = None
    border: Border | None = None
    number_format: str | None = None

    def apply(self, cell):
        for name in ("font", "fill", "alignment", "border", "number_format"):
            value = getattr(self, name)
            if value is not None:
                setattr(cell, name, value)


INK_FILL = solid(INK)
BRAND_FILL = solid(EMERALD)
HEADER_FILL = solid(SLATE_100)
CARD_FILL = solid(SLATE_50)
ROW_BORDER = Border(bottom=side())
HEADER_BORDER = Border(bottom=side(EMERALD, "medium"))
TOTAL_BORDER = Border(top=side(INK, "medium"))

TITLE_LOOK = Look(font=font(18, WHITE, bold=True), alignment=align(indent=1))
STAMP_LOOK = Look(font=font(10, SLATE_400), alignment=align("right", indent=1))
PERIOD_LOOK = Look(font=font(12, EMERALD_LIGHT, bold=True), alignment=align(indent=1))
OWNER_LOOK = Look(font=font(11, SLATE_300), alignment=align("right", indent=1))
CAPTION_LOOK = Look(font=font(10, SLATE_500, italic=True), alignment=align(indent=1, wrap=True))
NOTE_LOOK = Look(font=font(9, SLATE_500, italic=True), alignment=align(wrap=True, indent=1, vertical="top"))
SECTION_LOOK = Look(font=font(13, INK, bold=True), alignment=align())
EMPTY_LOOK = Look(font=font(10, SLATE_500, italic=True), alignment=align("center"), fill=CARD_FILL)
HEADER_LOOK = Look(font=font(10, SLATE_700, bold=True), fill=HEADER_FILL, border=HEADER_BORDER, alignment=align(indent=1))
HEADER_NUMBER_LOOK = replace(HEADER_LOOK, alignment=align("right", indent=1))
TOTAL_LABEL_LOOK = Look(font=font(10, SLATE_500, bold=True), alignment=align("right", indent=1))
BODY_LOOK = Look(font=font(), border=ROW_BORDER, alignment=align(indent=1))
MUTED_LOOK = replace(BODY_LOOK, font=font(color=SLATE_500))
NUMBER_LOOK = replace(BODY_LOOK, alignment=align("right", indent=1))


def clean_text(value):
    """Texto apto para una celda (sin caracteres de control que Excel no admite)."""
    return ILLEGAL_CHARACTERS_RE.sub("", "" if value is None else str(value))


def write_text(cell, value):
    """Escribe ``value`` como texto literal: nunca se guarda ni se evalúa como fórmula."""
    text = clean_text(value)
    cell.value = text
    cell.data_type = "s"
    if text.startswith(FORMULA_PREFIXES):
        cell.quotePrefix = True
    return cell


def put(ws, row, column, value, look=None):
    """Escribe un valor: los textos siempre como texto; números, fechas y horas tal cual."""
    cell = ws.cell(row=row, column=column)
    if isinstance(value, str) or value is None:
        write_text(cell, value)
    else:
        cell.value = value
    if look is not None:
        look.apply(cell)
    return cell


def put_formula(ws, row, column, formula, look=None):
    """Escribe una fórmula armada por este módulo (nunca con texto del usuario)."""
    cell = ws.cell(row=row, column=column, value=f"={formula}")
    if look is not None:
        look.apply(cell)
    return cell


def merge(ws, rows, columns, value, look):
    """Escribe ``value`` en la primera celda y une el rango ``rows`` × ``columns`` (tuplas inicio, fin)."""
    (first_row, last_row), (first_column, last_column) = rows, columns
    cell = put(ws, first_row, first_column, value, look)
    if (first_row, first_column) != (last_row, last_column):
        ws.merge_cells(start_row=first_row, start_column=first_column, end_row=last_row, end_column=last_column)
    return cell


def paint(ws, row, last_column, fill):
    for column in range(1, last_column + 1):
        ws.cell(row=row, column=column).fill = fill


def set_widths(ws, widths, first_column=1):
    for column, width in enumerate(widths, start=first_column):
        ws.column_dimensions[get_column_letter(column)].width = width


def fitted_width(values, minimum, maximum):
    """Ancho de columna según el texto más largo, entre ``minimum`` y ``maximum``."""
    longest = max((len(clean_text(value)) for value in values), default=0)
    return max(minimum, min(maximum, longest + 3))


def wrapped_height(text, width):
    """Alto de fila para un texto que se parte en varias líneas dentro de ``width``."""
    per_line = max(1.0, (width - 2) * CHARS_PER_WIDTH)
    lines = max(1, math.ceil(len(clean_text(text)) / per_line))
    return 15 * lines + 6


def prepare_sheet(ws, title, tab_color):
    ws.title = title
    ws.sheet_properties.tabColor = tab_color
    ws.sheet_view.showGridLines = False


def setup_page(ws, title, report, title_rows=None):
    """Impresión: horizontal, A4, ajustada al ancho, con encabezado y número de página."""
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
    ws.page_margins = PageMargins(left=0.4, right=0.4, top=0.7, bottom=0.7, header=0.3, footer=0.3)
    ws.print_options.horizontalCentered = True
    ws.oddHeader.left.text = f"{APP_NAME} · {title}"
    ws.oddHeader.right.text = report_period(report)
    ws.oddFooter.left.text = generated_text(report)
    ws.oddFooter.right.text = "Página &P de &N"
    for part in (ws.oddHeader.left, ws.oddHeader.right, ws.oddFooter.left, ws.oddFooter.right):
        part.size = 9
        part.color = SLATE_500
    if title_rows:
        ws.print_title_rows = title_rows


def write_banner(ws, title, report, layout):
    """Filas 1 a 3: banda oscura con título, período, titular y fecha, y una franja esmeralda."""
    last = layout.last_column
    split = last - layout.right_span
    for row in (1, 2):
        paint(ws, row, last, INK_FILL)
    paint(ws, 3, last, BRAND_FILL)
    merge(ws, (1, 1), (layout.first_column, split), f"{APP_NAME} · {title}", TITLE_LOOK)
    merge(ws, (1, 1), (split + 1, last), generated_text(report), STAMP_LOOK)
    merge(ws, (2, 2), (layout.first_column, split), report_period(report), PERIOD_LOOK)
    merge(ws, (2, 2), (split + 1, last), report.owner, OWNER_LOOK)
    for row, height in ((1, 36), (2, 22), (3, 5)):
        ws.row_dimensions[row].height = height


def write_headers(ws, row, first_column, headers, numeric=()):
    """Fila de encabezados de una tabla; ``numeric`` son los encabezados de columnas numéricas."""
    for column, title in enumerate(headers, start=first_column):
        put(ws, row, column, title, HEADER_NUMBER_LOOK if title in numeric else HEADER_LOOK)
    ws.row_dimensions[row].height = 24


# --- Hoja Movimientos -------------------------------------------------------------

def movement_values(item):
    """Valores de la fila de un movimiento: fecha y hora reales (hora local, sin zona)."""
    moment = datetime.fromisoformat(item["occurred_at"]).replace(tzinfo=None)
    return (
        moment.date(),
        moment.time().replace(second=0, microsecond=0),
        item["nombre"],
        item["categoria"],
        TYPE_LABELS.get(item["tipo"], item["tipo"]),
        item["kind_label"],
        item["cuenta"],
        item["monto"],
        item["estado"],
    )


def movement_tone(item):
    """Color del tipo y del monto: verde ingreso, rojo gasto, gris si no cuenta en los totales."""
    if item["kind"] not in SUMMARY_KINDS:
        return SLATE_500
    return EMERALD_DARK if item["tipo"] == INCOME else RED


def movement_widths(items):
    return (
        12,
        8,
        fitted_width((item["nombre"] for item in items), 28, 46),
        fitted_width((item["categoria"] for item in items), 14, 26),
        10,
        fitted_width((item["kind_label"] for item in items), 13, 18),
        fitted_width((item["cuenta"] for item in items), 14, 26),
        17,
        13,
    )


def movement_looks(currency):
    centered = replace(BODY_LOOK, alignment=align("center"))
    return (
        replace(centered, number_format=DATE_FORMAT),
        replace(centered, font=font(color=SLATE_500), number_format=TIME_FORMAT),
        replace(BODY_LOOK, alignment=align(wrap=True, indent=1)),
        BODY_LOOK,
        BODY_LOOK,
        MUTED_LOOK,
        BODY_LOOK,
        replace(NUMBER_LOOK, number_format=currency_format(currency)),
        MUTED_LOOK,
    )


def write_movement_rows(ws, report, widths):
    """Una fila por movimiento; devuelve la última fila escrita."""
    looks = movement_looks(report.currency)
    tones = {color: font(color=color) for color in (EMERALD_DARK, RED, SLATE_500)}
    strong = {color: font(color=color, bold=True) for color in tones}
    for row, item in enumerate(report.items, start=FIRST_DATA_ROW):
        for column, (value, look) in enumerate(zip(movement_values(item), looks), start=1):
            put(ws, row, column, value, look)
        tone = movement_tone(item)
        ws.cell(row=row, column=TYPE_COLUMN).font = tones[tone]
        ws.cell(row=row, column=AMOUNT_COLUMN).font = strong[tone]
        ws.row_dimensions[row].height = wrapped_height(item["nombre"], widths[DESCRIPTION_COLUMN - 1])
    return FIRST_DATA_ROW + len(report.items) - 1


def add_movement_table(ws, last_row):
    """Tabla de Excel (autofiltro y orden) con franjas que se mantienen al ordenar."""
    last_letter = get_column_letter(len(MOVEMENT_HEADERS))
    table = Table(displayName=MOVEMENTS_TABLE, ref=f"A{HEADER_ROW}:{last_letter}{last_row}")
    table.tableStyleInfo = TableStyleInfo(
        name="TableStyleLight1", showFirstColumn=False, showLastColumn=False, showRowStripes=False, showColumnStripes=False
    )
    ws.add_table(table)
    ws.conditional_formatting.add(
        f"A{FIRST_DATA_ROW}:{last_letter}{last_row}", FormulaRule(formula=["MOD(ROW(),2)=0"], fill=solid(SLATE_50))
    )


def column_range(column, last_row):
    letter = get_column_letter(column)
    return f"${letter}${FIRST_DATA_ROW}:${letter}${last_row}"


def sumifs(type_label, last_row):
    """Suma de los montos de un tipo que cuentan en los totales (una SUMIFS por clase)."""
    amounts, types, kinds = (column_range(column, last_row) for column in (AMOUNT_COLUMN, TYPE_COLUMN, KIND_COLUMN))
    return "+".join(
        f'SUMIFS({amounts},{types},"{type_label}",{kinds},"{kind}")' for kind in SUMMARY_KIND_LABELS
    )


def total_formulas(last_row, first_total_row):
    """Fórmulas de ingresos, gastos (en positivo) y neto bajo la tabla."""
    amount = get_column_letter(AMOUNT_COLUMN)
    return (
        ("Ingresos", sumifs(TYPE_LABELS[INCOME], last_row), EMERALD_DARK),
        ("Gastos", f"-({sumifs(TYPE_LABELS[EXPENSE], last_row)})", RED),
        ("Neto", f"{amount}{first_total_row}-{amount}{first_total_row + 1}", INK),
    )


def write_movement_totals(ws, last_row, currency):
    """Ingresos, gastos y neto bajo la tabla (fórmulas), con una nota sobre qué se cuenta."""
    first = last_row + 2
    value_look = Look(alignment=align("right", indent=1), number_format=currency_format(currency, red_negatives=True))
    for row, (label, formula, color) in enumerate(total_formulas(last_row, first), start=first):
        is_net = row == first + 2
        border = TOTAL_BORDER if is_net else None
        put(ws, row, TOTAL_LABEL_COLUMN, label, replace(TOTAL_LABEL_LOOK, border=border))
        size = 12 if is_net else 11
        put_formula(ws, row, AMOUNT_COLUMN, formula, replace(value_look, font=font(size, color, bold=True), border=border))
        ws.row_dimensions[row].height = 22
    merge(ws, (first, first + 2), (1, KIND_COLUMN - 1), TOTALS_NOTE, NOTE_LOOK)


def movements_caption(report):
    return f"{plural(len(report.items), 'movimiento', 'movimientos')} · {filters_text(report.filters)}"


def write_movements(ws, report):
    prepare_sheet(ws, MOVEMENTS_SHEET, EMERALD)
    widths = movement_widths(report.items)
    set_widths(ws, widths)
    write_banner(ws, MOVEMENTS_SHEET, report, MOVEMENTS_LAYOUT)
    merge(ws, (FILTERS_ROW, FILTERS_ROW), (1, len(MOVEMENT_HEADERS)), movements_caption(report), CAPTION_LOOK)
    ws.row_dimensions[FILTERS_ROW].height = 24
    ws.row_dimensions[HEADER_ROW - 1].height = 6
    write_headers(ws, HEADER_ROW, 1, MOVEMENT_HEADERS, numeric=("Monto",))
    if report.items:
        last_row = write_movement_rows(ws, report, widths)
        add_movement_table(ws, last_row)
        write_movement_totals(ws, last_row, report.currency)
    else:
        merge(ws, (FIRST_DATA_ROW, FIRST_DATA_ROW), (1, len(MOVEMENT_HEADERS)), EMPTY_MOVEMENTS, EMPTY_LOOK)
        ws.row_dimensions[FIRST_DATA_ROW].height = 30
    ws.freeze_panes = f"A{FIRST_DATA_ROW}"
    setup_page(ws, MOVEMENTS_SHEET, report, title_rows=f"{HEADER_ROW}:{HEADER_ROW}")


# --- Hoja Resumen -----------------------------------------------------------------

def summary_kpis(report, totals):
    expenses = sum(1 for item in counted(report.items) if item["tipo"] == EXPENSE)
    incomes = sum(1 for item in counted(report.items) if item["tipo"] == INCOME)
    return (
        Kpi("INGRESOS", totals.income, plural(incomes, "ingreso o depósito", "ingresos y depósitos"), EMERALD),
        Kpi("GASTOS", totals.expenses, plural(expenses, "gasto", "gastos"), RED),
        Kpi("NETO", totals.net, "Ingresos menos gastos", INK),
        Kpi("SALDO TOTAL", report.balance, f"Hoy, en {plural(report.accounts, 'cuenta activa', 'cuentas activas')}", SKY),
    )


def write_kpi(ws, row, column, kpi, money):
    """Tarjeta de tres filas: etiqueta, valor grande y una línea de contexto."""
    gap = side(WHITE, "thick")  # separa visualmente las tarjetas vecinas
    walls = {"left": gap, "right": gap}
    card = Look(fill=CARD_FILL, alignment=align(indent=1))
    label = replace(card, font=font(9, kpi.accent, bold=True), border=Border(top=side(kpi.accent, "thick"), **walls))
    value = replace(card, font=font(18, INK, bold=True), border=Border(**walls), number_format=money)
    caption = replace(card, font=font(9, SLATE_500), border=Border(bottom=side(SLATE_200), **walls))
    put(ws, row, column, kpi.label, label)
    put(ws, row + 1, column, kpi.value, value)
    put(ws, row + 2, column, kpi.caption, caption)


def write_kpis(ws, row, report, totals):
    money = currency_format(report.currency, red_negatives=True)
    for column, kpi in enumerate(summary_kpis(report, totals), start=SUMMARY_FIRST_COLUMN):
        write_kpi(ws, row, column, kpi, money)
    for offset, height in enumerate((22, 32, 20)):
        ws.row_dimensions[row + offset].height = height
    return row + 2


def write_section_title(ws, row, title, caption):
    put(ws, row, SUMMARY_FIRST_COLUMN, title, SECTION_LOOK)
    put(ws, row + 1, SUMMARY_FIRST_COLUMN, caption, Look(font=font(10, SLATE_500), alignment=align()))
    ws.row_dimensions[row].height = 22
    return row + 2


def write_table_rows(ws, first_row, rows, looks):
    """Filas de una tabla del resumen a partir de la columna B; devuelve la última fila."""
    for row, values in enumerate(rows, start=first_row):
        for column, (value, look) in enumerate(zip(values, looks), start=SUMMARY_FIRST_COLUMN):
            put(ws, row, column, value, look)
        ws.row_dimensions[row].height = 20
    return first_row + len(rows) - 1


def write_total_row(ws, row, values, looks, first_column=SUMMARY_FIRST_COLUMN):
    """Fila de total en negrita (conserva el color de cada columna) con línea superior."""
    for column, (value, look) in enumerate(zip(values, looks), start=first_column):
        put(ws, row, column, value, replace(look, font=font(color=look.font.color, bold=True), border=TOTAL_BORDER))
    ws.row_dimensions[row].height = 22


def axis_ceiling(value):
    """Máximo "redondo" del eje con ~20 % de aire para la etiqueta de la barra mayor: 1300 -> 1600."""
    target = float(value) * 1.2
    if target <= 0:
        return 1.0
    step = 10 ** math.floor(math.log10(target)) / 5
    return math.ceil(target / step) * step


def chart_rows(chart):
    """Filas (de 15 pt) que ocupa un gráfico, para que la sección siguiente no lo tape."""
    return math.ceil(chart.height / ROW_HEIGHT_CM) + 1


def frame_chart(chart, title, value_format):
    """Título sin superponerse, borde suave, ejes visibles y líneas de guía claras."""
    chart.title = title
    chart.title.overlay = False
    chart.roundedCorners = False
    chart.graphical_properties = GraphicalProperties(ln=LineProperties(solidFill=SLATE_200))
    chart.width = CHART_WIDTH_CM
    chart.x_axis.delete = False
    chart.y_axis.delete = False
    chart.y_axis.number_format = value_format
    chart.y_axis.majorGridlines = ChartLines(spPr=GraphicalProperties(ln=LineProperties(solidFill=SLATE_200)))
    for axis in (chart.x_axis, chart.y_axis):
        axis.graphicalProperties = GraphicalProperties(ln=LineProperties(solidFill=SLATE_300))


def paint_series(series, color):
    series.graphicalProperties.solidFill = color
    series.graphicalProperties.line.solidFill = color


def category_chart(ws, header_row, last_row, currency, largest):
    """Barras horizontales de gasto por categoría (la mayor arriba), con el monto al final de cada barra."""
    chart = BarChart()
    chart.type = "bar"
    chart.legend = None
    chart.gapWidth = 60
    chart.add_data(Reference(ws, min_col=3, min_row=header_row, max_row=last_row), titles_from_data=True)
    chart.set_categories(Reference(ws, min_col=2, min_row=header_row + 1, max_row=last_row))
    paint_series(chart.series[0], EMERALD)
    chart.dataLabels = DataLabelList(
        showVal=True, showSerName=False, showCatName=False, showLegendKey=False, showPercent=False, dLblPos="outEnd"
    )
    frame_chart(chart, "Gastos por categoría", axis_format(currency))
    chart.x_axis.scaling.orientation = "maxMin"
    chart.y_axis.crosses = "max"
    chart.y_axis.scaling.min = 0
    chart.y_axis.scaling.max = axis_ceiling(largest)
    chart.height = min(15.0, max(7.5, 1.1 * (last_row - header_row) + 3))
    return chart


def amount_look(currency, color=INK):
    return replace(NUMBER_LOOK, font=font(color=color), number_format=currency_format(currency, red_negatives=True))


def write_empty_row(ws, row, text):
    merge(ws, (row, row), (SUMMARY_FIRST_COLUMN, SUMMARY_FIRST_COLUMN + 3), text, EMPTY_LOOK)
    ws.row_dimensions[row].height = 26
    return row


def write_category_section(ws, row, report):
    """Tabla de gastos por categoría con barras de datos y gráfico; devuelve la última fila usada."""
    categories = expenses_by_category(report.items)
    header = write_section_title(ws, row, "Gastos por categoría", "Gastos del período (sin transferencias ni ajustes).")
    write_headers(ws, header, SUMMARY_FIRST_COLUMN, CATEGORY_HEADERS, numeric=CATEGORY_HEADERS[1:])
    if not categories:
        return write_empty_row(ws, header + 1, "No hay gastos en este período.")
    looks = (
        BODY_LOOK,
        amount_look(report.currency),
        replace(NUMBER_LOOK, number_format=PERCENT_FORMAT),
        replace(NUMBER_LOOK, number_format=COUNT_FORMAT),
    )
    rows = [(item.name, item.amount, item.share, item.count) for item in categories]
    last = write_table_rows(ws, header + 1, rows, looks)
    total = sum((item.amount for item in categories), ZERO)
    write_total_row(ws, last + 1, ("Total", total, 1.0, sum(item.count for item in categories)), looks)
    ws.conditional_formatting.add(
        f"C{header + 1}:C{last}", DataBarRule(start_type="num", start_value=0, end_type="max", color=EMERALD_BAR)
    )
    chart = category_chart(ws, header, last, report.currency, categories[0].amount)
    ws.add_chart(chart, f"{CHART_COLUMN}{row}")
    return max(last + 1, row + chart_rows(chart))


def month_chart(ws, header_row, last_row, currency):
    """Columnas de ingresos y gastos por mes, con el neto como línea."""
    columns = BarChart()
    columns.type = "col"
    columns.grouping = "clustered"
    columns.gapWidth = 80
    columns.add_data(Reference(ws, min_col=3, max_col=4, min_row=header_row, max_row=last_row), titles_from_data=True)
    labels = Reference(ws, min_col=2, min_row=header_row + 1, max_row=last_row)
    columns.set_categories(labels)
    paint_series(columns.series[0], EMERALD)
    paint_series(columns.series[1], RED_LIGHT)
    net = LineChart()
    net.add_data(Reference(ws, min_col=5, min_row=header_row, max_row=last_row), titles_from_data=True)
    net.set_categories(labels)
    line = net.series[0]
    line.graphicalProperties.line.solidFill = INK
    line.graphicalProperties.line.width = 28575  # 2.25 pt
    line.marker.symbol = "circle"
    line.smooth = False
    line.marker.size = 7
    line.marker.graphicalProperties = GraphicalProperties(solidFill=INK)
    line.marker.graphicalProperties.line.solidFill = INK
    frame_chart(columns, "Ingresos y gastos por mes", axis_format(currency))
    columns += net
    columns.legend.position = "b"
    columns.legend.overlay = False
    columns.height = 9
    return columns


def write_month_section(ws, row, report):
    """Ingresos, gastos y neto de cada mes del historial, con su gráfico."""
    months = monthly_flows(report.items)
    header = write_section_title(ws, row, "Evolución mensual", "Ingresos, gastos y neto de cada mes del historial.")
    write_headers(ws, header, SUMMARY_FIRST_COLUMN, MONTH_HEADERS, numeric=MONTH_HEADERS[1:])
    if not months:
        return write_empty_row(ws, header + 1, "Aún no hay movimientos.")
    currency = report.currency
    looks = (BODY_LOOK, amount_look(currency, EMERALD_DARK), amount_look(currency, RED), amount_look(currency))
    rows = [(period_label(item.month), item.income, item.expenses, item.net) for item in months]
    last = write_table_rows(ws, header + 1, rows, looks)
    totals = summary_totals(report.items)
    write_total_row(ws, last + 1, ("Total", totals.income, totals.expenses, totals.net), looks)
    chart = month_chart(ws, header, last, report.currency)
    ws.add_chart(chart, f"{CHART_COLUMN}{row + 1}")  # una fila abajo: el borde no cae en el salto de página
    return max(last + 1, row + 1 + chart_rows(chart))


def write_summary(ws, report):
    prepare_sheet(ws, SUMMARY_SHEET, INK)
    set_widths(ws, (2.5, *(SUMMARY_WIDTH,) * 4, 3, *(CHART_COLUMN_WIDTH,) * CHART_COLUMNS))
    write_banner(ws, SUMMARY_SHEET, report, SUMMARY_LAYOUT)
    row = write_kpis(ws, 5, report, summary_totals(report.items))
    note = f"{filters_text(report.filters)}. {TOTALS_NOTE}"
    merge(ws, (row + 1, row + 1), (SUMMARY_FIRST_COLUMN, SUMMARY_FIRST_COLUMN + 3), note, NOTE_LOOK)
    ws.row_dimensions[row + 1].height = 30
    row = write_category_section(ws, row + 3, report)
    if report.history:
        ws.row_breaks.append(Break(id=row + 1))  # al imprimir, la evolución mensual empieza en otra página
        write_month_section(ws, row + 2, report)
    setup_page(ws, SUMMARY_SHEET, report)


# --- Hoja Presupuestos -------------------------------------------------------------

def budget_values(budget):
    return (
        budget["categoria"],
        budget["presupuesto"],
        budget["gastado"],
        budget["restante"],
        budget["porcentaje"] / 100,
        budget["estado"],
    )


def write_budget_rows(ws, report, looks):
    for row, budget in enumerate(report.budgets, start=FIRST_DATA_ROW):
        for column, (value, look) in enumerate(zip(budget_values(budget), looks), start=BUDGETS_LAYOUT.first_column):
            put(ws, row, column, value, look)
        state = ws.cell(row=row, column=BUDGETS_LAYOUT.last_column)
        state.font = font(color=BUDGET_STATE_COLORS.get(budget["estado"], INK), bold=True)
        ws.row_dimensions[row].height = 22
    return FIRST_DATA_ROW + len(report.budgets) - 1


def budget_total(report):
    limit = sum((budget["presupuesto"] for budget in report.budgets), ZERO)
    spent = sum((budget["gastado"] for budget in report.budgets), ZERO)
    return ("Total", limit, spent, limit - spent, float(spent / limit) if limit else 0.0, "")


def write_budgets(ws, report):
    prepare_sheet(ws, BUDGETS_SHEET, AMBER)
    set_widths(ws, (2.5, fitted_width((budget["categoria"] for budget in report.budgets), 22, 30), 16, 16, 16, 12, 16))
    write_banner(ws, BUDGETS_SHEET, report, BUDGETS_LAYOUT)
    caption = "Lo gastado incluye todos los gastos del mes, sin los filtros de la exportación."
    merge(ws, (FILTERS_ROW, FILTERS_ROW), (BUDGETS_LAYOUT.first_column, BUDGETS_LAYOUT.last_column), caption, CAPTION_LOOK)
    ws.row_dimensions[FILTERS_ROW].height = 24
    write_headers(ws, HEADER_ROW, BUDGETS_LAYOUT.first_column, BUDGET_HEADERS, numeric=BUDGET_HEADERS[1:5])
    money = replace(NUMBER_LOOK, number_format=currency_format(report.currency, red_negatives=True))
    looks = (BODY_LOOK, money, money, money, replace(NUMBER_LOOK, number_format=PERCENT_FORMAT), BODY_LOOK)
    last = write_budget_rows(ws, report, looks)
    write_total_row(ws, last + 1, budget_total(report), looks, first_column=BUDGETS_LAYOUT.first_column)
    usage = get_column_letter(BUDGETS_LAYOUT.first_column + BUDGET_HEADERS.index("% usado"))
    ws.conditional_formatting.add(
        f"{usage}{FIRST_DATA_ROW}:{usage}{last}",
        IconSetRule("3TrafficLights1", "num", BUDGET_LIGHTS, showValue=None, reverse=True),
    )
    ws.freeze_panes = f"A{FIRST_DATA_ROW}"
    setup_page(ws, BUDGETS_SHEET, report, title_rows=f"{HEADER_ROW}:{HEADER_ROW}")


# --- Libro ---------------------------------------------------------------------------

def set_properties(workbook, report):
    period = report_period(report)
    workbook.properties.title = f"{APP_NAME} · Movimientos · {period}"
    workbook.properties.subject = "Exportación de movimientos"
    workbook.properties.creator = APP_NAME
    workbook.properties.lastModifiedBy = APP_NAME
    workbook.properties.keywords = "Finova; finanzas personales; movimientos"
    workbook.properties.description = f"Generado por {APP_NAME} el {report.generated_at:%d/%m/%Y %H:%M}."
    workbook.properties.created = report.generated_at


def build_workbook(report):
    """Libro con las hojas Movimientos, Resumen y (si corresponde) Presupuestos."""
    workbook = Workbook()
    write_movements(workbook.active, report)
    write_summary(workbook.create_sheet(), report)
    if report.budgets and not report.history:
        write_budgets(workbook.create_sheet(), report)
    set_properties(workbook, report)
    workbook.active = 0
    return workbook


def workbook_bytes(report):
    """Contenido del archivo .xlsx."""
    buffer = BytesIO()
    build_workbook(report).save(buffer)
    return buffer.getvalue()
