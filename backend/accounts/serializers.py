import re

from django.contrib.auth import authenticate, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Currency, User

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")
MIN_PASSWORD_LENGTH = 8
MISMATCH_MESSAGE = "Las contraseñas no coinciden."
SAME_AS_CURRENT_MESSAGE = "La nueva contraseña debe ser diferente de la actual."


def field_error(field, message):
    """``ValidationError`` attached to one form field: ``{field: message}``."""
    return serializers.ValidationError({field: message})


def validate_password_strength(password):
    """Server-side mirror of the strength rules shown in the UI."""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise serializers.ValidationError("La contraseña debe tener al menos 8 caracteres.")
    if not re.search(r"\d", password) and not re.search(r"[^A-Za-z0-9]", password):
        raise serializers.ValidationError("La contraseña debe incluir al menos un número o símbolo.")


def validate_new_password(password, user=None):
    """Project strength rules + Django's AUTH_PASSWORD_VALIDATORS.

    Raises ``serializers.ValidationError`` with a list of messages.
    """
    validate_password_strength(password)
    try:
        password_validation.validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(list(exc.messages)) from exc


def normalize_full_name(value):
    value = " ".join(value.split())
    if len(value) < 2:
        raise serializers.ValidationError("Ingresa tu nombre completo.")
    return value


class UserSerializer(serializers.ModelSerializer):
    currency_display = serializers.CharField(source="get_currency_display", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "currency",
            "currency_display",
            "email_verified",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)
    currency = serializers.ChoiceField(choices=Currency.choices, default=Currency.PEN)
    password = serializers.CharField(write_only=True, min_length=MIN_PASSWORD_LENGTH, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)
    accept_terms = serializers.BooleanField(write_only=True)

    def validate_full_name(self, value):
        return normalize_full_name(value)

    def validate_email(self, value):
        value = value.strip().lower()
        if not EMAIL_RE.match(value):
            raise serializers.ValidationError("Ingresa un correo electrónico válido.")
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo electrónico.")
        return value

    def validate_password(self, value):
        validate_new_password(value)
        return value

    def validate_accept_terms(self, value):
        if not value:
            raise serializers.ValidationError(
                "Debes aceptar los Términos de Servicio y la Política de Privacidad."
            )
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise field_error("password_confirm", MISMATCH_MESSAGE)
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        validated_data.pop("accept_terms")
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    remember_me = serializers.BooleanField(default=False)

    def validate(self, attrs):
        request = self.context.get("request")
        email = attrs["email"].strip().lower()
        user = authenticate(request=request, username=email, password=attrs["password"])
        if user is None:
            # Same message for unknown account and wrong password (no account enumeration).
            raise serializers.ValidationError(
                {"detail": "Correo o contraseña incorrectos. Verifica tus datos."}
            )
        if not user.is_active:
            raise serializers.ValidationError(
                {"detail": "Esta cuenta está desactivada. Contacta con soporte."}
            )
        attrs["user"] = user
        attrs["email"] = email
        return attrs


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)

    def validate_email(self, value):
        return value.strip().lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=MIN_PASSWORD_LENGTH, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise field_error("password_confirm", MISMATCH_MESSAGE)
        try:
            validate_new_password(attrs["password"])
        except serializers.ValidationError as exc:
            raise field_error("password", exc.detail) from exc
        return attrs


class VerifyEmailSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """PATCH /auth/me/: only the name and the main currency are editable."""

    full_name = serializers.CharField(max_length=150)
    currency = serializers.ChoiceField(
        choices=Currency.choices,
        error_messages={"invalid_choice": "Selecciona una moneda válida (PEN, USD o EUR)."},
    )

    class Meta:
        model = User
        fields = ("full_name", "currency")

    def validate_full_name(self, value):
        return normalize_full_name(value)

    def validate(self, attrs):
        # The email is the login identifier and is not editable here. Sending the
        # current value back (e.g. the whole user object) is tolerated.
        initial = self.initial_data if hasattr(self.initial_data, "get") else {}
        email = initial.get("email")
        if email is not None and str(email).strip().lower() != self.instance.email.lower():
            raise serializers.ValidationError(
                {"email": "El correo electrónico no se puede modificar desde tu perfil."}
            )
        return attrs


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("La contraseña actual es incorrecta.")
        return value

    def validate(self, attrs):
        new_password = attrs["new_password"]
        if new_password != attrs["new_password_confirm"]:
            raise field_error("new_password_confirm", MISMATCH_MESSAGE)
        if new_password == attrs["current_password"]:
            raise field_error("new_password", SAME_AS_CURRENT_MESSAGE)
        try:
            validate_new_password(new_password, user=self.context["request"].user)
        except serializers.ValidationError as exc:
            raise field_error("new_password", exc.detail) from exc
        return attrs
