"""Pruebas unitarias (unittest) de las reglas puras del motor de alertas.

Se pueden ejecutar sin Django: ``python -m unittest core.test_alerts``.
"""

import unittest
from datetime import date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

from core.alerts import (
    EMPTY_INSIGHT,
    ENGINE_FIELDS,
    AlertLevel,
    AlertRule,
    BudgetUsage,
    Expense,
    MonthFlows,
    affected_periods,
    alert_action_changes,
    alert_changes,
    atypical_expense_alerts,
    budget_insight,
    budget_threshold_alerts,
    evaluate_rules,
    lazy_periods,
    money,
    needs_evaluation,
    negative_month_alerts,
    percent_text,
    projected_overrun_alerts,
    reconcile,
    relative_time,
    spent_by_category,
)

TODAY = date(2026, 11, 25)
NOW = datetime(2026, 11, 25, 12, 0)


def budget(spent, limit="100.00", month="2026-11", pk=1, category="Alimentación"):
    return BudgetUsage(pk, category, month, Decimal(limit), Decimal(spent))


def expense(pk, amount, day, category="Taxi", name="Movimiento"):
    return Expense(pk, name, category, Decimal(amount), day)


def stored_from(candidate, pk=1, **overrides):
    """Alerta guardada (como la devolvería la base de datos) con el estado del candidato."""
    values = {name: getattr(candidate, name) for name in ENGINE_FIELDS}
    state = {"is_read": False, "dismissed": False, "snoozed_until": None, "created_at": NOW - timedelta(days=2)}
    return SimpleNamespace(id=pk, dedupe_key=candidate.key, **{**values, **state, **overrides})


def threshold(spent, **kwargs):
    alerts = budget_threshold_alerts([budget(spent, **kwargs)], TODAY)
    return alerts[0] if alerts else None


class BudgetThresholdTests(unittest.TestCase):
    def test_boundaries(self):
        cases = [
            ("74.90", None, None),
            ("75.00", AlertLevel.WARNING, 2),
            ("89.99", AlertLevel.WARNING, 2),
            ("90.00", AlertLevel.DANGER, 3),
            ("100.00", AlertLevel.DANGER, 3),
            ("100.01", AlertLevel.DANGER, 4),
        ]
        for spent, level, severity in cases:
            alert = threshold(spent)
            if level is None:
                self.assertIsNone(alert, spent)
            else:
                self.assertEqual((alert.level, alert.severity), (level, severity), spent)

    def test_one_key_per_budget_whatever_the_level(self):
        keys = {threshold(spent).key for spent in ("75.00", "95.00", "150.00")}

        self.assertEqual(keys, {"budget_threshold:1"})

    def test_texts_and_action(self):
        warning, exhausted, exceeded = threshold("80.00"), threshold("100.00"), threshold("130.00")

        self.assertEqual(warning.title, "Presupuesto de Alimentación al 80%")
        self.assertEqual(warning.description, "Llevas S/ 80.00 de S/ 100.00. Te quedan S/ 20.00 para los 6 días que quedan del mes.")
        self.assertEqual(exhausted.title, "Presupuesto de Alimentación agotado")
        self.assertEqual(exceeded.title, "Presupuesto excedido: Alimentación")
        self.assertIn("te pasaste por S/ 30.00", exceeded.description)
        self.assertEqual((exceeded.action_label, exceeded.action), ("Ajustar presupuesto", {"type": "budget", "id": 1, "mes": "2026-11"}))
        self.assertEqual((exceeded.budget_id, exceeded.period, exceeded.percentage), (1, "2026-11", 130.0))

    def test_closed_month_and_currency(self):
        closed = threshold("95.00", month="2026-10")
        dollars = budget_threshold_alerts([budget("1234.50", limit="1300.00")], TODAY, "USD")[0]

        self.assertEqual(closed.description, "Cerraste Octubre 2026 con S/ 95.00 gastados de S/ 100.00 (95%).")
        self.assertIn("$ 1,234.50 de $ 1,300.00", dollars.description)


