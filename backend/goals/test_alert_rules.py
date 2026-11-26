"""Pruebas unitarias (unittest) de las reglas de alertas de metas en ``core.alerts``.

Se pueden ejecutar sin base de datos: ``python -m unittest goals.test_alert_rules``.
"""

import unittest
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

from core.alerts import (
    GOAL_PERIOD,
    AlertLevel,
    AlertRule,
    GoalProgress,
    goal_alerts,
    needs_goal_evaluation,
    reconcile,
)

TODAY = date(2026, 11, 26)


def progress(goal_id=7, *, saved="620.00", behind=True, reached=False, name="Viaje a Cusco"):
    return GoalProgress(
        id=goal_id,
        name=name,
        target=Decimal("2000.00"),
        saved=Decimal(saved),
        progress=round(float(Decimal(saved) / 20), 1),
        expected=71.9,
        required_monthly=Decimal("690.00"),
        target_date=date(2027, 1, 31),
        behind=behind,
        reached=reached,
    )


class GoalAlertRuleTests(unittest.TestCase):
    def test_behind_goal_warns_with_the_monthly_amount_needed(self):
        (alert,) = goal_alerts([progress()])

        self.assertEqual((alert.key, alert.rule, alert.level, alert.severity), ("goal_behind:7", AlertRule.GOAL_BEHIND, AlertLevel.WARNING, 2))
        self.assertEqual(alert.title, "Tu meta Viaje a Cusco va atrasada")
        self.assertEqual(
            alert.description,
            "Llevas S/ 620.00 de S/ 2,000.00 (31%) y a esta altura deberías llevar 71.9%. "
            "Ahorra S/ 690.00 al mes para llegar al 31 Ene 2027.",
        )
        self.assertEqual((alert.period, alert.percentage), (GOAL_PERIOD, None))
        self.assertEqual((alert.action_label, alert.action), ("Ver meta", {"type": "goal", "id": 7}))

    def test_reached_goal_congratulates(self):
        (alert,) = goal_alerts([progress(saved="2000.00", behind=False, reached=True)])

        self.assertEqual((alert.key, alert.level, alert.severity), ("goal_reached:7", AlertLevel.SUCCESS, 0))
        self.assertEqual(alert.title, "¡Alcanzaste tu meta Viaje a Cusco!")
        self.assertIn("Ya separaste S/ 2,000.00 de los S/ 2,000.00", alert.description)

    def test_goals_on_track_have_no_alert_and_texts_use_the_currency(self):
        alerts = goal_alerts([progress(1, behind=False), progress(2)], currency="USD")

        self.assertEqual([alert.key for alert in alerts], ["goal_behind:2"])
        self.assertIn("Llevas $ 620.00 de $ 2,000.00", alerts[0].description)

    def test_reconcile_keeps_current_goal_alerts_and_removes_the_rest(self):
        candidates = goal_alerts([progress(7)])
        current = SimpleNamespace(id=1, dedupe_key="goal_behind:7", dismissed=False, **candidates[0].fields())
        stale = SimpleNamespace(id=2, dedupe_key="goal_behind:8", period=GOAL_PERIOD)

        plan = reconcile([current, stale], candidates, GOAL_PERIOD, None)

        self.assertEqual((plan.create, plan.update, plan.delete), ((), (), (2,)))

    def test_goal_alerts_are_reevaluated_daily(self):
        self.assertTrue(needs_goal_evaluation(None, TODAY))
        self.assertTrue(needs_goal_evaluation(date(2026, 11, 25), TODAY))
        self.assertFalse(needs_goal_evaluation(TODAY, TODAY))


if __name__ == "__main__":
    unittest.main()
