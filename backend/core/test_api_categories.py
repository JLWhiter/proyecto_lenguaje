"""Categorías sin importar mayúsculas, espacios ni tildes, y su forma al guardar."""

from decimal import Decimal

from .categories import category_key
from .models import FinanceBudget, FinanceTransaction
from .periods import current_period, shift_month
from .testing import API, FinanceAPITestCase, local_datetime


class AccentInsensitiveCategoryTests(FinanceAPITestCase):
    """Datos guardados con otra forma (sin pasar por la API) cuentan en la misma categoría."""

    def setUp(self):
        super().setUp()
        self.account = self.open_account(balance="2000.00")

    def spend(self, amount, category, day=2, name="Gasto"):
        return self.account.withdraw(Decimal(amount), name=name, category=category, occurred_at=local_datetime(2024, 5, day))

    def test_unaccented_expenses_count_toward_the_budget(self):
        FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Alimentación", limit_amount=Decimal("200.00"))
        self.spend("50.00", "Alimentacion")
        self.spend("30.00", " ALIMENTACION ", day=3)

        item = self.client.get(f"{API}/presupuestos/", {"mes": "2024-05"}).data["categorias"][0]
        dashboard = self.client.get(f"{API}/dashboard/resumen/", {"mes": "2024-05"}).data

        self.assertEqual((item["gastado"], item["porcentaje"]), (Decimal("80.00"), 40.0))
        self.assertEqual(dashboard["presupuesto_consumido"], Decimal("80.00"))
        self.assertEqual([(entry["value"], entry["monto"]) for entry in dashboard["distribucion_gastos"]], [(100.0, 80.0)])

    def test_filter_and_search_ignore_accents(self):
        self.spend("10.00", "Alimentación", name="Menú del día")
        self.spend("20.00", "Alimentacion", name="Mercado")
        self.spend("5.00", "Transporte", name="Taxi")

        def names(**params):
            data = self.client.get(f"{API}/transacciones/", {"mes": "2024-05", **params}).data
            return sorted(item["nombre"] for group in data["grupos"] for item in group["items"])

        self.assertEqual(names(categoria="alimentacion"), ["Menú del día", "Mercado"])
        self.assertEqual(names(categoria="ALIMENTACIÓN"), ["Menú del día", "Mercado"])
        self.assertEqual(names(search="menu"), ["Menú del día"])

    def test_budget_duplicates_ignore_accents(self):
        FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Alimentación", limit_amount=Decimal("200.00"))

        response = self.client.post(
            f"{API}/presupuestos/", {"month": "2024-05", "category": "alimentacion", "limit_amount": "10.00"}, format="json"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["category"], ["Ya existe un presupuesto para esta categoría en este mes."])

    def test_rebalance_and_copy_match_budgets_ignoring_accents(self):
        FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Educacion", limit_amount=Decimal("100.00"))
        FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Ocio", limit_amount=Decimal("100.00"))
        FinanceBudget.objects.create(owner=self.user, month="2024-06", category="Educación", limit_amount=Decimal("100.00"))

        rebalance = self.client.post(
            f"{API}/presupuestos/rebalancear/",
            {"month": "2024-05", "source_category": "educación", "target_category": "ocio", "amount": "40.00"},
            format="json",
        )
        copy = self.client.post(f"{API}/presupuestos/copiar/", {"month": "2024-06", "source_month": "2024-05"}, format="json")

        self.assertEqual((rebalance.status_code, rebalance.data["transfer"]["origen"]), (200, "Educacion"))
        self.assertEqual((copy.data["copiados"], copy.data["omitidos"]), (1, 1))
        self.assertEqual(
            sorted(FinanceBudget.objects.filter(month="2024-06").values_list("category", flat=True)), ["Educación", "Ocio"]
        )


