"""Pruebas de ``GET /transacciones/exportar/`` en Excel (y la compatibilidad con CSV)."""

import csv
import io
from datetime import datetime, time
from decimal import Decimal

from openpyxl import load_workbook
from rest_framework.test import APIClient

from .models import FinanceBudget, FinanceTransaction
from .testing import API, FinanceAPITestCase, local_datetime
from .xlsx_export import (
    BUDGETS_SHEET,
    MOVEMENTS_SHEET,
    MOVEMENTS_TABLE,
    SUMMARY_KIND_LABELS,
    SUMMARY_KINDS,
    SUMMARY_SHEET,
    XLSX_MEDIA_TYPE,
)

EXPORT_URL = f"{API}/transacciones/exportar/"
INJECTION = '=HYPERLINK("http://x","y")'


def workbook(response):
    return load_workbook(io.BytesIO(response.content))


def movement_rows(book):
    sheet = book[MOVEMENTS_SHEET]
    return [[cell.value for cell in row] for row in list(sheet[sheet.tables[MOVEMENTS_TABLE].ref])[1:]]


def kpi_values(book):
    """Valores de las tarjetas del resumen: {'INGRESOS': ..., 'GASTOS': ..., 'NETO': ..., 'SALDO TOTAL': ...}."""
    sheet = book[SUMMARY_SHEET]
    return {sheet.cell(row=5, column=column).value: Decimal(str(sheet.cell(row=6, column=column).value)) for column in range(2, 6)}


class ExcelExportTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.account = self.open_account(balance="2000.00")
        self.wallet = self.open_account(name="Yape", balance="50.00")
        self.post_movement(self.account, "Sueldo", "Salario", "1500.00", "INGRESO", "2024-05-01T14:00:00Z")
        self.post_movement(self.account, INJECTION, "Alimentación", "45.50", "GASTO", "2024-05-24T03:30:00Z")
        self.post_movement(self.wallet, "Taxi", "Transporte", "10.00", "GASTO", "2024-05-25T12:00:00Z")
        self.post_movement(self.account, "Mercado", "Alimentación", "80.00", "GASTO", "2024-04-10T15:00:00Z")
        self.account.transfer_to(self.wallet, Decimal("100.00"), description="Recarga", occurred_at=local_datetime(2024, 5, 3))
        self.account.deposit(Decimal("30.00"), name="Depósito", occurred_at=local_datetime(2024, 5, 4))
        FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Alimentación", limit_amount=Decimal("50.00"))
        other = self.open_account(owner=self.other_user, balance="999.00")
        other.withdraw(Decimal("1.00"), name="Ajeno", category="Otros", occurred_at=local_datetime(2024, 5, 5))

    def export(self, client=None, accept="*/*", **params):
        return (client or self.client).get(EXPORT_URL, {"mes": "2024-05", **params}, HTTP_ACCEPT=accept)

    def test_excel_is_the_default_format(self):
        response = self.export()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], XLSX_MEDIA_TYPE)
        self.assertEqual(response["Content-Disposition"], 'attachment; filename="finova-movimientos-2024-05.xlsx"')
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(workbook(response).sheetnames, [MOVEMENTS_SHEET, SUMMARY_SHEET, BUDGETS_SHEET])

    def test_never_answers_406(self):
        for accept in (XLSX_MEDIA_TYPE, "*/*", "application/json", "text/html", "application/pdf"):
            response = self.export(accept=accept)
            self.assertEqual(response.status_code, 200, accept)
            self.assertEqual(response["Content-Type"], XLSX_MEDIA_TYPE, accept)
        self.assertEqual(self.export(format="json").status_code, 200)

    def test_one_row_per_movement_of_the_month(self):
        rows = movement_rows(workbook(self.export()))

        expected = FinanceTransaction.objects.filter(owner=self.user).in_period("2024-05").count()
        self.assertEqual(len(rows), expected)
        self.assertNotIn("Ajeno", [row[2] for row in rows])
        self.assertNotIn("Mercado", [row[2] for row in rows])
        taxi = next(row for row in rows if row[2] == "Taxi")
        self.assertEqual(taxi[:2], [datetime(2024, 5, 25), time(7, 0)])  # 12:00 UTC = 07:00 en Lima
        self.assertEqual(taxi[2:], ["Taxi", "Transporte", "Gasto", "Movimiento", "Yape", -10, "Completado"])

    def test_totals_match_the_app(self):
        book = workbook(self.export())
        listing = self.client.get(f"{API}/transacciones/", {"mes": "2024-05"}).data
        dashboard = self.client.get(f"{API}/dashboard/resumen/", {"mes": "2024-05"}).data

        kpis = kpi_values(book)
        expected = (listing["total_ingresos"], listing["total_gastos"], listing["neto"])
        self.assertEqual((kpis["INGRESOS"], kpis["GASTOS"], kpis["NETO"]), expected)
        expected = (dashboard["ingresos_mensuales"], dashboard["gastos_mensuales"])
        self.assertEqual((kpis["INGRESOS"], kpis["GASTOS"]), expected)
        self.assertEqual(kpis["SALDO TOTAL"], dashboard["balance_total"])
        self.assertEqual(kpis["INGRESOS"], Decimal("1530.00"))  # sueldo + depósito, sin la transferencia

    def test_filters_are_applied_and_described(self):
        book = workbook(self.export(tipo="GASTO", categoria="alimentacion", cuenta_id=self.account.id, search="hyper"))

        self.assertEqual([row[2] for row in movement_rows(book)], [INJECTION])
        caption = book[MOVEMENTS_SHEET]["A4"].value
        self.assertIn("Tipo: Gasto", caption)
        self.assertIn("Cuenta: Principal", caption)
        self.assertIn("Búsqueda: hyper", caption)

    def test_whole_history_in_one_file(self):
        response = self.export(todo="1", mes="")
        book = workbook(response)

        self.assertEqual(response["Content-Disposition"], 'attachment; filename="finova-historial-completo.xlsx"')
        self.assertEqual(book.sheetnames, [MOVEMENTS_SHEET, SUMMARY_SHEET])
        rows = movement_rows(book)
        self.assertEqual(len(rows), FinanceTransaction.objects.filter(owner=self.user).count())
        self.assertEqual({row[0].strftime("%Y-%m") for row in rows}, {"2024-01", "2024-04", "2024-05"})
        self.assertEqual(book[MOVEMENTS_SHEET]["A2"].value, "Historial completo: Enero 2024 – Mayo 2024")
        summary = [book[SUMMARY_SHEET].cell(row=row, column=2).value for row in range(1, book[SUMMARY_SHEET].max_row + 1)]
        self.assertTrue({"Enero 2024", "Febrero 2024", "Abril 2024", "Mayo 2024"} <= set(summary))

    def test_user_currency_formats_the_amounts(self):
        self.user.currency = "USD"
        self.user.save(update_fields=["currency"])

        book = workbook(self.export())

        amount = book[MOVEMENTS_SHEET].cell(row=7, column=8)
        self.assertEqual(amount.number_format, '"$" #,##0.00;-"$" #,##0.00')
        self.assertIn('"$"', book[SUMMARY_SHEET]["B6"].number_format)

    def test_user_text_is_never_a_formula(self):
        rows = list(workbook(self.export())[MOVEMENTS_SHEET].iter_rows(min_row=7))
        cell = next(row[2] for row in rows if row[2].value == INJECTION)

        self.assertEqual(cell.data_type, "s")
        self.assertTrue(cell.quotePrefix)

    def test_budget_sheet_matches_the_budgets_api(self):
        sheet = workbook(self.export())[BUDGETS_SHEET]
        budget = self.client.get(f"{API}/presupuestos/", {"mes": "2024-05"}).data["categorias"][0]

        values = [cell.value for cell in sheet[7][1:]]
        self.assertEqual(values[0], "Alimentación")
        self.assertEqual([Decimal(str(value)) for value in values[1:4]], [budget["presupuesto"], budget["gastado"], budget["restante"]])
        self.assertEqual(values[5], budget["estado"])

    def test_summary_kinds_match_the_model(self):
        self.assertEqual(SUMMARY_KINDS, tuple(FinanceTransaction.SUMMARY_KINDS))
        self.assertEqual(SUMMARY_KIND_LABELS, tuple(FinanceTransaction.Kind(kind).label for kind in FinanceTransaction.SUMMARY_KINDS))


