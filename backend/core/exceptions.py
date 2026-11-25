"""Errores del dominio financiero. Las vistas los convierten en respuestas 400."""


class FinanceError(Exception):
    """Operación financiera que una regla de negocio no permite."""


class OperacionNoPermitidaError(FinanceError):
    """La operación no está permitida para esa cuenta, movimiento o presupuesto."""


class SaldoInsuficienteError(FinanceError):
    """La cuenta no tiene saldo suficiente para el retiro."""

    def __init__(self, account, message=None):
        self.account = account
        super().__init__(message or f"La cuenta {account.name} no tiene saldo suficiente.")
