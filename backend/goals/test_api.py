"""API de metas de ahorro (``/api/v1/metas/``), reglas del modelo y alertas de metas."""

from datetime import timedelta
from decimal import Decimal
from io import StringIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.alerts import AlertLevel, AlertRule
from core.exceptions import OperacionNoPermitidaError
from core.models import AlertEvaluation, FinanceAccount, FinanceAlert, FinanceTransaction
from core.money import money
from core.testing import API, FinanceAPITestCase

from .exceptions import AhorroInsuficienteError
from .models import ContributionKind, GoalContribution, SavingsGoal

METAS = f"{API}/metas/"
GOAL_KEYS = {
    "id", "nombre", "descripcion", "icono", "objetivo", "ahorrado", "restante", "porcentaje", "fecha_objetivo",
    "meses_restantes", "ahorro_mensual_necesario", "porcentaje_esperado", "estado", "estado_color", "fecha_estimada",
    "archivada", "creada",
}


def days_from_today(days):
    return timezone.localdate() + timedelta(days=days)


class GoalAPITestCase(FinanceAPITestCase):
    def create(self, **payload):
        body = {"name": "Laptop nueva", "target_amount": "3500.00", "target_date": days_from_today(120).isoformat(), **payload}
        return self.client.post(METAS, body, format="json")

    def make_goal(self, name="Viaje a Cusco", target="2000.00", age_days=90, target_in_days=60, owner=None, **extra):
        """Meta creada hace ``age_days`` días (las del API siempre nacen hoy)."""
        return SavingsGoal.objects.create(
            owner=owner or self.user, name=name, target_amount=Decimal(target), target_date=days_from_today(target_in_days),
            created_at=timezone.now() - timedelta(days=age_days), **extra,
        )

    def move(self, goal, tipo, amount, **extra):
        return self.client.post(f"{METAS}{goal.id}/aportes/", {"tipo": tipo, "amount": amount, **extra}, format="json")

    def goal_alerts(self):
        return FinanceAlert.objects.filter(owner=self.user, rule__in=(AlertRule.GOAL_BEHIND, AlertRule.GOAL_REACHED))