class ExportErrorTests(FinanceAPITestCase):
    def export(self, client=None, accept="*/*", **params):
        return (client or self.client).get(EXPORT_URL, params, HTTP_ACCEPT=accept)

    def test_requires_session_and_answers_json(self):
        response = self.export(client=APIClient(), accept=XLSX_MEDIA_TYPE)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertIn("detail", response.json())

    def test_invalid_parameters_answer_json_in_spanish(self):
        cases = {
            "formato": {"formato": "pdf"},
            "mes": {"mes": "2024-13"},
            "todo": {"todo": "quizas"},
            "cuenta_id": {"cuenta_id": "999999"},
        }
        for field, params in cases.items():
            response = self.export(**params)
            self.assertEqual(response.status_code, 400, field)
            self.assertEqual(response["Content-Type"], "application/json", field)
            self.assertIn(field, response.json(), field)
        self.assertEqual(self.export(formato="pdf").json()["formato"], ["Formato no válido. Usa xlsx (Excel) o csv."])

    def test_empty_month_is_a_valid_workbook(self):
        response = self.export(mes="2024-02")

        self.assertEqual(response.status_code, 200)
        sheet = workbook(response)[MOVEMENTS_SHEET]
        self.assertEqual(sheet["A7"].value, "No hay movimientos para el período y los filtros elegidos.")


class CsvCompatibilityTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        account = self.open_account(balance="500.00")
        self.post_movement(account, "Taxi", "Transporte", "10.00", "GASTO", "2024-05-25T12:00:00Z")
        self.post_movement(account, "Mercado", "Alimentación", "20.00", "GASTO", "2024-04-25T12:00:00Z")

    def rows(self, response):
        return list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))

    def test_formato_csv_wins_over_the_accept_header(self):
        response = self.client.get(EXPORT_URL, {"mes": "2024-05", "formato": "csv"}, HTTP_ACCEPT=XLSX_MEDIA_TYPE)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn('filename="finova-transacciones-2024-05.csv"', response["Content-Disposition"])
        self.assertEqual([row[1] for row in self.rows(response)[1:]], ["Taxi"])

    def test_formato_xlsx_wins_over_accept_text_csv(self):
        response = self.client.get(EXPORT_URL, {"mes": "2024-05", "formato": "xlsx"}, HTTP_ACCEPT="text/csv")

        self.assertEqual(response["Content-Type"], XLSX_MEDIA_TYPE)

    def test_whole_history_as_csv(self):
        response = self.client.get(EXPORT_URL, {"todo": "1", "formato": "csv"})

        self.assertIn('filename="finova-historial-completo.csv"', response["Content-Disposition"])
        self.assertEqual({row[1] for row in self.rows(response)[1:]}, {"Taxi", "Mercado", "Saldo inicial"})

    def test_csv_errors_stay_csv(self):
        response = self.client.get(EXPORT_URL, {"mes": "2024-13", "formato": "csv"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("text/csv", response["Content-Type"])
        self.assertEqual(self.rows(response)[1][0], "mes")