class CategoryCatalogMergeTests(FinanceAPITestCase):
    def test_spellings_with_the_same_key_are_one_entry(self):
        account = self.open_account(balance="500.00")
        for category in ("Alimentacion", "Alimentacion", "ALIMENTACIÓN", "Café", "Café", "Cafe"):
            account.withdraw(Decimal("5.00"), name="Gasto", category=category, occurred_at=local_datetime(2024, 5, 2))
        FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Educacion", limit_amount=Decimal("10.00"))

        categories = self.client.get(f"{API}/categorias/").data["categorias"]

        by_name = {item["nombre"]: item for item in categories}
        self.assertEqual(len({category_key(item["nombre"]) for item in categories}), len(categories))
        self.assertEqual((by_name["Alimentación"]["movimientos"], by_name["Alimentación"]["predeterminada"]), (3, True))
        self.assertEqual(by_name["Café"], {"nombre": "Café", "predeterminada": False, "tipos": ["GASTO"], "movimientos": 3})
        self.assertIn("Educación", by_name)
        self.assertNotIn("Educacion", by_name)
        self.assertEqual([item["nombre"] for item in categories[:2]], ["Alimentación", "Café"])


class CanonicalCategoryOnWriteTests(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.account = self.open_account(balance="1000.00")

    def create(self, category, **extra):
        payload = {"name": "Gasto", "category": category, "amount": "10.00", "type": "GASTO", "account_id": self.account.id, **extra}
        response = self.client.post(f"{API}/transacciones/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["data"]

    def edit(self, movement, category):
        response = self.client.patch(f"{API}/transacciones/{movement.id}/", {"category": category}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        movement.refresh_from_db()
        return movement.category

    def legacy(self, category):
        """Movimiento guardado sin pasar por la API (con la forma tal cual)."""
        return self.account.withdraw(Decimal("1.00"), name="Antiguo", category=category, occurred_at=local_datetime(2024, 5, 2))

    def test_new_movement_uses_the_default_spelling(self):
        item = self.create("  alimentacion ")

        self.assertEqual(item["categoria"], "Alimentación")
        self.assertEqual(FinanceTransaction.objects.get(pk=item["id"]).category, "Alimentación")

    def test_new_movement_uses_the_spelling_the_user_already_has(self):
        self.legacy("Pensión")
        FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Música", limit_amount=Decimal("10.00"))

        self.assertEqual(self.create("PENSION")["categoria"], "Pensión")
        self.assertEqual(self.create("musica")["categoria"], "Música")
        self.assertEqual(self.create("viajes")["categoria"], "Viajes")

    def test_editing_a_movement_canonicalizes_the_category(self):
        movement = self.legacy("Otros")

        self.assertEqual(self.edit(movement, "educacion"), "Educación")

    def test_a_movement_can_fix_its_own_spelling_if_nothing_else_uses_it(self):
        only = self.legacy("Cafe")

        self.assertEqual(self.edit(only, "Café"), "Café")

        self.legacy("Cafe")
        self.assertEqual(self.edit(only, "Café"), "Cafe")  # otro movimiento ya la usa así

    def test_budgets_are_saved_with_the_existing_spelling(self):
        self.legacy("Pensión")

        created = self.client.post(f"{API}/presupuestos/", {"month": current_period(), "category": "pension", "limit_amount": "50.00"}, format="json")
        budget = FinanceBudget.objects.get(pk=created.data["data"]["id"])
        renamed = self.client.patch(f"{API}/presupuestos/{budget.id}/", {"category": "salud"}, format="json")

        self.assertEqual((created.status_code, created.data["data"]["categoria"]), (201, "Pensión"))
        self.assertEqual((renamed.status_code, renamed.data["data"]["categoria"]), (200, "Salud"))

    def test_budgets_reuse_the_spelling_of_other_months(self):
        FinanceBudget.objects.create(owner=self.user, month=shift_month(current_period(), -1), category="Música", limit_amount=Decimal("10.00"))

        response = self.client.post(f"{API}/presupuestos/", {"category": "MUSICA", "limit_amount": "20.00"}, format="json")

        self.assertEqual((response.status_code, response.data["data"]["categoria"]), (201, "Música"))

    def test_a_budget_can_fix_its_own_spelling(self):
        budget = FinanceBudget.objects.create(owner=self.user, month=current_period(), category="Musica", limit_amount=Decimal("10.00"))

        response = self.client.patch(f"{API}/presupuestos/{budget.id}/", {"category": "Música"}, format="json")

        self.assertEqual((response.status_code, response.data["data"]["categoria"]), (200, "Música"))
