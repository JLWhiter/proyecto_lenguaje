from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from .tokens import email_verification_token_generator, password_reset_token_generator

# Frontend routes (see frontend/src/App.jsx); both pages read `?uid=...&token=...`.
VERIFY_EMAIL_PATH = "/verificar-email"
RESET_LINK_PATH = "/restablecer-contrasena"


def email_delivery_configured():
    """Email is only considered available with a real SMTP backend and explicit opt-in."""
    backend = str(getattr(settings, "EMAIL_BACKEND", "")).lower()
    return bool(
        getattr(settings, "FINOVA_EMAIL_DELIVERY_ENABLED", False)
        and getattr(settings, "EMAIL_HOST", "")
        and "smtp" in backend
    )


def _uid(user):
    return urlsafe_base64_encode(force_bytes(user.pk))


def user_from_uid(uidb64, **filters):
    """Return the user encoded in ``uidb64`` or ``None`` if it is invalid/unknown."""
    user_model = get_user_model()
    try:
        user_id = force_str(urlsafe_base64_decode(uidb64))
        return user_model.objects.get(pk=user_id, **filters)
    except (TypeError, ValueError, OverflowError, user_model.DoesNotExist):
        return None


def _frontend_url(path, user, token):
    query = urlencode({"uid": _uid(user), "token": token})
    return f"{settings.FINOVA_FRONTEND_URL.rstrip('/')}{path}?{query}"


def build_verification_url(user):
    return _frontend_url(VERIFY_EMAIL_PATH, user, email_verification_token_generator.make_token(user))


def build_password_reset_url(user):
    return _frontend_url(RESET_LINK_PATH, user, password_reset_token_generator.make_token(user))


def send_verification_email(user):
    if not email_delivery_configured():
        return False
    url = build_verification_url(user)
    send_mail(
        subject="Confirma tu correo en Finova",
        message=(
            f"Hola {user.full_name},\n\n"
            "Confirma tu correo electrónico para activar todas las funciones de Finova:\n"
            f"{url}\n\n"
            "Si no creaste esta cuenta, puedes ignorar este mensaje."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True,
    )
    return True


def send_password_reset_email(user):
    if not email_delivery_configured():
        return False
    url = build_password_reset_url(user)
    send_mail(
        subject="Restablece tu contraseña de Finova",
        message=(
            f"Hola {user.full_name},\n\n"
            "Recibimos una solicitud para restablecer tu contraseña. Usa este enlace:\n"
            f"{url}\n\n"
            "Si no solicitaste este cambio, ignora este mensaje. El enlace caduca pronto."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True,
    )
    return True


def uid_and_token(user):
    """uid + password reset token (kept for backwards compatibility)."""
    return _uid(user), password_reset_token_generator.make_token(user)


def verification_uid_and_token(user):
    """uid + email verification token."""
    return _uid(user), email_verification_token_generator.make_token(user)


def check_password_reset_token(user, token):
    return password_reset_token_generator.check_token(user, token)


def check_email_token(user, token):
    """Validate an email verification token (never accepts password reset tokens)."""
    return email_verification_token_generator.check_token(user, token)


def email_token_already_used(user, token):
    return email_verification_token_generator.check_token_already_used(user, token)


__all__ = [
    "email_delivery_configured",
    "send_verification_email",
    "send_password_reset_email",
    "build_verification_url",
    "build_password_reset_url",
    "user_from_uid",
    "uid_and_token",
    "verification_uid_and_token",
    "check_password_reset_token",
    "check_email_token",
    "email_token_already_used",
]
