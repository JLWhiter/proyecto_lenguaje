from django.conf import settings
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.contrib.auth.tokens import default_token_generator


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


def _token(user):
    return default_token_generator.make_token(user)


def build_verification_url(user):
    return (
        f"{settings.FINOVA_FRONTEND_URL.rstrip('/')}/verificar-correo"
        f"?uid={_uid(user)}&token={_token(user)}"
    )


def build_password_reset_url(user):
    return (
        f"{settings.FINOVA_FRONTEND_URL.rstrip('/')}/restablecer-contrasena"
        f"?uid={_uid(user)}&token={_token(user)}"
    )


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
    return _uid(user), _token(user)


def check_email_token(user, token):
    return default_token_generator.check_token(user, token)


__all__ = [
    "email_delivery_configured",
    "send_verification_email",
    "send_password_reset_email",
    "build_verification_url",
    "build_password_reset_url",
    "uid_and_token",
    "check_email_token",
]
