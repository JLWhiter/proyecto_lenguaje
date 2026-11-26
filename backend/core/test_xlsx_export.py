"""Pruebas unitarias (unittest) del libro de Excel de la exportación.

Se pueden ejecutar sin base de datos: ``python -m unittest core.test_xlsx_export``.
"""

import io
import re
import unittest
import zipfile
from datetime import datetime, time
from decimal import Decimal

from openpyxl import load_workbook

from core.xlsx_export import (
    BUDGETS_SHEET,
    FIRST_DATA_ROW,
    HEADER_ROW,
    MOVEMENT_HEADERS,
    MOVEMENTS_SHEET,
    MOVEMENTS_TABLE,
    SUMMARY_SHEET,
    ExportReport,
    axis_ceiling,
    clean_text,
    currency_format,
    expenses_by_category,
    monthly_flows,
    report_period,
    summary_totals,
    workbook_bytes,
)

GENERATED = datetime(2026, 11, 26, 12, 30)
INJECTIONS = ('=HYPERLINK("http://x","y")', "=1+1", "+51 999 888 777", "-2+3", "@SUM(A1)", "\t=1+1")


def movement(name, amount, kind="REGULAR", category="Alimentación", moment="2026-11-20T10:15:00-05:00", **extra):
    """Movimiento serializado como ``finance.serialize_transaction`` (monto con signo)."""
    value = Decimal(amount)
    labels = {"REGULAR": "Movimiento", "DEPOSIT": "Depósito", "TRANSFER": "Transferencia", "ADJUSTMENT": "Ajuste de saldo"}
    return {
        "occurred_at": moment,
        "nombre": name,
        "categoria": category,
        "tipo": "INGRESO" if value > 0 else "GASTO",
        "kind": kind,
        "kind_label": labels[kind],
        "cuenta": "BCP",
        "monto": value,
        "estado": "Acreditado" if value > 0 else "Completado",
        **extra,
    }


ITEMS = (
    movement("Sueldo", "4200.00", category="Salario", moment="2026-11-01T09:00:00-05:00"),
    movement("Depósito en efectivo", "300.00", kind="DEPOSIT", category="Depósito"),
    movement("Wong", "-191.37"),
    movement("Menú", "-12.50", category="alimentacion"),
    movement("Taxi", "-20.00", category="Transporte", moment="2026-11-24T23:45:00-05:00"),
    movement("Recarga Yape", "-400.00", kind="TRANSFER", category="Transferencia"),
    movement("Recarga Yape", "400.00", kind="TRANSFER", category="Transferencia"),
    movement("Ajuste de saldo", "-5.00", kind="ADJUSTMENT", category="Ajuste de saldo"),
)
BUDGETS = (
    {"categoria": "Alimentación", "presupuesto": Decimal("300.00"), "gastado": Decimal("203.87"),
     "restante": Decimal("96.13"), "porcentaje": 68.0, "estado": "Normal"},
    {"categoria": "Transporte", "presupuesto": Decimal("15.00"), "gastado": Decimal("20.00"),
     "restante": Decimal("-5.00"), "porcentaje": 133.3, "estado": "Excedido"},
)


def report(**overrides):
    values = {
        "owner": "Ana Pérez",
        "currency": "PEN",
        "month": "2026-11",
        "items": ITEMS,
        "generated_at": GENERATED,
        "balance": Decimal("1500.00"),
        "accounts": 2,
        "budgets": BUDGETS,
    }
    return ExportReport(**{**values, **overrides})


def open_workbook(data):
    return load_workbook(io.BytesIO(data))


def table_rows(sheet):
    """Filas de datos de la tabla de movimientos (sin el encabezado)."""
    ref = sheet.tables[MOVEMENTS_TABLE].ref
    return list(sheet[ref])[1:]