class GoalCrudTests(GoalAPITestCase):
    def test_create_with_initial_amount(self):
        response = self.create(name="  Laptop   nueva ", icon="laptop", description="Para estudiar", initial_amount="500.00")

        self.assertEqual(response.status_code, 201, response.data)
        data = response.data["data"]
        self.assertEqual(response.data["message"], "Meta creada.")
        self.assertTrue(GOAL_KEYS <= set(data))
        self.assertEqual((data["nombre"], data["icono"], data["estado"], data["estado_color"]), ("Laptop nueva", "laptop", "En curso", "sky"))
        self.assertEqual((data["objetivo"], data["ahorrado"], data["restante"]), (Decimal("3500.00"), Decimal("500.00"), Decimal("3000.00")))
        self.assertEqual((data["porcentaje"], data["porcentaje_esperado"]), (14.3, 0.0))
        self.assertEqual(data["creada"], timezone.localdate().isoformat())
        self.assertEqual([(item["tipo"], item["monto"], item["nota"]) for item in data["aportes"]], [("APORTE", Decimal("500.00"), "Monto inicial")])
        self.assertEqual(len(data["serie_mensual"]), 12)
        self.assertEqual(data["serie_mensual"][-1]["aportado"], Decimal("500.00"))
        self.assertIsNotNone(data["fecha_estimada"])

    def test_create_without_initial_amount_defaults(self):
        data = self.create().data["data"]

        self.assertEqual((data["icono"], data["descripcion"], data["ahorrado"], data["aportes"]), ("piggy", "", Decimal("0.00"), []))
        self.assertIsNone(data["fecha_estimada"])

    def test_validation_errors_are_in_spanish_per_field(self):
        response = self.create(name="  ", target_amount="0", target_date=timezone.localdate().isoformat(), icon="rocket")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["name"], ["Escribe un nombre para tu meta."])
        self.assertEqual(response.data["target_amount"], ["El monto debe ser mayor que cero."])
        self.assertEqual(response.data["target_date"], ["La fecha objetivo debe ser posterior a hoy."])
        self.assertEqual(response.data["icon"], ["Elige un ícono válido."])
        self.assertEqual(self.create(target_date="31/12/2027").data["target_date"], ["Ingresa una fecha válida (AAAA-MM-DD)."])
        self.assertEqual(self.create(initial_amount="-1").data["initial_amount"], ["El monto no puede ser negativo."])
        self.assertFalse(SavingsGoal.objects.exists())

    def test_active_names_are_unique_ignoring_case_and_accents(self):
        self.assertEqual(self.create(name="Viaje a Cusco").status_code, 201)

        duplicate = self.create(name="VIAJE A CÚSCO")

        self.assertEqual((duplicate.status_code, duplicate.data["name"]), (400, ["Ya tienes una meta activa con ese nombre."]))
        SavingsGoal.objects.update(archived=True)
        self.assertEqual(self.create(name="viaje a cusco").status_code, 201)

    def test_list_summary_and_archived_tab(self):
        reached = self.make_goal("Celular", target="500.00")
        reached.contribute(Decimal("500.00"), occurred_at=timezone.localdate())
        self.make_goal("Moto", target="1000.00", archived=True)
        self.create(initial_amount="700.00")

        active = self.client.get(METAS).data
        archived = self.client.get(METAS, {"estado": "archivadas"}).data

        self.assertEqual(active["resumen"], {"total_objetivo": Decimal("4000.00"), "total_ahorrado": Decimal("1200.00"), "metas_activas": 2, "alcanzadas": 1})
        self.assertEqual([goal["nombre"] for goal in active["metas"]], ["Celular", "Laptop nueva"])
        self.assertTrue(all(set(goal) == GOAL_KEYS for goal in active["metas"]))
        self.assertEqual([goal["nombre"] for goal in archived["metas"]], ["Moto"])
        self.assertEqual(archived["resumen"], active["resumen"])
        bad = self.client.get(METAS, {"estado": "otras"})
        self.assertEqual((bad.status_code, bad.data["estado"]), (400, ["Usa estado=activas o estado=archivadas."]))

    def test_detail_lists_movements_newest_first(self):
        goal = self.make_goal()
        goal.contribute(Decimal("300.00"), occurred_at=days_from_today(-60))
        goal.withdraw(Decimal("50.00"), occurred_at=days_from_today(-10), note="Imprevisto")
        goal.contribute(Decimal("80.00"), occurred_at=days_from_today(-30))

        data = self.client.get(f"{METAS}{goal.id}/").data

        self.assertEqual([(item["tipo"], item["monto"]) for item in data["aportes"]], [("RETIRO", Decimal("50.00")), ("APORTE", Decimal("80.00")), ("APORTE", Decimal("300.00"))])
        self.assertEqual(data["aportes"][0]["fecha"], days_from_today(-10).isoformat())
        self.assertEqual(data["ahorrado"], Decimal("330.00"))
        self.assertEqual(sum(item["aportado"] for item in data["serie_mensual"]), Decimal("330.00"))

    def test_patch_updates_fields_and_archives(self):
        goal = self.make_goal()

        renamed = self.client.patch(f"{METAS}{goal.id}/", {"name": "Cusco y Machu Picchu", "target_amount": "2500.00", "icon": "plane"}, format="json")
        archived = self.client.patch(f"{METAS}{goal.id}/", {"archived": True}, format="json")
        restored = self.client.patch(f"{METAS}{goal.id}/", {"archived": False}, format="json")

        self.assertEqual((renamed.status_code, renamed.data["message"]), (200, "Meta actualizada."))
        self.assertEqual((renamed.data["data"]["nombre"], renamed.data["data"]["objetivo"]), ("Cusco y Machu Picchu", Decimal("2500.00")))
        self.assertEqual((archived.data["message"], archived.data["data"]["archivada"]), ("Meta archivada.", True))
        self.assertEqual((restored.data["message"], restored.data["data"]["archivada"]), ("Meta restaurada.", False))

    def test_patch_target_date_rules(self):
        overdue = self.make_goal(target_in_days=-5)

        same = self.client.patch(f"{METAS}{overdue.id}/", {"target_date": overdue.target_date.isoformat(), "description": "x"}, format="json")
        past = self.client.patch(f"{METAS}{overdue.id}/", {"target_date": days_from_today(-1).isoformat()}, format="json")
        extended = self.client.patch(f"{METAS}{overdue.id}/", {"target_date": days_from_today(30).isoformat()}, format="json")

        self.assertEqual(same.status_code, 200)
        self.assertEqual((past.status_code, past.data["target_date"]), (400, ["La fecha objetivo debe ser posterior a hoy."]))
        self.assertEqual(extended.data["data"]["fecha_objetivo"], days_from_today(30).isoformat())

    def test_restoring_requires_a_free_name(self):
        old = self.make_goal("Viaje", archived=True)
        self.make_goal("viaje")

        response = self.client.patch(f"{METAS}{old.id}/", {"archived": False}, format="json")
        renamed = self.client.patch(f"{METAS}{old.id}/", {"archived": False, "name": "Viaje 2027"}, format="json")

        self.assertEqual((response.status_code, response.data["name"]), (400, ["Ya tienes una meta activa con ese nombre."]))
        self.assertEqual(renamed.status_code, 200)

    def test_delete_removes_goal_and_movements(self):
        goal = self.make_goal()
        goal.contribute(Decimal("100.00"))

        self.assertEqual(self.client.delete(f"{METAS}{goal.id}/").status_code, 204)

        self.assertFalse(GoalContribution.objects.exists())
        self.assertEqual(self.client.get(f"{METAS}{goal.id}/").status_code, 404)

    def test_other_users_goals_are_not_found(self):
        foreign = self.make_goal(owner=self.other_user)
        foreign.contribute(Decimal("100.00"))
        movement = foreign.contributions.get()
        url = f"{METAS}{foreign.id}/"

        responses = [
            self.client.get(url),
            self.client.patch(url, {"name": "Mía"}, format="json"),
            self.client.delete(url),
            self.move(foreign, "APORTE", "10.00"),
            self.client.delete(f"{url}aportes/{movement.id}/"),
        ]

        self.assertEqual({response.status_code for response in responses}, {404})
        self.assertEqual(responses[0].data["detail"], "Meta no encontrada.")
        self.assertEqual(self.client.get(METAS).data["metas"], [])
        self.assertTrue(SavingsGoal.objects.filter(pk=foreign.pk, name="Viaje a Cusco").exists())

    def test_requires_a_session(self):
        self.assertIn(APIClient().get(METAS).status_code, (401, 403))


