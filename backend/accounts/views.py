from datetime import timedelta

from django.contrib.auth import login, logout, update_session_auth_hash
from django.db.models import F
from django.middleware.csrf import get_token, rotate_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .serializers import (
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
    VerifyEmailSerializer,
)
from .services import (
    check_email_token,
    check_password_reset_token,
    email_delivery_configured,
    email_token_already_used,
    send_password_reset_email,
    send_verification_email,
    user_from_uid,
)
from .throttling import (
    CREDENTIAL_CHANGE_SCOPE,
    LOGIN_SCOPE,
    RECOVERY_SCOPE,
    REGISTER_SCOPE,
    VERIFY_RESEND_SCOPE,
    ScopedThrottleMixin,
)

REMEMBER_ME_AGE = int(timedelta(days=30).total_seconds())

RESET_REQUESTED_MESSAGE = (
    "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña."
)
INVALID_RESET_LINK_MESSAGE = "El enlace no es válido o ya expiró."
INVALID_VERIFICATION_LINK_MESSAGE = "El enlace de verificación no es válido o ya expiró."


def _first_error(errors):
    value = errors
    if isinstance(value, (list, tuple)) and value:
        value = value[0]
    return str(value)


class CsrfTokenView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")
class RegisterView(ScopedThrottleMixin, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = REGISTER_SCOPE

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        login(request, user)
        request.session.set_expiry(0)  # browser session until the user explicitly chooses "remember me"
        send_verification_email(user)

        return Response(
            {
                "user": UserSerializer(user).data,
                "csrfToken": get_token(request),
                "email_delivery_configured": email_delivery_configured(),
            },
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_protect, name="dispatch")
class LoginView(ScopedThrottleMixin, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = LOGIN_SCOPE

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            if "detail" in serializer.errors:
                return Response(
                    {"detail": _first_error(serializer.errors["detail"])},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data["user"]
        remember_me = serializer.validated_data.get("remember_me", False)
        login(request, user)

        if remember_me:
            request.session.set_expiry(REMEMBER_ME_AGE)
        else:
            request.session.set_expiry(0)

        return Response(
            {
                "user": UserSerializer(user).data,
                "csrfToken": get_token(request),
            }
        )


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_protect, name="dispatch")
class LogoutAllView(APIView):
    """Close every session of the user (all devices), including the current one."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Bumping the version changes get_session_auth_hash(), so Django rejects
        # every session that stored the previous hash on its next request.
        User.objects.filter(pk=request.user.pk).update(session_version=F("session_version") + 1)
        logout(request)
        return Response({"detail": "Cerraste sesión en todos tus dispositivos."})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.save()
        return Response(UserSerializer(user).data)


@method_decorator(csrf_protect, name="dispatch")
class PasswordChangeView(ScopedThrottleMixin, APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = CREDENTIAL_CHANGE_SCOPE

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password", "updated_at"])
        # New password => new session hash: other sessions are logged out, this one
        # is kept alive with a fresh session key.
        update_session_auth_hash(request, user)
        rotate_token(request)

        return Response(
            {
                "detail": "Contraseña actualizada correctamente.",
                "user": UserSerializer(user).data,
                "csrfToken": get_token(request),
            }
        )


class SessionStatusView(APIView):
    """Safe bootstrap endpoint: returns 200 for guests instead of a console 401."""

    permission_classes = [AllowAny]

    def get(self, request):
        if request.user.is_authenticated:
            return Response({"authenticated": True, "user": UserSerializer(request.user).data})
        return Response({"authenticated": False, "user": None})


@method_decorator(csrf_protect, name="dispatch")
class PasswordResetView(ScopedThrottleMixin, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = RECOVERY_SCOPE

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            send_password_reset_email(user)

        # The same response is returned whether or not the account exists.
        return Response(
            {
                "detail": RESET_REQUESTED_MESSAGE,
                "email_delivery_configured": email_delivery_configured(),
            },
            status=status.HTTP_202_ACCEPTED,
        )


@method_decorator(csrf_protect, name="dispatch")
class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = user_from_uid(serializer.validated_data["uid"], is_active=True)
        if user is None or not check_password_reset_token(user, serializer.validated_data["token"]):
            return Response({"detail": INVALID_RESET_LINK_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=["password", "updated_at"])
        return Response({"detail": "Contraseña actualizada correctamente."})


@method_decorator(csrf_protect, name="dispatch")
class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        invalid = Response({"detail": INVALID_VERIFICATION_LINK_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)
        user = user_from_uid(serializer.validated_data["uid"])
        if user is None:
            return invalid

        token = serializer.validated_data["token"]
        if user.email_verified:
            # Only the link that verified the account may learn that (second click,
            # mail scanners...). Any other token gets the generic error.
            if email_token_already_used(user, token):
                return Response({"detail": "El correo ya estaba verificado.", "user": UserSerializer(user).data})
            return invalid

        if not check_email_token(user, token):
            return invalid

        user.email_verified = True
        user.save(update_fields=["email_verified", "updated_at"])
        return Response({"detail": "Correo verificado correctamente.", "user": UserSerializer(user).data})


@method_decorator(csrf_protect, name="dispatch")
class ResendVerificationEmailView(ScopedThrottleMixin, APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = VERIFY_RESEND_SCOPE

    def post(self, request):
        user = request.user
        delivery = email_delivery_configured()

        if user.email_verified:
            return Response(
                {
                    "detail": "Tu correo electrónico ya está verificado. No es necesario reenviar el enlace.",
                    "email_verified": True,
                    "email_delivery_configured": delivery,
                }
            )

        if not send_verification_email(user):
            # Error bodies carry only `detail`: the SPA treats any other key as a field error.
            return Response(
                {"detail": "No pudimos enviar el enlace: el envío de correos aún no está configurado en este entorno."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(
            {
                "detail": "Te enviamos un nuevo enlace de verificación. Revisa tu bandeja de entrada.",
                "email_verified": False,
                "email_delivery_configured": True,
            },
            status=status.HTTP_202_ACCEPTED,
        )