class CalculationTests(unittest.TestCase):
    def test_totals_count_only_regular_and_deposit(self):
        totals = summary_totals(ITEMS)

        self.assertEqual(totals.income, Decimal("4500.00"))
        self.assertEqual(totals.expenses, Decimal("223.87"))
        self.assertEqual(totals.net, Decimal("4276.13"))

    def test_categories_are_merged_by_key_and_sorted(self):
        rows = expenses_by_category(ITEMS)

        self.assertEqual([(row.name, row.amount, row.count) for row in rows], [
            ("Alimentación", Decimal("203.87"), 2),
            ("Transporte", Decimal("20.00"), 1),
        ])
        self.assertAlmostEqual(sum(row.share for row in rows), 1.0)

    def test_monthly_flows_include_months_without_movements(self):
        items = (movement("Sueldo", "100.00", moment="2026-08-01T09:00:00-05:00"), movement("Wong", "-40.00"))

        rows = monthly_flows(items)

        self.assertEqual([row.month for row in rows], ["2026-08", "2026-09", "2026-10", "2026-11"])
        self.assertEqual((rows[0].income, rows[1].net, rows[-1].expenses), (Decimal("100.00"), Decimal("0.00"), Decimal("40.00")))

    def test_period_labels(self):
        history = (movement("Sueldo", "100.00", moment="2026-06-01T09:00:00-05:00"), movement("Wong", "-40.00"))

        self.assertEqual(report_period(report()), "Noviembre 2026")
        self.assertEqual(report_period(report(month=None, items=history)), "Historial completo: Junio 2026 – Noviembre 2026")
        self.assertEqual(report_period(report(month=None, items=())), "Historial completo (sin movimientos)")

    def test_chart_axis_leaves_room_for_the_largest_label(self):
        self.assertEqual([axis_ceiling(value) for value in (1300, Decimal("7800.00"), 89.9, 0)], [1600, 9400, 120, 1])

    def test_currency_formats(self):
        self.assertEqual(currency_format("PEN"), '"S/" #,##0.00;-"S/" #,##0.00')
        self.assertEqual(currency_format("USD", red_negatives=True), '"$" #,##0.00;[Red]-"$" #,##0.00')
        self.assertIn('"€"', currency_format("EUR"))


