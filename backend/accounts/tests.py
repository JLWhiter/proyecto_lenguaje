from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.services import uid_and_token

User = get_user_model()

REGISTER_URL = "/api/v1/auth/register/"
LOGIN_URL = "/api/v1/auth/login/"
LOGOUT_URL = "/api/v1/auth/logout/"
ME_URL = "/api/v1/auth/me/"
PASSWORD_RESET_URL = "/api/v1/auth/password-reset/"
VERIFY_EMAIL_URL = "/api/v1/auth/verify-email/"


class AuthApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def payload(self, **overrides):
        data = {
            "full_name": "Carlos Mendoza",
            "email": "carlos.mendoza@finova.pe",
            "currency": "PEN",
            "password": "Finova#2025",
            "password_confirm": "Finova#2025",
            "accept_terms": True,
        }
        data.update(overrides)
        return data

    def create_user(self, **overrides):
        data = {
            "email": "carlos.mendoza@finova.pe",
            "full_name": "Carlos Mendoza",
            "password": "Finova#2025",
            "currency": "PEN",
        }
        data.update(overrides)
        return User.objects.create_user(**data)

    def login(self, email="carlos.mendoza@finova.pe", password="Finova#2025", **extra):
        return self.client.post(LOGIN_URL, {"email": email, "password": password, **extra}, format="json")


class RegisterTests(AuthApiTestCase):
    def test_register_success(self):
        response = self.client.post(REGISTER_URL, self.payload(), format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["user"]["email"], "carlos.mendoza@finova.pe")
        self.assertEqual(response.data["user"]["currency"], "PEN")
        self.assertFalse(response.data["user"]["email_verified"])

        user = User.objects.get(email="carlos.mendoza@finova.pe")
        self.assertTrue(user.check_password("Finova#2025"))
        self.assertNotEqual(user.password, "Finova#2025")
        self.assertTrue(user.password.startswith("pbkdf2_"))

        # Registration keeps the user signed in through the secure session cookie.
        me = self.client.get(ME_URL)
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["email"], user.email)

    def test_register_duplicate_email(self):
        self.create_user()
        response = self.client.post(REGISTER_URL, self.payload(), format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_register_invalid_email(self):
        response = self.client.post(REGISTER_URL, self.payload(email="correo-invalido"), format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_register_weak_password(self):
        response = self.client.post(
            REGISTER_URL,
            self.payload(password="abcdefgh", password_confirm="abcdefgh"),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data)

    def test_register_short_password(self):
        response = self.client.post(
            REGISTER_URL,
            self.payload(password="Ab#1", password_confirm="Ab#1"),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data)

    def test_register_password_mismatch(self):
        response = self.client.post(
            REGISTER_URL,
            self.payload(password_confirm="Otra#2025"),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("password_confirm", response.data)

    def test_register_empty_fields(self):
        response = self.client.post(REGISTER_URL, {}, format="json")

        self.assertEqual(response.status_code, 400)
        for field in ("full_name", "email", "password", "password_confirm", "accept_terms"):
            self.assertIn(field, response.data)

    def test_register_without_terms(self):
        response = self.client.post(REGISTER_URL, self.payload(accept_terms=False), format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("accept_terms", response.data)
        self.assertFalse(User.objects.filter(email="carlos.mendoza@finova.pe").exists())

    def test_register_invalid_currency(self):
        response = self.client.post(REGISTER_URL, self.payload(currency="BTC"), format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("currency", response.data)


class LoginTests(AuthApiTestCase):
    def test_login_success(self):
        self.create_user()
        response = self.login()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["email"], "carlos.mendoza@finova.pe")

        me = self.client.get(ME_URL)
        self.assertEqual(me.status_code, 200)

    def test_login_remember_me_extends_session(self):
        self.create_user()
        response = self.login(remember_me=True)

        self.assertEqual(response.status_code, 200)
        self.assertGreater(self.client.session.get_expiry_age(), 60 * 60 * 24 * 20)
        self.assertFalse(self.client.session.get_expire_at_browser_close())

    def test_login_without_remember_me_expires_with_browser(self):
        self.create_user()
        response = self.login(remember_me=False)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.client.session.get_expire_at_browser_close())

    def test_login_wrong_password(self):
        self.create_user()
        response = self.login(password="Incorrecta#2025")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.data["detail"],
            "Correo o contraseña incorrectos. Verifica tus datos.",
        )

    def test_login_nonexistent_email(self):
        response = self.login(email="nadie@finova.pe")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.data["detail"],
            "Correo o contraseña incorrectos. Verifica tus datos.",
        )

    def test_login_is_case_insensitive_for_email(self):
        self.create_user()
        response = self.login(email="CARLOS.MENDOZA@FINOVA.PE")

        self.assertEqual(response.status_code, 200)


class SessionTests(AuthApiTestCase):
    def test_session_endpoint_for_guest(self):
        response = self.client.get("/api/v1/auth/session/")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["authenticated"])
        self.assertIsNone(response.data["user"])

    def test_session_endpoint_for_authenticated_user(self):
        user = self.create_user()
        self.login()

        response = self.client.get("/api/v1/auth/session/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["authenticated"])
        self.assertEqual(response.data["user"]["id"], user.id)

    def test_me_requires_authentication(self):
        response = self.client.get(ME_URL)

        self.assertEqual(response.status_code, 401)

    def test_me_returns_authenticated_user(self):
        user = self.create_user()
        self.login()

        response = self.client.get(ME_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], user.id)
        self.assertEqual(response.data["full_name"], user.full_name)
        self.assertNotIn("password", response.data)

    def test_logout_closes_session(self):
        self.create_user()
        self.login()

        response = self.client.post(LOGOUT_URL)

        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.client.get(ME_URL).status_code, 401)

    def test_logout_requires_authentication(self):
        self.assertEqual(self.client.post(LOGOUT_URL).status_code, 401)