class ProjectionTests(unittest.TestCase):
    # El 25 de noviembre (30 días) la proyección es gastado × 30 / 25 = gastado × 1.2.
    def projection(self, spent, today=TODAY, **kwargs):
        return projected_overrun_alerts([budget(spent, **kwargs)], today)

    def test_warns_when_the_projection_exceeds_the_limit(self):
        alert = self.projection("85.00")[0]

        self.assertEqual((alert.rule, alert.level, alert.key), (AlertRule.BUDGET_PROJECTION, AlertLevel.WARNING, "budget_projection:1"))
        self.assertEqual(alert.title, "Al ritmo actual superarás tu presupuesto de Alimentación")
        self.assertIn("cerrarás el mes con S/ 102.00 (S/ 2.00 por encima del límite)", alert.description)

    def test_only_while_spent_is_at_most_the_limit(self):
        self.assertEqual(self.projection("80.00"), [])  # proyección 96
        self.assertEqual(len(self.projection("100.00")), 1)
        self.assertEqual(self.projection("100.01"), [])  # ya excedido: lo avisa la regla de umbral

    def test_only_the_current_month_from_day_five(self):
        self.assertEqual(self.projection("90.00", month="2026-10"), [])
        self.assertEqual(self.projection("30.00", today=date(2026, 11, 4)), [])
        self.assertEqual(len(self.projection("30.00", today=date(2026, 11, 5))), 1)


class AtypicalExpenseTests(unittest.TestCase):
    HISTORY = [("10.00", 1), ("12.00", 2), ("11.00", 3), ("9.00", 4), ("13.00", 5)]  # media 11, σ ≈ 1.58

    def history(self, samples=None):
        samples = self.HISTORY if samples is None else samples
        return [expense(100 + index, amount, date(2026, 11 - months_back, 10)) for index, (amount, months_back) in enumerate(samples)]

    def check(self, amount, samples=None, category="Taxi"):
        return atypical_expense_alerts([*self.history(samples), expense(1, amount, date(2026, 11, 20), category, "Taxi al aeropuerto")], "2026-11")

    def test_mean_plus_two_sigma_with_numpy(self):
        self.assertEqual(self.check("14.00"), [])  # umbral ≈ 14.16
        info = self.check("15.00")[0]
        warning = self.check("20.00")[0]  # supera media + 3σ ≈ 15.74

        self.assertEqual((info.level, info.severity), (AlertLevel.INFO, 1))
        self.assertEqual((warning.level, warning.severity), (AlertLevel.WARNING, 2))
        self.assertEqual((warning.key, warning.transaction_id, warning.period), ("atypical_expense:1", 1, "2026-11"))
        self.assertEqual(warning.action, {"type": "transaction", "id": 1, "mes": "2026-11", "categoria": "Taxi"})
        self.assertEqual(warning.title, "Gasto inusual en Taxi")
        self.assertIn("«Taxi al aeropuerto» por S/ 20.00 (20 Nov)", warning.description)
        self.assertIn("promediaron S/ 11.00", warning.description)

    def test_needs_at_least_five_previous_samples(self):
        self.assertEqual(self.check("500.00", samples=self.HISTORY[:4]), [])
        self.assertEqual(len(self.check("500.00", samples=self.HISTORY)), 1)

    def test_only_the_previous_six_months_are_history(self):
        old = [*self.HISTORY[:4], ("12.00", 7)]

        self.assertEqual(self.check("500.00", samples=old), [])

    def test_current_month_and_other_categories_are_not_history(self):
        same_month = [expense(200 + day, "10.00", date(2026, 11, day)) for day in range(1, 8)]
        other = [expense(300 + months, "10.00", date(2026, 11 - months, 3), "Comida") for months in range(1, 6)]

        self.assertEqual(atypical_expense_alerts([*same_month, *other, expense(1, "90.00", date(2026, 11, 20))], "2026-11"), [])

    def test_category_matching_ignores_case_and_spaces(self):
        self.assertEqual(len(self.check("50.00", category="  TAXI ")), 1)

    def test_category_matching_ignores_accents(self):
        history = [expense(100 + months, "11.00", date(2026, 11 - months, 10), "Alimentación") for months in range(1, 6)]

        alerts = atypical_expense_alerts([*history, expense(1, "90.00", date(2026, 11, 20), "alimentacion")], "2026-11")

        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].action["categoria"], "alimentacion")  # la categoría tal como está guardada

    def test_action_links_to_the_movement_and_its_month(self):
        history = [expense(100 + index, amount, date(2026, 10 - months_back, 10)) for index, (amount, months_back) in enumerate(self.HISTORY)]

        alert = atypical_expense_alerts([*history, expense(9, "80.00", date(2026, 10, 31), "Taxi")], "2026-10")[0]

        self.assertEqual((alert.period, alert.transaction_id), ("2026-10", 9))
        self.assertEqual(alert.action, {"type": "transaction", "id": 9, "mes": "2026-10", "categoria": "Taxi"})