class MovementsSheetTests(unittest.TestCase):
    def setUp(self):
        self.book = open_workbook(workbook_bytes(report()))
        self.sheet = self.book[MOVEMENTS_SHEET]

    def test_sheets_and_document_properties(self):
        self.assertEqual(self.book.sheetnames, [MOVEMENTS_SHEET, SUMMARY_SHEET, BUDGETS_SHEET])
        self.assertEqual(self.book.active.title, MOVEMENTS_SHEET)
        self.assertEqual(self.book.properties.creator, "Finova")
        self.assertIn("Noviembre 2026", self.book.properties.title)

    def test_header_block(self):
        self.assertEqual(self.sheet["A1"].value, "Finova · Movimientos")
        self.assertEqual(self.sheet["A2"].value, "Noviembre 2026")
        self.assertEqual(self.sheet["G2"].value, "Ana Pérez")
        self.assertEqual(self.sheet["G1"].value, "Generado el 26/11/2026 12:30")
        self.assertEqual(self.sheet["A4"].value, "8 movimientos · Sin filtros: todos los movimientos")

    def test_table_has_headers_one_row_per_movement_and_autofilter(self):
        table = self.sheet.tables[MOVEMENTS_TABLE]

        self.assertEqual(table.ref, f"A{HEADER_ROW}:I{HEADER_ROW + len(ITEMS)}")
        self.assertIsNotNone(table.autoFilter)
        self.assertEqual(tuple(cell.value for cell in self.sheet[HEADER_ROW]), MOVEMENT_HEADERS)
        self.assertEqual(len(table_rows(self.sheet)), len(ITEMS))
        self.assertEqual(self.sheet.freeze_panes, f"A{FIRST_DATA_ROW}")

    def test_dates_times_and_amounts_are_real_values(self):
        fecha, hora, nombre, _, tipo, clase, _, monto, _ = table_rows(self.sheet)[0]

        self.assertEqual(fecha.value, datetime(2026, 11, 1))
        self.assertEqual(fecha.number_format, "dd/mm/yyyy")
        self.assertEqual(hora.value, time(9, 0))
        self.assertEqual(hora.number_format, "hh:mm")
        self.assertEqual((nombre.value, tipo.value, clase.value), ("Sueldo", "Ingreso", "Movimiento"))
        self.assertEqual(monto.value, 4200)
        self.assertEqual(monto.number_format, currency_format("PEN"))

    def test_totals_use_sumifs_over_counted_kinds(self):
        last = HEADER_ROW + len(ITEMS)
        income, expenses, net = (self.sheet.cell(row=last + offset, column=8).value for offset in (2, 3, 4))

        self.assertEqual(
            income,
            f'=SUMIFS($H${FIRST_DATA_ROW}:$H${last},$E${FIRST_DATA_ROW}:$E${last},"Ingreso",$F${FIRST_DATA_ROW}:$F${last},"Movimiento")'
            f'+SUMIFS($H${FIRST_DATA_ROW}:$H${last},$E${FIRST_DATA_ROW}:$E${last},"Ingreso",$F${FIRST_DATA_ROW}:$F${last},"Depósito")',
        )
        self.assertTrue(expenses.startswith('=-(SUMIFS(') and '"Gasto"' in expenses)
        self.assertEqual(net, f"=H{last + 2}-H{last + 3}")
        self.assertEqual(self.evaluate_sumifs("Ingreso"), Decimal("4500.00"))
        self.assertEqual(-self.evaluate_sumifs("Gasto"), Decimal("223.87"))

    def evaluate_sumifs(self, type_label):
        """Lo que calcula Excel con las SUMIFS de los totales, leído de las celdas de la tabla."""
        return sum(
            (Decimal(str(row[7].value)) for row in table_rows(self.sheet)
             if row[4].value == type_label and row[5].value in ("Movimiento", "Depósito")),
            Decimal("0"),
        )

    def test_print_setup(self):
        self.assertEqual(self.sheet.page_setup.orientation, "landscape")
        self.assertEqual(self.sheet.page_setup.fitToWidth, 1)
        self.assertTrue(self.sheet.sheet_properties.pageSetUpPr.fitToPage)
        self.assertIn("&P", self.sheet.oddFooter.right.text)
        self.assertEqual(self.sheet.print_title_rows, f"${HEADER_ROW}:${HEADER_ROW}")

    def test_user_currency_is_used_in_every_amount(self):
        book = open_workbook(workbook_bytes(report(currency="USD")))
        amount = table_rows(book[MOVEMENTS_SHEET])[0][7]

        self.assertEqual(amount.number_format, '"$" #,##0.00;-"$" #,##0.00')
        self.assertEqual(book[SUMMARY_SHEET]["B6"].number_format, '"$" #,##0.00;[Red]-"$" #,##0.00')
        self.assertIn('"$"', book[BUDGETS_SHEET]["C7"].number_format)

    def test_empty_export_has_message_and_no_table(self):
        sheet = open_workbook(workbook_bytes(report(items=(), budgets=())))[MOVEMENTS_SHEET]

        self.assertEqual(dict(sheet.tables), {})
        self.assertEqual(sheet.cell(row=FIRST_DATA_ROW, column=1).value, "No hay movimientos para el período y los filtros elegidos.")


