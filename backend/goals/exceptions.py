"""Errores de las metas de ahorro. Heredan de ``FinanceError``: la API los responde como 400."""

from core.exceptions import FinanceError
from core.money import money


class AhorroInsuficienteError(FinanceError):
    """Se intentó retirar de una meta más de lo que tiene ahorrado."""

    def __init__(self, goal, saved):
        self.goal = goal
        self.saved = saved
        super().__init__(
            f"No puedes retirar más de lo ahorrado: en «{goal.name}» tienes {money(saved, goal.owner.currency)}."
        )