class NegativeMonthTests(unittest.TestCase):
    def flows(self, income, expenses, month="2026-11"):
        return MonthFlows(month, Decimal(income), Decimal(expenses))

    def test_current_month_only_after_day_twenty(self):
        self.assertEqual(negative_month_alerts(self.flows("100", "300"), date(2026, 11, 20)), [])
        alert = negative_month_alerts(self.flows("100", "300"), date(2026, 11, 21))[0]

        self.assertEqual((alert.key, alert.level, alert.rule), ("negative_month:2026-11", AlertLevel.WARNING, AlertRule.NEGATIVE_MONTH))
        self.assertEqual(alert.title, "Tus gastos superan tus ingresos en Noviembre 2026")
        self.assertIn("S/ 200.00 de déficit", alert.description)
        self.assertEqual(alert.action, {"type": "transactions", "id": None, "mes": "2026-11"})

    def test_closed_month_any_day(self):
        alert = negative_month_alerts(self.flows("0", "50", month="2026-10"), date(2026, 11, 1))[0]

        self.assertEqual(alert.title, "Octubre 2026 cerró en negativo")
        self.assertIsNone(alert.percentage)

    def test_no_alert_when_balanced_or_in_the_future(self):
        self.assertEqual(negative_month_alerts(self.flows("300", "300"), TODAY), [])
        self.assertEqual(negative_month_alerts(self.flows("0", "10", month="2026-12"), TODAY), [])


class EvaluateRulesTests(unittest.TestCase):
    def test_combines_every_rule_and_computes_spending_by_category(self):
        expenses = [
            expense(1, "60.00", date(2026, 11, 3), "alimentación"),
            expense(2, "30.00", date(2026, 11, 4), "ALIMENTACIÓN"),
            expense(4, "10.00", date(2026, 11, 5), " Alimentacion "),
        ]
        spent = spent_by_category([*expenses, expense(3, "99.00", date(2026, 10, 3), "Alimentación")], "2026-11")
        budgets = [BudgetUsage(7, "Alimentación", "2026-11", Decimal("100.00"), spent["alimentacion"])]

        candidates = evaluate_rules(budgets, expenses, MonthFlows("2026-11", Decimal("0"), Decimal("100")), "2026-11", TODAY)

        self.assertEqual(spent, {"alimentacion": Decimal("100.00")})
        self.assertEqual(
            [candidate.key for candidate in candidates],
            ["budget_threshold:7", "budget_projection:7", "negative_month:2026-11"],
        )


class ReconcileTests(unittest.TestCase):
    def test_new_candidates_are_created(self):
        candidate = threshold("80.00")

        plan = reconcile([], [candidate], "2026-11", NOW)

        self.assertEqual((plan.create, plan.update, plan.delete), ((candidate,), (), ()))

    def test_escalation_updates_the_same_alert_and_marks_it_unread(self):
        stored = stored_from(threshold("80.00"), is_read=True, snoozed_until=NOW + timedelta(hours=3))

        plan = reconcile([stored], [threshold("95.00")], "2026-11", NOW)

        self.assertEqual(plan.create, ())
        alert, changes = plan.update[0]
        self.assertIs(alert, stored)
        self.assertEqual((changes["level"], changes["severity"], changes["is_read"]), (AlertLevel.DANGER, 3, False))
        self.assertEqual((changes["snoozed_until"], changes["created_at"]), (None, NOW))

    def test_exceeding_escalates_even_with_the_same_level(self):
        stored = stored_from(threshold("95.00"), is_read=True)

        changes = alert_changes(stored, threshold("101.00"), NOW)

        self.assertEqual((changes["severity"], changes["is_read"], changes["title"]), (4, False, "Presupuesto excedido: Alimentación"))

    def test_de_escalation_keeps_read_state_and_date(self):
        stored = stored_from(threshold("95.00"), is_read=True)

        changes = alert_changes(stored, threshold("80.00"), NOW)

        self.assertEqual((changes["level"], changes["severity"]), (AlertLevel.WARNING, 2))
        self.assertNotIn("is_read", changes)
        self.assertNotIn("created_at", changes)

    def test_unchanged_alert_is_not_updated(self):
        candidate = threshold("80.00")

        self.assertEqual(reconcile([stored_from(candidate)], [candidate], "2026-11", NOW).update, ())

    def test_alerts_whose_condition_disappeared_are_deleted_only_in_the_period(self):
        gone = stored_from(threshold("80.00"), pk=1)
        other_month = stored_from(threshold("80.00", month="2026-10", pk=2), pk=2)

        plan = reconcile([gone, other_month], [], "2026-11", NOW)

        self.assertEqual(plan.delete, (1,))

    def test_dismissed_alert_is_not_recreated_unless_it_escalates(self):
        stored = stored_from(threshold("80.00"), dismissed=True, is_read=True)

        same = reconcile([stored], [threshold("85.00")], "2026-11", NOW)
        higher = reconcile([stored], [threshold("92.00")], "2026-11", NOW)

        self.assertEqual((same.create, same.update, same.delete), ((), (), ()))
        self.assertEqual(higher.update[0][1]["dismissed"], False)

    def test_an_expense_that_changed_month_keeps_its_alert(self):
        moved = stored_from(threshold("80.00"), period="2026-10")
        candidate = threshold("80.00")

        plan = reconcile([moved], [candidate], "2026-11", NOW)

        self.assertEqual((plan.create, plan.delete), ((), ()))
        self.assertEqual(plan.update[0][1], {"period": "2026-11"})