class FormulaInjectionTests(unittest.TestCase):
    def setUp(self):
        items = tuple(movement(text, "-1.00", category=text, cuenta=text) for text in INJECTIONS)
        filters = (("Búsqueda", "=1+1"),)
        self.data = workbook_bytes(report(items=items, owner="=cmd|' /C calc'!A0", filters=filters, budgets=()))
        self.book = open_workbook(self.data)

    def test_user_text_stays_literal_text(self):
        rows = table_rows(self.book[MOVEMENTS_SHEET])

        for row, text in zip(rows, INJECTIONS):
            for cell in (row[2], row[3], row[6]):
                self.assertEqual(cell.data_type, "s", text)
                self.assertEqual(cell.value, text)
                self.assertTrue(cell.quotePrefix, text)
        self.assertEqual(self.book[MOVEMENTS_SHEET]["G2"].data_type, "s")

    def test_only_the_totals_are_formulas(self):
        with zipfile.ZipFile(io.BytesIO(self.data)) as archive:
            sheets = [name for name in archive.namelist() if name.startswith("xl/worksheets/sheet")]
            formulas = [formula for name in sheets for formula in re.findall(r"<f>(.*?)</f>", archive.read(name).decode())]

        self.assertEqual(len(formulas), 3)
        self.assertTrue(all("HYPERLINK" not in formula and "1+1" not in formula for formula in formulas))

    def test_control_characters_are_removed(self):
        self.assertEqual(clean_text("Ca\x00fé\x07 \x1b"), "Café ")


class SummaryAndBudgetSheetTests(unittest.TestCase):
    def test_summary_kpis_categories_and_chart(self):
        sheet = open_workbook(workbook_bytes(report()))[SUMMARY_SHEET]

        kpis = {sheet.cell(row=5, column=column).value: sheet.cell(row=6, column=column).value for column in range(2, 6)}
        self.assertEqual(kpis, {"INGRESOS": 4500, "GASTOS": 223.87, "NETO": 4276.13, "SALDO TOTAL": 1500})
        values = {sheet.cell(row=row, column=2).value: sheet.cell(row=row, column=3).value for row in range(1, sheet.max_row + 1)}
        self.assertEqual((values["Alimentación"], values["Transporte"], values["Total"]), (203.87, 20, 223.87))
        self.assertEqual(len(sheet._charts), 1)
        rules = [rule.type for ranges in sheet.conditional_formatting for rule in ranges.rules]
        self.assertIn("dataBar", rules)

    def test_history_adds_monthly_table_and_chart_without_budgets(self):
        items = (*ITEMS, movement("Sueldo", "4000.00", category="Salario", moment="2026-09-01T09:00:00-05:00"))
        book = open_workbook(workbook_bytes(report(month=None, items=items)))
        sheet = book[SUMMARY_SHEET]

        self.assertEqual(book.sheetnames, [MOVEMENTS_SHEET, SUMMARY_SHEET])
        labels = [sheet.cell(row=row, column=2).value for row in range(1, sheet.max_row + 1)]
        self.assertLessEqual({"Setiembre 2026", "Octubre 2026", "Noviembre 2026"}, set(labels))
        self.assertEqual(len(sheet._charts), 2)
        self.assertEqual(book[MOVEMENTS_SHEET]["A2"].value, "Historial completo: Setiembre 2026 – Noviembre 2026")

    def test_budget_sheet(self):
        sheet = open_workbook(workbook_bytes(report()))[BUDGETS_SHEET]

        rows = [[cell.value for cell in row[1:]] for row in sheet.iter_rows(min_row=FIRST_DATA_ROW, max_row=FIRST_DATA_ROW + 2)]
        self.assertEqual(rows[0], ["Alimentación", 300, 203.87, 96.13, 0.68, "Normal"])
        self.assertEqual(rows[1][-1], "Excedido")
        self.assertEqual(rows[2][:4], ["Total", 315, 223.87, 91.13])
        rules = [rule.type for ranges in sheet.conditional_formatting for rule in ranges.rules]
        self.assertEqual(rules, ["iconSet"])

    def test_no_budget_sheet_without_budgets(self):
        book = open_workbook(workbook_bytes(report(budgets=())))

        self.assertEqual(book.sheetnames, [MOVEMENTS_SHEET, SUMMARY_SHEET])


if __name__ == "__main__":
    unittest.main()
