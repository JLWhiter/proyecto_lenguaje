import math

from rest_framework.exceptions import Throttled
from rest_framework.settings import api_settings
from rest_framework.throttling import ScopedRateThrottle

# Throttle scopes: the views' ``throttle_scope`` and the keys of
# REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] (config/settings.py). They name
# rate limits, they are not credentials.
LOGIN_SCOPE = "login"
REGISTER_SCOPE = "register"
RECOVERY_SCOPE = "password_reset"
VERIFY_RESEND_SCOPE = "verify_resend"
CREDENTIAL_CHANGE_SCOPE = "password_change"

THROTTLE_MESSAGES = {
    LOGIN_SCOPE: "Demasiados intentos de inicio de sesión.",
    REGISTER_SCOPE: "Demasiados intentos de registro desde esta conexión.",
    RECOVERY_SCOPE: "Demasiadas solicitudes de recuperación de contraseña.",
    VERIFY_RESEND_SCOPE: "Ya solicitaste varios enlaces de verificación.",
    CREDENTIAL_CHANGE_SCOPE: "Demasiados intentos de cambio de contraseña.",
}
DEFAULT_THROTTLE_MESSAGE = "Demasiadas solicitudes."


def _plural(value, singular, plural):
    return f"{value} {singular if value == 1 else plural}"


def format_wait(seconds):
    if seconds is None:
        return "más tarde"
    seconds = max(1, math.ceil(seconds))
    if seconds < 60:
        return "en " + _plural(seconds, "segundo", "segundos")
    minutes = math.ceil(seconds / 60)
    if minutes < 60:
        return "en " + _plural(minutes, "minuto", "minutos")
    return "en " + _plural(math.ceil(minutes / 60), "hora", "horas")


def build_throttle_message(scope, wait):
    base = THROTTLE_MESSAGES.get(scope, DEFAULT_THROTTLE_MESSAGE)
    return f"{base} Inténtalo de nuevo {format_wait(wait)}."


class FinovaThrottled(Throttled):
    """429 with a Spanish ``detail`` (only key in the body) and a Retry-After header."""

    default_detail = "Demasiadas solicitudes. Inténtalo de nuevo más tarde."

    def __init__(self, wait=None, scope=None):
        # DRF would append an English/auto-translated sentence when `wait` is passed.
        super().__init__(wait=None, detail=build_throttle_message(scope, wait))
        self.wait = math.ceil(wait) if wait is not None else None


class FinovaScopedRateThrottle(ScopedRateThrottle):
    """ScopedRateThrottle that reads the rates at request time.

    DRF copies ``DEFAULT_THROTTLE_RATES`` into a class attribute at import time,
    which would make ``override_settings`` (tests) silently ineffective.
    """

    @property
    def THROTTLE_RATES(self):
        return api_settings.DEFAULT_THROTTLE_RATES


class ScopedThrottleMixin:
    """Apply the view's ``throttle_scope`` and answer 429 in Spanish."""

    throttle_classes = [FinovaScopedRateThrottle]
    throttle_scope = None

    def throttled(self, request, wait):
        raise FinovaThrottled(wait=wait, scope=self.throttle_scope)