class ContributionTests(GoalAPITestCase):
    def setUp(self):
        super().setUp()
        self.goal = self.make_goal(age_days=40)

    def test_contribute_and_withdraw(self):
        deposit = self.move(self.goal, "APORTE", "300.00", note="  Gratificación  ", occurred_at=days_from_today(-3).isoformat())
        withdrawal = self.move(self.goal, "RETIRO", "120.50")

        self.assertEqual((deposit.status_code, deposit.data["message"]), (201, "Aporte registrado."))
        self.assertEqual((withdrawal.status_code, withdrawal.data["message"]), (201, "Retiro registrado."))
        data = withdrawal.data["data"]
        self.assertEqual(data["ahorrado"], Decimal("179.50"))
        self.assertEqual(data["aportes"][0], {"id": data["aportes"][0]["id"], "tipo": "RETIRO", "monto": Decimal("120.50"), "fecha": timezone.localdate().isoformat(), "nota": ""})
        self.assertEqual(data["aportes"][1]["nota"], "Gratificación")

    def test_cannot_withdraw_more_than_saved(self):
        self.move(self.goal, "APORTE", "100.00")

        response = self.move(self.goal, "RETIRO", "100.01")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["amount"], ["No puedes retirar más de lo ahorrado: en «Viaje a Cusco» tienes S/ 100.00."])
        self.assertEqual(self.move(self.goal, "RETIRO", "100.00").status_code, 201)
        self.assertEqual(self.goal.stored_saved(), Decimal("0.00"))

    def test_contribution_validation(self):
        cases = {
            "occurred_at": ({"occurred_at": days_from_today(1).isoformat()}, "La fecha no puede ser posterior a hoy."),
            "tipo": ({"tipo": "PRESTAMO"}, "Usa tipo=APORTE o tipo=RETIRO."),
            "amount": ({"amount": "12.345"}, "Usa como máximo 2 decimales."),
        }
        for field, (extra, message) in cases.items():
            response = self.client.post(f"{METAS}{self.goal.id}/aportes/", {"tipo": "APORTE", "amount": "10.00", **extra}, format="json")
            self.assertEqual((response.status_code, response.data.get(field)), (400, [message]), field)
        before = self.move(self.goal, "APORTE", "10.00", occurred_at=days_from_today(-41).isoformat())
        self.assertEqual(before.data["occurred_at"], ["La fecha no puede ser anterior al día en que creaste la meta."])
        self.assertFalse(self.goal.contributions.exists())

    def test_archived_goals_do_not_accept_movements(self):
        SavingsGoal.objects.filter(pk=self.goal.pk).update(archived=True)

        response = self.move(self.goal, "APORTE", "10.00")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "La meta «Viaje a Cusco» está archivada. Restáurala para registrar aportes o retiros.")

    def test_delete_contribution(self):
        self.move(self.goal, "APORTE", "300.00")
        self.move(self.goal, "RETIRO", "250.00")
        deposit = self.goal.contributions.get(kind=ContributionKind.DEPOSIT)
        withdrawal = self.goal.contributions.get(kind=ContributionKind.WITHDRAWAL)
        url = f"{METAS}{self.goal.id}/aportes/"

        blocked = self.client.delete(f"{url}{deposit.id}/")
        self.assertEqual(blocked.status_code, 400)
        self.assertIn("Elimina primero el retiro", blocked.data["detail"])
        self.assertEqual(self.client.delete(f"{url}{withdrawal.id}/").status_code, 204)
        self.assertEqual(self.client.delete(f"{url}{deposit.id}/").status_code, 204)
        missing = self.client.delete(f"{url}{deposit.id}/")
        self.assertEqual((missing.status_code, missing.data["detail"]), (404, "Movimiento de la meta no encontrado."))

    def test_movements_do_not_touch_accounts(self):
        account = FinanceAccount.open(self.user, name="BCP", account_type="Ahorros", opening_balance=Decimal("1000.00"))

        self.move(self.goal, "APORTE", "400.00")
        self.move(self.goal, "RETIRO", "100.00")

        self.assert_balance(account, "1000.00")
        self.assertEqual(FinanceTransaction.objects.filter(owner=self.user).count(), 1)