class PasswordResetTests(AuthApiTestCase):
    def test_password_reset_does_not_reveal_accounts(self):
        self.create_user()

        existing = self.client.post(PASSWORD_RESET_URL, {"email": "carlos.mendoza@finova.pe"}, format="json")
        unknown = self.client.post(PASSWORD_RESET_URL, {"email": "nadie@finova.pe"}, format="json")

        self.assertEqual(existing.status_code, 202)
        self.assertEqual(unknown.status_code, 202)
        self.assertEqual(existing.data["detail"], unknown.data["detail"])
        self.assertFalse(existing.data["email_delivery_configured"])

    def test_password_reset_rejects_invalid_email(self):
        response = self.client.post(PASSWORD_RESET_URL, {"email": "no-es-correo"}, format="json")

        self.assertEqual(response.status_code, 400)

    def test_password_reset_confirm_changes_password(self):
        user = self.create_user()
        uid, token = uid_and_token(user)

        response = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {
                "uid": uid,
                "token": token,
                "password": "NuevaClave#2026",
                "password_confirm": "NuevaClave#2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password("NuevaClave#2026"))

    def test_password_reset_confirm_rejects_invalid_token(self):
        user = self.create_user()
        uid, _ = uid_and_token(user)

        response = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {
                "uid": uid,
                "token": "invalido",
                "password": "NuevaClave#2026",
                "password_confirm": "NuevaClave#2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)


class EmailVerificationTests(AuthApiTestCase):
    def test_verify_email_with_valid_token(self):
        user = self.create_user()
        uid, token = uid_and_token(user)

        response = self.client.post(VERIFY_EMAIL_URL, {"uid": uid, "token": token}, format="json")

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)

    def test_verify_email_with_invalid_token(self):
        user = self.create_user()
        uid, _ = uid_and_token(user)

        response = self.client.post(VERIFY_EMAIL_URL, {"uid": uid, "token": "invalido"}, format="json")

        self.assertEqual(response.status_code, 400)
        user.refresh_from_db()
        self.assertFalse(user.email_verified)


class HealthTests(AuthApiTestCase):
    def test_health_endpoint_still_available(self):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