class BudgetInsightTests(unittest.TestCase):
    MID_MONTH = date(2026, 11, 15)  # proyección = gastado × 2

    def test_empty_without_budgets_or_for_future_months(self):
        self.assertEqual(budget_insight([], "2026-11", TODAY), EMPTY_INSIGHT)
        self.assertEqual(budget_insight([budget("0.00", month="2026-12")], "2026-12", TODAY), EMPTY_INSIGHT)

    def test_positive_message_when_everything_is_under_control(self):
        result = budget_insight([budget("10.00"), budget("20.00", pk=2, category="Ocio")], "2026-11", self.MID_MONTH)

        self.assertEqual((result["titulo"], result["nivel"], result["accion"]), ("Vas bien este mes", AlertLevel.SUCCESS, None))
        self.assertIn("S/ 140.00 sin usar", result["resumen"])

    def test_suggests_rebalancing_from_the_largest_projected_margin(self):
        food = budget("200.00", limit="300.00")  # proyección 400: 100 de exceso
        fun = budget("50.00", limit="500.00", pk=2, category="Ocio")  # proyección 100: 400 libres
        tight = budget("100.00", limit="210.00", pk=3, category="Salud")  # proyección 200: 10 libres

        result = budget_insight([food, fun, tight], "2026-11", self.MID_MONTH)

        self.assertEqual(result["titulo"], "Alimentación superará su presupuesto")
        self.assertEqual(result["nivel"], AlertLevel.WARNING)
        self.assertEqual(
            result["accion"],
            {"type": "rebalance", "month": "2026-11", "source_category": "Ocio", "target_category": "Alimentación", "amount": Decimal("100.00")},
        )
        self.assertIn("Mueve S/ 100.00 de Ocio a Alimentación", result["sugerencia"])

    def test_amount_is_capped_by_the_margin_and_rounded_to_ten(self):
        food = budget("200.00", limit="300.00")
        fun = budget("40.00", limit="117.00", pk=2, category="Ocio")  # 37 libres -> 30
        small = budget("200.00", limit="295.50")  # exceso 104.50 -> 110

        capped = budget_insight([food, fun], "2026-11", self.MID_MONTH)["accion"]
        rounded = budget_insight([small, budget("0.00", limit="1000.00", pk=2, category="Ocio")], "2026-11", self.MID_MONTH)["accion"]

        self.assertEqual(capped["amount"], Decimal("30.00"))
        self.assertLessEqual(capped["amount"], fun.limit - fun.spent)
        self.assertEqual(rounded["amount"], Decimal("110.00"))

    def test_no_action_without_a_donor_with_free_margin(self):
        food = budget("200.00", limit="300.00")
        busy = budget("100.00", limit="200.00", pk=2, category="Ocio")  # proyección 200: nada libre

        alone = budget_insight([food], "2026-11", self.MID_MONTH)
        no_margin = budget_insight([food, busy], "2026-11", self.MID_MONTH)

        for result in (alone, no_margin):
            self.assertIsNone(result["accion"])
            self.assertIn("Reduce tus gastos en Alimentación en unos S/ 6.25 al día", result["sugerencia"])

    def test_exceeded_budget_is_reported_as_danger(self):
        result = budget_insight([budget("120.00"), budget("0.00", limit="500.00", pk=2, category="Ocio")], "2026-11", self.MID_MONTH)

        self.assertEqual((result["titulo"], result["nivel"]), ("Alimentación ya superó su presupuesto", AlertLevel.DANGER))
        self.assertEqual(result["accion"]["amount"], Decimal("140.00"))

    def test_closed_month_summary(self):
        ok = budget_insight([budget("50.00", month="2026-10")], "2026-10", TODAY)
        exceeded = budget_insight(
            [budget("150.00", month="2026-10"), budget("101.00", month="2026-10", pk=2, category="Ocio")], "2026-10", TODAY
        )

        self.assertEqual((ok["titulo"], ok["nivel"], ok["accion"]), ("Cerraste Octubre 2026 dentro de tus presupuestos", AlertLevel.SUCCESS, None))
        self.assertEqual(exceeded["titulo"], "Alimentación cerró excedido")
        self.assertIn("En total, 2 presupuestos se excedieron.", exceeded["resumen"])
        self.assertIsNone(exceeded["accion"])