class GoalModelTests(GoalAPITestCase):
    def test_domain_methods(self):
        goal = self.make_goal(target="1000.00", age_days=100, target_in_days=100)
        today = timezone.localdate()

        goal.contribute(Decimal("300.00"), occurred_at=today - timedelta(days=50))
        with self.assertRaises(AhorroInsuficienteError):
            goal.withdraw(Decimal("300.01"))
        with self.assertRaises(OperacionNoPermitidaError):
            goal.contribute(Decimal("0"))
        with self.assertRaises(OperacionNoPermitidaError):
            goal.contribute(Decimal("10"), occurred_at=today + timedelta(days=1))

        goal = SavingsGoal.objects.with_contributions().get(pk=goal.pk)
        self.assertEqual((goal.saved_amount, goal.remaining, goal.progress_pct), (Decimal("300.00"), Decimal("700.00"), 30.0))
        self.assertEqual(goal.expected_progress_pct(today), 50.0)
        self.assertEqual(goal.status(today), "Atrasada")
        self.assertEqual(goal.months_left(today), goal.snapshot(today).months_left)
        self.assertEqual(goal.required_monthly(today), goal.snapshot(today).required_monthly)
        self.assertEqual(goal.estimated_completion(today), goal.snapshot(today).estimated)


class GoalAlertTests(GoalAPITestCase):
    def test_behind_goal_creates_a_warning_with_a_goal_action(self):
        goal = self.make_goal()  # 90 días de 150: se espera 60 %
        self.move(goal, "APORTE", "200.00")

        alert = self.goal_alerts().get()

        self.assertEqual((alert.rule, alert.level, alert.dedupe_key, alert.period), (AlertRule.GOAL_BEHIND, AlertLevel.WARNING, f"goal_behind:{goal.id}", ""))
        self.assertEqual(alert.title, "Tu meta Viaje a Cusco va atrasada")
        monthly = SavingsGoal.objects.with_contributions().get(pk=goal.pk).required_monthly(timezone.localdate())
        self.assertIn("Llevas S/ 200.00 de S/ 2,000.00 (10%) y a esta altura deberías llevar 60%.", alert.description)
        self.assertIn(f"Ahorra {money(monthly)} al mes para llegar al", alert.description)
        item = next(item for item in self.client.get(f"{API}/alertas/").data["items"] if item["id"] == alert.id)
        self.assertEqual(item["accion"], {"label": "Ver meta", "type": "goal", "id": goal.id})
        self.assertIsNone(item["periodo"])

    def test_reaching_the_goal_replaces_the_warning_with_a_success(self):
        goal = self.make_goal()
        self.move(goal, "APORTE", "200.00")

        self.move(goal, "APORTE", "1800.00")

        alert = self.goal_alerts().get()
        self.assertEqual((alert.rule, alert.level, alert.title), (AlertRule.GOAL_REACHED, AlertLevel.SUCCESS, "¡Alcanzaste tu meta Viaje a Cusco!"))
        filters = self.client.get(f"{API}/alertas/").data["filters"]
        self.assertIn("Meta alcanzada (1)", filters)
        self.assertNotIn("Meta atrasada (0)", filters)

    def test_alerts_disappear_when_the_goal_is_archived_or_deleted(self):
        archived = self.make_goal("Viaje")
        deleted = self.make_goal("Auto")
        self.move(archived, "APORTE", "100.00")
        self.assertEqual(self.goal_alerts().count(), 2)

        self.client.patch(f"{METAS}{archived.id}/", {"archived": True}, format="json")
        self.client.delete(f"{METAS}{deleted.id}/")

        self.assertFalse(self.goal_alerts().exists())

    def test_catching_up_or_deleting_the_withdrawal_updates_the_alert(self):
        goal = self.make_goal(target="1000.00")
        self.move(goal, "APORTE", "700.00")
        self.move(goal, "RETIRO", "300.00")
        self.assertTrue(self.goal_alerts().exists())

        withdrawal = goal.contributions.get(kind=ContributionKind.WITHDRAWAL)
        self.client.delete(f"{METAS}{goal.id}/aportes/{withdrawal.id}/")

        self.assertFalse(self.goal_alerts().exists())

    def test_lazy_daily_evaluation_and_currency(self):
        self.make_goal()  # creada directamente: nadie evaluó sus alertas
        self.user.currency = "USD"
        self.user.save(update_fields=["currency"])

        data = self.client.get(f"{API}/dashboard/resumen/").data

        self.assertIn("Tu meta Viaje a Cusco va atrasada", [alert["titulo"] for alert in data["alertas_activas"]])
        self.assertIn("Llevas $ 0.00 de $ 2,000.00", self.goal_alerts().get().description)
        self.assertTrue(AlertEvaluation.objects.filter(owner=self.user, period="metas").exists())

    def test_engine_failure_does_not_break_the_operation(self):
        goal = self.make_goal()
        with mock.patch("goals.views.evaluate_goal_alerts", side_effect=RuntimeError("boom")), self.assertLogs("goals.views", "ERROR"):
            response = self.move(goal, "APORTE", "10.00")

        self.assertEqual(response.status_code, 201)


class SeedDemoGoalTests(TestCase):
    def test_demo_user_gets_one_goal_on_track_and_one_behind(self):
        call_command("seed_demo", email="metas@finova.local", stdout=StringIO())
        user = get_user_model().objects.get(email="metas@finova.local")
        today = timezone.localdate()

        goals = {goal.name: goal for goal in SavingsGoal.objects.filter(owner=user).with_contributions()}

        self.assertEqual(goals["Laptop nueva"].status(today), "En curso")
        self.assertEqual(goals["Viaje a Cusco"].status(today), "Atrasada")
        self.assertTrue(all(goal.saved_amount > 0 for goal in goals.values()))
        self.assertTrue(FinanceAlert.objects.filter(owner=user, rule=AlertRule.GOAL_BEHIND).exists())

        call_command("seed_demo", email="metas@finova.local", reset=True, stdout=StringIO())
        self.assertEqual(SavingsGoal.objects.filter(owner=user).count(), 2)
