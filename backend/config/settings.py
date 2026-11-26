import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured


def env_bool(name, default="false"):
    return os.environ.get(name, default).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


BASE_DIR = Path(__file__).resolve().parent.parent

INSECURE_DEV_SECRET_KEY = "django-insecure-local-development-key"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", INSECURE_DEV_SECRET_KEY)
# DEBUG stays on by default so local development works out of the box. Any
# deployment must set DJANGO_DEBUG=false *and* its own DJANGO_SECRET_KEY.
DEBUG = env_bool("DJANGO_DEBUG", "true")

if not DEBUG and (
    not SECRET_KEY.strip()
    or SECRET_KEY == INSECURE_DEV_SECRET_KEY
    or SECRET_KEY.startswith("django-insecure-")
):
    raise ImproperlyConfigured(
        "Con DJANGO_DEBUG=false debes definir DJANGO_SECRET_KEY con un valor secreto propio "
        "(no uses la clave insegura de desarrollo)."
    )

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "core",
    "accounts",
    "goals",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "accounts.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
    # Rates for the scoped throttles used by accounts views ("N/second|minute|hour|day").
    # Counters live in the default cache (local memory per process unless CACHES is set).
    "DEFAULT_THROTTLE_RATES": {
        "login": os.environ.get("FINOVA_THROTTLE_LOGIN_RATE", "10/min"),
        "register": os.environ.get("FINOVA_THROTTLE_REGISTER_RATE", "10/hour"),
        "password_reset": os.environ.get("FINOVA_THROTTLE_PASSWORD_RESET_RATE", "5/hour"),
        "verify_resend": os.environ.get("FINOVA_THROTTLE_VERIFY_RESEND_RATE", "5/hour"),
        "password_change": os.environ.get("FINOVA_THROTTLE_PASSWORD_CHANGE_RATE", "10/hour"),
    },
    # Anonymous throttles are keyed by client IP. 0 = trust only REMOTE_ADDR, so a
    # forged X-Forwarded-For header cannot bypass the limits. Set it to the number
    # of reverse proxies in front of Django when deployed behind one.
    "NUM_PROXIES": int(os.environ.get("DJANGO_NUM_PROXIES", "0")),
}

# --- Sessions and CSRF (cookie based, no tokens in localStorage) ---
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = env_bool("DJANGO_COOKIE_SECURE", "false")
CSRF_COOKIE_HTTPONLY = False  # the SPA reads the CSRF token to send the X-CSRFToken header
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = env_bool("DJANGO_COOKIE_SECURE", "false")
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14

CSRF_TRUSTED_ORIGINS = env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    ",".join(
        [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
            "http://127.0.0.1:5175",
        ]
    ),
)

CORS_ALLOW_CREDENTIALS = True
if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r"^http://localhost:\d+$",
        r"^http://127\.0\.0\.1:\d+$",
    ]
else:
    CORS_ALLOWED_ORIGINS = env_list("DJANGO_CORS_ALLOWED_ORIGINS")

# HTTPS hardening is opt-in so local development over HTTP keeps working.
SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", "false")
SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_SECURE_HSTS_SECONDS", "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_SECONDS > 0
SECURE_HSTS_PRELOAD = SECURE_HSTS_SECONDS > 0
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

# --- Email (disabled until real SMTP credentials are provided) ---
EMAIL_BACKEND = os.environ.get(
    "DJANGO_EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST = os.environ.get("DJANGO_EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("DJANGO_EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("DJANGO_EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("DJANGO_EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("DJANGO_EMAIL_USE_TLS", "true")
DEFAULT_FROM_EMAIL = os.environ.get("DJANGO_DEFAULT_FROM_EMAIL", "Finova <no-reply@finova.local>")
FINOVA_EMAIL_DELIVERY_ENABLED = env_bool("FINOVA_EMAIL_DELIVERY_ENABLED", "false")
FINOVA_FRONTEND_URL = os.environ.get("FINOVA_FRONTEND_URL", "http://localhost:5173")

LANGUAGE_CODE = "es"
TIME_ZONE = "America/Lima"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
