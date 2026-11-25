"""Motor de alertas contra la base de datos y API de alertas."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest import mock

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from .alert_service import ensure_alerts, evaluate_alerts
from .alerts import AlertLevel, AlertRule
from .models import AlertEvaluation, FinanceAlert, FinanceBudget, FinanceTransaction
from .periods import current_period, local_today, shift_month
from .testing import API, FinanceAPITestCase, local_datetime

ITEM_KEYS = {
    "id", "regla", "tipo", "categoria", "badge", "titulo", "descripcion", "nivel", "tiempo", "creada",
    "leida", "descartada", "pospuesta_hasta", "activa", "porcentaje", "periodo", "accion",
}
LEVEL_RANK = {"danger": 3, "warning": 2, "info": 1, "success": 0}


class AlertAPITestCase(FinanceAPITestCase):
    def setUp(self):
        super().setUp()
        self.account = self.open_account(balance="20000.00")
        self.period = current_period()

    def create_budget(self, category="Ocio", limit="100.00", month=None):
        response = self.client.post(
            f"{API}/presupuestos/", {"month": month or self.period, "category": category, "limit_amount": limit}, format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        return FinanceBudget.objects.get(pk=response.data["data"]["id"])

    def spend(self, amount, category="Ocio", when=None, name="Gasto"):
        return self.post_movement(self.account, name, category, amount, "GASTO", when or local_today().isoformat())

    def delete(self, movement):
        self.assertEqual(self.client.delete(f"{API}/transacciones/{movement.id}/").status_code, 204)

    def act(self, alert, action, **extra):
        return self.client.post(f"{API}/alertas/{alert.id}/accion/", {"action": action, **extra}, format="json")

    def alerts(self, **params):
        response = self.client.get(f"{API}/alertas/", params)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def threshold_alerts(self):
        return FinanceAlert.objects.filter(owner=self.user, rule=AlertRule.BUDGET_THRESHOLD)


class BudgetThresholdEngineTests(AlertAPITestCase):
    def test_one_alert_per_budget_escalates_with_each_expense(self):
        self.create_budget()
        self.spend("74.90")
        self.assertFalse(self.threshold_alerts().exists())

        self.spend("0.10")
        alert = self.threshold_alerts().get()
        self.assertEqual((alert.level, alert.severity, alert.percentage), (AlertLevel.WARNING, 2, 75.0))
        self.act(alert, "read")

        self.spend("15.00")
        alert.refresh_from_db()
        self.assertEqual((alert.level, alert.is_read), (AlertLevel.DANGER, False))

        self.spend("10.01")
        alert = self.threshold_alerts().get()
        self.assertEqual((alert.level, alert.severity, alert.title), (AlertLevel.DANGER, 4, "Presupuesto excedido: Ocio"))
        self.assertEqual(alert.action, {"type": "budget", "id": alert.budget_id, "mes": self.period})

    def test_deleting_expenses_de_escalates_and_then_removes_the_alert(self):
        self.create_budget()
        base = self.spend("60.00")
        self.spend("30.00")
        extra = self.spend("20.00")
        alert = self.threshold_alerts().get()
        self.act(alert, "read")

        self.delete(extra)
        alert.refresh_from_db()
        self.assertEqual((alert.level, alert.severity, alert.is_read), (AlertLevel.DANGER, 3, True))

        self.delete(base)
        self.assertFalse(self.threshold_alerts().exists())

    def test_raising_the_limit_resolves_the_alert(self):
        budget = self.create_budget()
        self.spend("80.00")

        response = self.client.patch(f"{API}/presupuestos/{budget.id}/", {"limit_amount": "200.00"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(self.threshold_alerts().exists())

    def test_dismissed_alert_is_not_recreated_until_it_escalates(self):
        self.create_budget()
        self.spend("80.00")
        alert = self.threshold_alerts().get()
        self.assertEqual(self.act(alert, "dismiss").status_code, 200)

        self.spend("1.00")
        self.assertEqual(self.threshold_alerts().count(), 1)
        self.assertTrue(self.threshold_alerts().get().dismissed)
        self.assertEqual(self.alerts(tipo="presupuesto")["items"], [])

        self.spend("10.00")
        alert.refresh_from_db()
        self.assertEqual((alert.dismissed, alert.is_read, alert.level), (False, False, AlertLevel.DANGER))
        self.assertEqual([item["id"] for item in self.alerts(tipo="presupuesto")["items"]], [alert.id])

    def test_deleting_the_budget_removes_its_alerts(self):
        budget = self.create_budget()
        self.spend("95.00")

        self.assertEqual(self.client.delete(f"{API}/presupuestos/{budget.id}/").status_code, 204)

        self.assertFalse(FinanceAlert.objects.filter(budget_id=budget.id).exists())

    def test_rebalance_and_copy_reevaluate_the_month(self):
        self.create_budget("Ocio", "100.00")
        self.create_budget("Comida", "500.00")
        self.spend("95.00")

        self.client.post(
            f"{API}/presupuestos/rebalancear/",
            {"month": self.period, "source_category": "Comida", "target_category": "Ocio", "amount": "100.00"},
            format="json",
        )
        self.assertFalse(self.threshold_alerts().exists())

        previous = shift_month(self.period, -1)
        FinanceBudget.objects.create(owner=self.user, month=previous, category="Salud", limit_amount=Decimal("10.00"))
        self.spend("20.00", category="Salud")
        self.client.post(f"{API}/presupuestos/copiar/", {"month": self.period, "source_month": previous}, format="json")
        self.assertEqual(self.threshold_alerts().get().title, "Presupuesto excedido: Salud")

    def test_alert_percentage_matches_the_budget_list(self):
        self.create_budget(limit="300.00")
        self.spend("250.00", category="  ocio ")

        item = self.client.get(f"{API}/presupuestos/").data["categorias"][0]

        self.assertEqual(self.threshold_alerts().get().percentage, item["porcentaje"])


class AtypicalExpenseEngineTests(AlertAPITestCase):
    def setUp(self):
        super().setUp()
        for months_back, amount in zip(range(1, 6), ("10.00", "12.00", "11.00", "9.00", "13.00")):
            self.spend(amount, category="Taxi", when=f"{shift_month(self.period, -months_back)}-10")

    def atypical(self):
        return FinanceAlert.objects.filter(owner=self.user, rule=AlertRule.ATYPICAL_EXPENSE)

    def test_unusual_expense_gets_one_alert_removed_with_the_transaction(self):
        self.spend("12.00", category="Taxi")
        self.assertFalse(self.atypical().exists())

        unusual = self.spend("40.00", category="Taxi", name="Taxi al aeropuerto")
        alert = self.atypical().get()
        self.assertEqual((alert.transaction_id, alert.level, alert.period), (unusual.id, AlertLevel.WARNING, self.period))
        self.assertEqual(alert.action, {"type": "transaction", "id": unusual.id, "mes": self.period})

        self.delete(unusual)
        self.assertFalse(self.atypical().exists())

    def test_alert_follows_the_transaction_when_edited(self):
        unusual = self.spend("40.00", category="Taxi")

        self.client.patch(f"{API}/transacciones/{unusual.id}/", {"amount": "12.00"}, format="json")

        self.assertFalse(self.atypical().exists())

    def test_deleting_the_transaction_cascades_to_its_alert(self):
        unusual = self.spend("40.00", category="Taxi")

        FinanceTransaction.objects.filter(pk=unusual.pk).delete()

        self.assertFalse(self.atypical().exists())


class EvaluationServiceTests(AlertAPITestCase):
    TODAY = date(2024, 5, 25)

    def evaluate(self, period="2024-05", today=TODAY):
        return evaluate_alerts(self.user, period, today=today)

    def test_negative_month_after_day_twenty_and_when_closed(self):
        self.account.deposit(Decimal("100.00"), occurred_at=local_datetime(2024, 5, 2))
        self.account.withdraw(Decimal("300.00"), name="Compras", category="Hogar", occurred_at=local_datetime(2024, 5, 3))

        self.evaluate(today=date(2024, 5, 20))
        self.assertFalse(FinanceAlert.objects.filter(rule=AlertRule.NEGATIVE_MONTH).exists())

        self.evaluate(today=date(2024, 5, 21))
        alert = FinanceAlert.objects.get(rule=AlertRule.NEGATIVE_MONTH)
        self.assertEqual((alert.dedupe_key, alert.title), ("negative_month:2024-05", "Tus gastos superan tus ingresos en Mayo 2024"))

        self.evaluate(today=date(2024, 6, 2))
        alert.refresh_from_db()
        self.assertEqual(alert.title, "Mayo 2024 cerró en negativo")

    def test_transfers_adjustments_and_openings_do_not_count(self):
        other = self.open_account(name="Otra", opened_at=local_datetime(2024, 5, 1))
        self.account.transfer_to(other, Decimal("500.00"), occurred_at=local_datetime(2024, 5, 4))
        other.adjust_balance(Decimal("0.00"), occurred_at=local_datetime(2024, 5, 5))

        self.assertEqual(self.evaluate().create, ())

    def test_months_outside_the_window_are_ignored_and_old_alerts_expire(self):
        FinanceBudget.objects.create(owner=self.user, month="2024-05", category="Ocio", limit_amount=Decimal("10.00"))
        self.account.withdraw(Decimal("50.00"), name="Cine", category="Ocio", occurred_at=local_datetime(2024, 5, 3))

        self.assertEqual(evaluate_alerts(self.user, "2024-05").create, ())
        self.evaluate()
        self.assertTrue(FinanceAlert.objects.filter(period="2024-05").exists())

        evaluate_alerts(self.user)
        self.assertFalse(FinanceAlert.objects.filter(period="2024-05").exists())

    def test_same_key_of_another_user_is_untouched(self):
        foreign = FinanceAlert.objects.create(
            owner=self.other_user, title="Ajena", description="x", dedupe_key="negative_month:2024-05",
            rule=AlertRule.NEGATIVE_MONTH, period="2024-05",
        )
        self.account.withdraw(Decimal("10.00"), name="Menú", category="Comida", occurred_at=local_datetime(2024, 5, 3))

        self.evaluate()

        foreign.refresh_from_db()
        self.assertEqual(foreign.title, "Ajena")
        mine = FinanceAlert.objects.get(owner=self.user)
        self.assertEqual((mine.dedupe_key, mine.title), ("negative_month:2024-05", "Tus gastos superan tus ingresos en Mayo 2024"))

    def test_evaluation_uses_a_constant_number_of_queries(self):
        def scenario(budgets, expenses_per_budget):
            FinanceAlert.objects.all().delete()
            FinanceBudget.objects.all().delete()
            for index in range(budgets):
                FinanceBudget.objects.create(owner=self.user, month="2024-05", category=f"Cat {index}", limit_amount=Decimal("100.00"))
                for _ in range(expenses_per_budget):
                    self.account.withdraw(Decimal("30.00"), name="Gasto", category=f"Cat {index}", occurred_at=local_datetime(2024, 5, 3))
            with CaptureQueriesContext(connection) as queries:
                plan = self.evaluate()
            self.assertGreaterEqual(len(plan.create), budgets)
            return len(queries)

        small, large = scenario(2, 3), scenario(8, 4)

        self.assertEqual(small, large)
        self.assertLessEqual(large, 10)


class LazyEvaluationTests(AlertAPITestCase):
    def setUp(self):
        super().setUp()
        FinanceBudget.objects.create(owner=self.user, month=self.period, category="Ocio", limit_amount=Decimal("100.00"))
        self.account.withdraw(Decimal("80.00"), name="Cine", category="Ocio")

    def test_alerts_endpoint_evaluates_once_per_day(self):
        self.assertFalse(FinanceAlert.objects.exists())

        first = self.alerts()
        self.account.withdraw(Decimal("15.00"), name="Cine", category="Ocio")
        second = self.alerts()

        titles = [item["titulo"] for item in first["items"] if item["regla"] == AlertRule.BUDGET_THRESHOLD]
        self.assertEqual(titles, ["Presupuesto de Ocio al 80%"])
        self.assertEqual(second["items"], first["items"])
        self.assertTrue(AlertEvaluation.objects.filter(owner=self.user, period=self.period).exists())
        self.assertTrue(AlertEvaluation.objects.filter(owner=self.user, period=shift_month(self.period, -1)).exists())

    def test_dashboard_evaluates_the_requested_month(self):
        data = self.client.get(f"{API}/dashboard/resumen/").data
        self.client.get(f"{API}/dashboard/resumen/", {"mes": "2024-05"})

        titles = [alert["titulo"] for alert in data["alertas_activas"] if alert["regla"] == AlertRule.BUDGET_THRESHOLD]
        self.assertEqual(titles, ["Presupuesto de Ocio al 80%"])
        self.assertFalse(AlertEvaluation.objects.filter(period="2024-05").exists())

    def test_stale_evaluation_is_refreshed(self):
        ensure_alerts(self.user)
        AlertEvaluation.objects.update(evaluated_at=timezone.now() - timedelta(days=2))
        self.account.withdraw(Decimal("15.00"), name="Cine", category="Ocio")

        self.alerts()

        self.assertEqual(self.threshold_alerts().get().level, AlertLevel.DANGER)

    def test_changing_currency_rewrites_alert_texts(self):
        ensure_alerts(self.user)
        self.user.currency = "USD"
        self.user.save(update_fields=["currency"])

        self.alerts()

        self.assertIn("Llevas $ 80.00 de $ 100.00", self.threshold_alerts().get().description)

    def test_fresh_alert_list_uses_three_queries(self):
        self.alerts()

        with CaptureQueriesContext(connection) as queries:
            self.alerts(estado="todas")

        self.assertLessEqual(len(queries), 3)

    def test_engine_failure_does_not_break_the_operation(self):
        with mock.patch("core.views.refresh_alerts", side_effect=RuntimeError("boom")), self.assertLogs("core.views", "ERROR"):
            movement = self.spend("5.00")

        self.assertTrue(FinanceTransaction.objects.filter(pk=movement.pk).exists())


class AlertListAPITests(AlertAPITestCase):
    def setUp(self):
        super().setUp()
        self.create_budget("Ocio", "100.00")
        self.create_budget("Comida", "100.00")
        self.spend("80.00", "Ocio")
        self.spend("120.00", "Comida")
        self.legacy = FinanceAlert.objects.create(owner=self.user, title="Aviso", description="Detalle", level=AlertLevel.SUCCESS)
        self.ocio = self.threshold_alerts().get(budget__category="Ocio")
        self.comida = self.threshold_alerts().get(budget__category="Comida")

    def test_shape_counts_and_filters(self):
        self.act(self.ocio, "read")
        self.act(self.legacy, "dismiss")

        data = self.alerts()

        self.assertEqual(set(data), {"estado", "tipo", "counts", "filters", "items"})
        active = FinanceAlert.objects.filter(owner=self.user).active().count()
        self.assertEqual(data["counts"], {"activas": active, "no_leidas": active - 1, "total": active + 1})
        self.assertEqual(data["filters"][:2], [f"Todas ({active})", "Presupuesto (2)"])
        self.assertNotIn("General (0)", data["filters"])
        item = next(item for item in data["items"] if item["id"] == self.comida.id)
        self.assertEqual(set(item), ITEM_KEYS)
        self.assertEqual((item["regla"], item["tipo"], item["nivel"], item["tiempo"]), ("budget_threshold", "Presupuesto", "danger", "Ahora"))
        self.assertEqual(item["accion"], {"label": "Ajustar presupuesto", "type": "budget", "id": self.comida.budget_id, "mes": self.period})
        self.assertEqual((item["porcentaje"], item["periodo"], item["leida"], item["pospuesta_hasta"]), (120.0, self.period, False, None))

    def test_items_are_ordered_by_level_then_recency(self):
        items = self.alerts()["items"]
        ranks = [LEVEL_RANK[item["nivel"]] for item in items]

        self.assertEqual(items[0]["id"], self.comida.id)  # excedido: la más grave
        self.assertEqual(items[-1]["id"], self.legacy.id)
        self.assertEqual(ranks, sorted(ranks, reverse=True))

    def test_estado_and_tipo_filters(self):
        self.act(self.ocio, "dismiss")

        self.assertNotIn(self.ocio.id, [item["id"] for item in self.alerts()["items"]])
        everything = self.alerts(estado="todas")
        self.assertIn(self.ocio.id, [item["id"] for item in everything["items"]])
        self.assertEqual(everything["filters"][0], f"Todas ({everything['counts']['total']})")
        for tipo in ("budget_threshold", "Presupuesto", "danger"):
            self.assertEqual([item["id"] for item in self.alerts(tipo=tipo)["items"]], [self.comida.id], tipo)
        self.assertEqual([item["id"] for item in self.alerts(tipo="General")["items"]], [self.legacy.id])
        self.assertEqual(self.alerts(tipo="Vencimientos")["items"], [])
        self.assertEqual(self.client.get(f"{API}/alertas/", {"estado": "otras"}).status_code, 400)

    def test_snoozed_alert_reappears_after_expiry(self):
        response = self.act(self.ocio, "snooze")

        self.assertEqual(response.data["message"], "Alerta pospuesta por 24 horas.")
        self.assertIsNotNone(response.data["data"]["pospuesta_hasta"])
        self.assertNotIn(self.ocio.id, [item["id"] for item in self.alerts()["items"]])

        FinanceAlert.objects.filter(pk=self.ocio.pk).update(snoozed_until=timezone.now() - timedelta(minutes=1))
        self.assertIn(self.ocio.id, [item["id"] for item in self.alerts()["items"]])

    def test_actions(self):
        read = self.act(self.ocio, "read")
        unread = self.act(self.ocio, "unread")
        snoozed = self.act(self.ocio, "postpone", hours=2)
        restored = self.act(self.ocio, "restore")
        discarded = self.act(self.ocio, "discard")

        self.assertEqual((read.data["message"], read.data["data"]["leida"]), ("Alerta marcada como leída.", True))
        self.assertFalse(unread.data["data"]["leida"])
        expected = timezone.now() + timedelta(hours=2)
        self.assertAlmostEqual(datetime.fromisoformat(snoozed.data["data"]["pospuesta_hasta"]).timestamp(), expected.timestamp(), delta=5)
        self.assertTrue(restored.data["data"]["activa"])
        self.assertEqual((discarded.data["message"], discarded.data["data"]["descartada"]), ("Alerta descartada.", True))
        self.assertEqual(self.act(self.comida, "confirm").status_code, 200)

    def test_invalid_actions(self):
        foreign = FinanceAlert.objects.create(owner=self.other_user, title="Ajena", description="x")

        invalid = self.act(self.ocio, "explode")
        zero_hours = self.act(self.ocio, "snooze", hours=0)
        not_mine = self.act(foreign, "read")

        self.assertEqual((invalid.status_code, invalid.data["action"]), (400, ["Acción de alerta no válida."]))
        self.assertEqual(zero_hours.status_code, 400)
        self.assertEqual((not_mine.status_code, not_mine.data["detail"]), (404, "Alerta no encontrada."))

    def test_silence_all_snoozes_instead_of_dismissing(self):
        active = FinanceAlert.objects.filter(owner=self.user).active().count()

        response = self.client.post(f"{API}/alertas/silenciar-todo/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["pospuestas"], active)
        self.assertEqual(response.data["message"], f"Se silenciaron {active} alertas por 24 horas.")
        self.assertEqual(self.alerts()["items"], [])
        self.assertFalse(FinanceAlert.objects.filter(owner=self.user, dismissed=True).exists())
        again = self.client.post(f"{API}/alertas/silenciar-todo/", {"hours": 1}, format="json")
        self.assertEqual((again.data["pospuestas"], again.data["message"]), (0, "No tienes alertas activas para silenciar."))

    def test_dashboard_shows_the_top_three_with_legacy_keys(self):
        FinanceAlert.objects.create(owner=self.user, title="Otra", description="x", level=AlertLevel.INFO)

        data = self.client.get(f"{API}/dashboard/resumen/").data
        alerts = data["alertas_activas"]

        self.assertEqual(len(alerts), 3)
        self.assertEqual(data["alertas_pendientes"], FinanceAlert.objects.filter(owner=self.user).active().count())
        self.assertEqual(alerts[0]["id"], self.comida.id)
        self.assertEqual((alerts[0]["tipo"], alerts[0]["accion"], alerts[0]["nivel"]), ("danger", "Ajustar presupuesto", "danger"))
        self.assertEqual(alerts[0]["accion_detalle"]["type"], "budget")
        self.assertEqual(alerts[1]["tipo"], "warning")
        self.assertTrue(all(alert["tipo"] in {"danger", "warning", "info"} for alert in alerts))


class BudgetInsightAPITests(AlertAPITestCase):
    def test_suggestion_is_a_valid_rebalance(self):
        self.create_budget("Ocio", "100.00")
        self.create_budget("Ahorro", "1000.00")
        self.spend("110.00", "Ocio")

        insight = self.client.get(f"{API}/presupuestos/").data["ia_alert"]
        action = insight["accion"]

        self.assertEqual((action["type"], action["source_category"], action["target_category"]), ("rebalance", "Ahorro", "Ocio"))
        self.assertEqual(insight["titulo"], "Ocio ya superó su presupuesto")
        payload = {key: action[key] for key in ("month", "source_category", "target_category", "amount")}
        self.assertEqual(self.client.post(f"{API}/presupuestos/rebalancear/", payload, format="json").status_code, 200)

    def test_positive_message_when_under_control(self):
        self.create_budget("Ocio", "1000.00")

        insight = self.client.get(f"{API}/presupuestos/").data["ia_alert"]

        self.assertEqual((insight["titulo"], insight["nivel"], insight["accion"]), ("Vas bien este mes", "success", None))
