from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.crypto import salted_hmac

# Same salt Django uses, so session_version == 0 yields Django's exact hash and
# sessions created before this field existed stay valid.
SESSION_AUTH_HASH_SALT = "django.contrib.auth.models.AbstractBaseUser.get_session_auth_hash"


class UserManager(BaseUserManager):
    """Manager that uses email as the unique authentication identifier."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("El correo electrónico es obligatorio.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Un superusuario debe tener is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Un superusuario debe tener is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class Currency(models.TextChoices):
    PEN = "PEN", "Sol Peruano (PEN - S/)"
    USD = "USD", "Dólar estadounidense (USD - $)"
    EUR = "EUR", "Euro (EUR - €)"


class User(AbstractUser):
    """Custom Finova user authenticated by email."""

    username = None
    email = models.EmailField("correo electrónico", unique=True)
    full_name = models.CharField("nombre completo", max_length=150)
    currency = models.CharField(
        "moneda principal",
        max_length=3,
        choices=Currency.choices,
        default=Currency.PEN,
    )
    email_verified = models.BooleanField("correo verificado", default=False)
    session_version = models.PositiveIntegerField(
        "versión de sesión",
        default=0,
        editable=False,
        help_text="Se incrementa para cerrar todas las sesiones activas del usuario.",
    )
    created_at = models.DateTimeField("fecha de creación", auto_now_add=True)
    updated_at = models.DateTimeField("fecha de actualización", auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    objects = UserManager()

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"

    def __str__(self):
        return self.email

    def get_full_name(self):
        return self.full_name

    def get_short_name(self):
        return self.full_name.split(" ")[0] if self.full_name else self.email

    # --- Session invalidation -------------------------------------------------
    # Django stores this hash in the session at login and logs the session out
    # when it no longer matches. Including ``session_version`` lets
    # "logout everywhere" invalidate every session with a single UPDATE.

    def _session_auth_hash(self, secret=None):
        value = self.password
        if self.session_version:
            value = f"{value}:{self.session_version}"
        return salted_hmac(SESSION_AUTH_HASH_SALT, value, secret=secret, algorithm="sha256").hexdigest()

    def get_session_auth_hash(self):
        return self._session_auth_hash()

    def get_session_auth_fallback_hash(self):
        for fallback_secret in settings.SECRET_KEY_FALLBACKS:
            yield self._session_auth_hash(secret=fallback_secret)