class SchedulingTests(unittest.TestCase):
    def test_affected_periods_include_later_months_that_use_them_as_history(self):
        self.assertEqual(affected_periods({"2026-11"}, TODAY), ["2026-11"])
        self.assertEqual(affected_periods({"2026-10"}, TODAY), ["2026-10", "2026-11"])
        self.assertEqual(affected_periods({"2026-04"}, TODAY), ["2026-10"])
        self.assertEqual(affected_periods({"2024-05"}, TODAY), [])
        self.assertEqual(affected_periods({"2026-12", ""}, TODAY), ["2026-12"])

    def test_lazy_periods(self):
        self.assertEqual(lazy_periods(None, TODAY), ["2026-10", "2026-11"])
        self.assertEqual(lazy_periods("2026-10", TODAY), ["2026-10"])
        self.assertEqual(lazy_periods("2024-05", TODAY), [])

    def test_needs_evaluation(self):
        self.assertTrue(needs_evaluation("2026-11", None, TODAY))
        self.assertFalse(needs_evaluation("2026-11", TODAY, TODAY))
        self.assertTrue(needs_evaluation("2026-11", date(2026, 11, 24), TODAY))
        self.assertTrue(needs_evaluation("2026-10", date(2026, 10, 31), TODAY))
        self.assertFalse(needs_evaluation("2026-10", date(2026, 11, 1), TODAY))


class FormattingTests(unittest.TestCase):
    def test_money_respects_the_currency(self):
        self.assertEqual(money(Decimal("1234.5")), "S/ 1,234.50")
        self.assertEqual(money(Decimal("1234.5"), "USD"), "$ 1,234.50")
        self.assertEqual(money(Decimal("-3"), "EUR"), "-€ 3.00")

    def test_percent_text(self):
        self.assertEqual([percent_text(value) for value in (75.0, 82.46, 100.0)], ["75", "82.5", "100"])

    def test_relative_time_in_spanish(self):
        cases = [
            (NOW - timedelta(seconds=30), "Ahora"),
            (NOW - timedelta(minutes=15), "Hace 15 min"),
            (NOW - timedelta(hours=3), "Hace 3 h"),
            (datetime(2026, 11, 24, 23, 0), "Ayer"),
            (datetime(2026, 11, 12, 9, 0), "12 Nov"),
            (datetime(2025, 11, 12, 9, 0), "12 Nov 2025"),
        ]
        for moment, expected in cases:
            self.assertEqual(relative_time(moment, NOW), expected)

    def test_user_actions(self):
        changes, message = alert_action_changes("snooze", NOW, hours=2)

        self.assertEqual(changes, {"snoozed_until": NOW + timedelta(hours=2), "is_read": True})
        self.assertEqual(message, "Alerta pospuesta por 2 horas.")
        self.assertEqual(alert_action_changes("confirm", NOW)[0], {"is_read": True})
        self.assertEqual(alert_action_changes("restore", NOW)[0], {"dismissed": False, "snoozed_until": None})


if __name__ == "__main__":
    unittest.main()
