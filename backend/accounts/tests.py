import os
import re
import runpy
from pathlib import Path
from unittest import mock
from urllib.parse import parse_qs, urlsplit

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from accounts.services import (
    build_verification_url,
    check_email_token,
    uid_and_token,
    user_from_uid,
    verification_uid_and_token,
)
from accounts.throttling import format_wait

User = get_user_model()

REGISTER_URL = "/api/v1/auth/register/"
LOGIN_URL = "/api/v1/auth/login/"
LOGOUT_URL = "/api/v1/auth/logout/"
LOGOUT_ALL_URL = "/api/v1/auth/logout-all/"
ME_URL = "/api/v1/auth/me/"
CSRF_URL = "/api/v1/auth/csrf/"
PASSWORD_CHANGE_URL = "/api/v1/auth/password-change/"
PASSWORD_RESET_URL = "/api/v1/auth/password-reset/"
PASSWORD_RESET_CONFIRM_URL = "/api/v1/auth/password-reset/confirm/"
VERIFY_EMAIL_URL = "/api/v1/auth/verify-email/"
VERIFY_EMAIL_RESEND_URL = "/api/v1/auth/verify-email/resend/"

PASSWORD = "Finova#2025"
NEW_PASSWORD = "OtraClave#2026"

# Settings that make accounts.services.email_delivery_configured() return True.
# send_mail is mocked in those tests, so nothing touches the network.
EMAIL_DELIVERY_ON = {
    "FINOVA_EMAIL_DELIVERY_ENABLED": True,
    "EMAIL_HOST": "smtp.example.com",
    "EMAIL_BACKEND": "django.core.mail.backends.smtp.EmailBackend",
}


def throttle_rates(**rates):
    """override_settings with some throttle rates replaced (e.g. login="2/min")."""
    rest_framework = dict(settings.REST_FRAMEWORK)
    rest_framework["DEFAULT_THROTTLE_RATES"] = {
        **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
        **rates,
    }
    return override_settings(REST_FRAMEWORK=rest_framework)


def sent_link(send_mail_mock):
    message = send_mail_mock.call_args.kwargs["message"]
    return re.search(r"https?://\S+", message).group(0)


class AuthApiTestCase(TestCase):
    def setUp(self):
        # Throttle counters live in the cache: every test starts and ends clean,
        # so tests never throttle each other (or other apps' tests).
        cache.clear()
        self.addCleanup(cache.clear)
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
            PASSWORD_RESET_CONFIRM_URL,
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
            PASSWORD_RESET_CONFIRM_URL,
            {
                "uid": uid,
                "token": "invalido",
                "password": "NuevaClave#2026",
                "password_confirm": "NuevaClave#2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_password_reset_confirm_reports_weak_password_on_field(self):
        user = self.create_user()
        uid, token = uid_and_token(user)

        response = self.client.post(
            PASSWORD_RESET_CONFIRM_URL,
            {"uid": uid, "token": token, "password": "abcdefghij", "password_confirm": "abcdefghij"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data)

    @override_settings(**EMAIL_DELIVERY_ON)
    @mock.patch("accounts.services.send_mail")
    def test_password_reset_email_link(self, send_mail):
        self.create_user()

        self.client.post(PASSWORD_RESET_URL, {"email": "carlos.mendoza@finova.pe"}, format="json")

        parsed = urlsplit(sent_link(send_mail))
        self.assertEqual(parsed.path, "/restablecer-contrasena")
        self.assertEqual(set(parse_qs(parsed.query)), {"uid", "token"})


class EmailVerificationTests(AuthApiTestCase):
    def verify(self, uid, token):
        return self.client.post(VERIFY_EMAIL_URL, {"uid": uid, "token": token}, format="json")

    def test_verification_url_points_to_frontend_route(self):
        user = self.create_user()

        parsed = urlsplit(build_verification_url(user))
        query = parse_qs(parsed.query)

        self.assertEqual(parsed.path, "/verificar-email")
        self.assertEqual(user_from_uid(query["uid"][0]), user)
        self.assertTrue(check_email_token(user, query["token"][0]))

    def test_verify_email_with_valid_token(self):
        user = self.create_user()
        uid, token = verification_uid_and_token(user)

        response = self.verify(uid, token)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["detail"], "Correo verificado correctamente.")
        self.assertTrue(response.data["user"]["email_verified"])
        user.refresh_from_db()
        self.assertTrue(user.email_verified)

    def test_verify_email_with_invalid_token(self):
        user = self.create_user()
        uid, _ = verification_uid_and_token(user)

        response = self.verify(uid, "invalido")

        self.assertEqual(response.status_code, 400)
        user.refresh_from_db()
        self.assertFalse(user.email_verified)

    def test_verify_email_with_unknown_uid(self):
        self.assertEqual(self.verify("bm9wZQ", "1-abc").status_code, 400)

    def test_verification_token_survives_login(self):
        user = self.create_user()
        uid, token = verification_uid_and_token(user)

        self.assertEqual(self.login().status_code, 200)  # updates last_login
        response = self.verify(uid, token)

        self.assertEqual(response.status_code, 200)

    def test_password_reset_token_cannot_verify_email(self):
        user = self.create_user()
        uid, reset_token = uid_and_token(user)

        response = self.verify(uid, reset_token)

        self.assertEqual(response.status_code, 400)
        user.refresh_from_db()
        self.assertFalse(user.email_verified)

    def test_verification_token_cannot_reset_password(self):
        user = self.create_user()
        uid, verification_token = verification_uid_and_token(user)

        response = self.client.post(
            PASSWORD_RESET_CONFIRM_URL,
            {
                "uid": uid,
                "token": verification_token,
                "password": "NuevaClave#2026",
                "password_confirm": "NuevaClave#2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        user.refresh_from_db()
        self.assertTrue(user.check_password(PASSWORD))

    def test_verification_token_is_single_use(self):
        user = self.create_user()
        uid, token = verification_uid_and_token(user)
        self.assertEqual(self.verify(uid, token).status_code, 200)

        user.refresh_from_db()
        self.assertFalse(check_email_token(user, token))
        # A second click on the same link is answered idempotently.
        again = self.verify(uid, token)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.data["detail"], "El correo ya estaba verificado.")

    def test_verified_account_is_not_revealed_without_a_valid_link(self):
        user = self.create_user(email_verified=True)
        uid, reset_token = uid_and_token(user)

        for token in ("invalido", reset_token):
            response = self.verify(uid, token)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(set(response.data), {"detail"})

    def test_email_change_invalidates_pending_link(self):
        user = self.create_user()
        _, token = verification_uid_and_token(user)

        user.email = "otro.correo@finova.pe"
        user.save()

        self.assertFalse(check_email_token(user, token))

    @override_settings(**EMAIL_DELIVERY_ON)
    @mock.patch("accounts.services.send_mail")
    def test_register_sends_working_verification_link(self, send_mail):
        self.assertEqual(self.client.post(REGISTER_URL, self.payload(), format="json").status_code, 201)
        parsed = urlsplit(sent_link(send_mail))
        query = parse_qs(parsed.query)
        self.assertEqual(parsed.path, "/verificar-email")
        self.assertEqual(send_mail.call_args.kwargs["recipient_list"], ["carlos.mendoza@finova.pe"])

        response = self.verify(query["uid"][0], query["token"][0])
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["user"]["email_verified"])


class ResendVerificationTests(AuthApiTestCase):
    def test_requires_authentication(self):
        self.assertEqual(self.client.post(VERIFY_EMAIL_RESEND_URL).status_code, 401)

    @override_settings(**EMAIL_DELIVERY_ON)
    @mock.patch("accounts.services.send_mail")
    def test_already_verified_is_a_noop(self, send_mail):
        self.create_user(email_verified=True)
        self.login()

        response = self.client.post(VERIFY_EMAIL_RESEND_URL)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["email_verified"])
        self.assertIn("ya está verificado", response.data["detail"])
        send_mail.assert_not_called()

    @override_settings(**EMAIL_DELIVERY_ON)
    @mock.patch("accounts.services.send_mail")
    def test_resend_sends_a_valid_link(self, send_mail):
        user = self.create_user()
        self.login()

        response = self.client.post(VERIFY_EMAIL_RESEND_URL)

        self.assertEqual(response.status_code, 202)
        self.assertFalse(response.data["email_verified"])
        self.assertTrue(response.data["email_delivery_configured"])
        send_mail.assert_called_once()
        self.assertEqual(send_mail.call_args.kwargs["recipient_list"], [user.email])
        query = parse_qs(urlsplit(sent_link(send_mail)).query)
        self.assertTrue(check_email_token(user, query["token"][0]))

    def test_resend_without_email_delivery(self):
        self.create_user()
        self.login()

        response = self.client.post(VERIFY_EMAIL_RESEND_URL)

        self.assertEqual(response.status_code, 503)
        self.assertEqual(set(response.data), {"detail"})


class ProfileUpdateTests(AuthApiTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.login()

    def test_update_name_and_currency(self):
        response = self.client.patch(
            ME_URL, {"full_name": "  Carlos   Alberto Mendoza ", "currency": "USD"}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["full_name"], "Carlos Alberto Mendoza")
        self.assertEqual(response.data["currency"], "USD")
        self.assertEqual(response.data["currency_display"], "Dólar estadounidense (USD - $)")
        self.assertEqual(set(response.data), set(self.client.get(ME_URL).data))
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, "Carlos Alberto Mendoza")
        self.assertEqual(self.user.currency, "USD")

    def test_partial_update(self):
        response = self.client.patch(ME_URL, {"currency": "EUR"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["currency"], "EUR")
        self.assertEqual(response.data["full_name"], "Carlos Mendoza")

    def test_invalid_currency(self):
        response = self.client.patch(ME_URL, {"currency": "BTC"}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("currency", response.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.currency, "PEN")

    def test_invalid_full_name(self):
        for value in ("", " a "):
            response = self.client.patch(ME_URL, {"full_name": value}, format="json")
            self.assertEqual(response.status_code, 400, value)
            self.assertIn("full_name", response.data)

    def test_email_is_not_editable(self):
        response = self.client.patch(
            ME_URL, {"email": "nuevo@finova.pe", "full_name": "Carlos M"}, format="json"
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "carlos.mendoza@finova.pe")
        self.assertEqual(self.user.full_name, "Carlos Mendoza")

    def test_sending_back_the_user_payload_only_updates_editable_fields(self):
        payload = dict(self.client.get(ME_URL).data)
        payload.update({"email": "CARLOS.MENDOZA@FINOVA.PE", "email_verified": True, "full_name": "Carlos M"})

        response = self.client.patch(ME_URL, payload, format="json")

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, "Carlos M")
        self.assertFalse(self.user.email_verified)

    def test_put_is_not_allowed(self):
        self.assertEqual(self.client.put(ME_URL, {"currency": "USD"}, format="json").status_code, 405)

    def test_requires_authentication(self):
        self.client.post(LOGOUT_URL)
        self.assertEqual(self.client.patch(ME_URL, {"currency": "USD"}, format="json").status_code, 401)

    def test_requires_csrf_token(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.user)

        self.assertEqual(client.patch(ME_URL, {"currency": "USD"}, format="json").status_code, 403)

        token = client.get(CSRF_URL).data["csrfToken"]
        response = client.patch(ME_URL, {"currency": "USD"}, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)


class PasswordChangeTests(AuthApiTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.login()

    def change(self, current=PASSWORD, new=NEW_PASSWORD, confirm=None, client=None):
        return (client or self.client).post(
            PASSWORD_CHANGE_URL,
            {
                "current_password": current,
                "new_password": new,
                "new_password_confirm": new if confirm is None else confirm,
            },
            format="json",
        )

    def login_on_new_client(self, password):
        client = APIClient()
        response = client.post(LOGIN_URL, {"email": self.user.email, "password": password}, format="json")
        return client, response

    def test_change_password_keeps_current_session_and_closes_others(self):
        other_device, _ = self.login_on_new_client(PASSWORD)
        self.assertEqual(other_device.get(ME_URL).status_code, 200)
        old_csrf_secret = self.client.cookies["csrftoken"].value

        response = self.change()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["detail"], "Contraseña actualizada correctamente.")
        self.assertEqual(response.data["user"]["id"], self.user.id)
        self.assertTrue(response.data["csrfToken"])
        self.assertNotEqual(self.client.cookies["csrftoken"].value, old_csrf_secret)

        self.assertEqual(self.client.get(ME_URL).status_code, 200)
        self.assertEqual(other_device.get(ME_URL).status_code, 401)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PASSWORD))
        self.assertEqual(self.login_on_new_client(NEW_PASSWORD)[1].status_code, 200)
        self.assertEqual(self.login_on_new_client(PASSWORD)[1].status_code, 401)

    def test_change_password_keeps_remember_me(self):
        self.client.post(LOGOUT_URL)
        self.login(remember_me=True)

        self.assertEqual(self.change().status_code, 200)

        self.assertGreater(self.client.session.get_expiry_age(), 60 * 60 * 24 * 20)

    def test_wrong_current_password(self):
        response = self.change(current="Incorrecta#2025")

        self.assertEqual(response.status_code, 400)
        self.assertIn("current_password", response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))

    def test_confirmation_mismatch(self):
        response = self.change(confirm="Distinta#2026")

        self.assertEqual(response.status_code, 400)
        self.assertIn("new_password_confirm", response.data)

    def test_weak_or_common_passwords_are_rejected(self):
        for weak in ("abcdefghij", "Ab#1", "12345678", "password123"):
            response = self.change(new=weak)
            self.assertEqual(response.status_code, 400, weak)
            self.assertIn("new_password", response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))

    def test_new_password_must_differ(self):
        response = self.change(new=PASSWORD)

        self.assertEqual(response.status_code, 400)
        self.assertIn("new_password", response.data)

    def test_missing_fields(self):
        response = self.client.post(PASSWORD_CHANGE_URL, {}, format="json")

        self.assertEqual(response.status_code, 400)
        for field in ("current_password", "new_password", "new_password_confirm"):
            self.assertIn(field, response.data)

    def test_requires_authentication(self):
        self.assertEqual(self.change(client=APIClient()).status_code, 401)


class LogoutAllTests(AuthApiTestCase):
    def test_logout_all_closes_every_session(self):
        user = self.create_user()
        self.login()
        other_device = APIClient()
        other_device.post(LOGIN_URL, {"email": user.email, "password": PASSWORD}, format="json")
        self.assertEqual(other_device.get(ME_URL).status_code, 200)

        response = self.client.post(LOGOUT_ALL_URL)

        self.assertEqual(response.status_code, 200)
        self.assertIn("detail", response.data)
        self.assertEqual(self.client.get(ME_URL).status_code, 401)
        self.assertEqual(other_device.get(ME_URL).status_code, 401)
        user.refresh_from_db()
        self.assertEqual(user.session_version, 1)

        # Signing in again works normally afterwards.
        self.assertEqual(self.login().status_code, 200)
        self.assertEqual(self.client.get(ME_URL).status_code, 200)

    def test_requires_authentication(self):
        self.assertEqual(self.client.post(LOGOUT_ALL_URL).status_code, 401)

    def test_existing_sessions_survive_the_migration(self):
        # session_version == 0 must reproduce Django's default hash exactly.
        user = self.create_user()
        self.assertEqual(user.get_session_auth_hash(), user._get_session_auth_hash())
        user.session_version = 1
        self.assertNotEqual(user.get_session_auth_hash(), user._get_session_auth_hash())


class ThrottlingTests(AuthApiTestCase):
    def assertThrottled(self, response, message_start):
        self.assertEqual(response.status_code, 429)
        self.assertEqual(set(response.data), {"detail"})  # the SPA only reads `detail`
        self.assertTrue(str(response.data["detail"]).startswith(message_start), response.data["detail"])
        self.assertGreater(int(response["Retry-After"]), 0)

    @throttle_rates(login="2/min")
    def test_login_is_throttled(self):
        self.create_user()
        self.assertEqual(self.login(password="Incorrecta#1").status_code, 401)
        self.assertEqual(self.login(password="Incorrecta#2").status_code, 401)

        response = self.login()  # even the right password is blocked now

        self.assertThrottled(response, "Demasiados intentos de inicio de sesión.")
        self.assertIn("Inténtalo de nuevo en", response.data["detail"])

    @throttle_rates(login="1/min")
    def test_login_throttle_is_per_ip_and_ignores_forwarded_for(self):
        self.create_user()
        self.login(password="Incorrecta#1")
        credentials = {"email": "carlos.mendoza@finova.pe", "password": PASSWORD}

        spoofed = self.client.post(LOGIN_URL, credentials, format="json", HTTP_X_FORWARDED_FOR="203.0.113.7")
        self.assertEqual(spoofed.status_code, 429)

        other_ip = self.client.post(LOGIN_URL, credentials, format="json", REMOTE_ADDR="198.51.100.20")
        self.assertEqual(other_ip.status_code, 200)

    @throttle_rates(register="1/hour")
    def test_register_is_throttled(self):
        self.assertEqual(self.client.post(REGISTER_URL, self.payload(), format="json").status_code, 201)

        response = self.client.post(REGISTER_URL, self.payload(email="otra@finova.pe"), format="json")

        self.assertThrottled(response, "Demasiados intentos de registro")
        self.assertFalse(User.objects.filter(email="otra@finova.pe").exists())

    @throttle_rates(password_reset="2/hour")
    def test_password_reset_is_throttled(self):
        for _ in range(2):
            response = self.client.post(PASSWORD_RESET_URL, {"email": "nadie@finova.pe"}, format="json")
            self.assertEqual(response.status_code, 202)

        response = self.client.post(PASSWORD_RESET_URL, {"email": "nadie@finova.pe"}, format="json")

        self.assertThrottled(response, "Demasiadas solicitudes de recuperación de contraseña.")

    @throttle_rates(verify_resend="1/hour")
    def test_verify_resend_is_throttled_per_user(self):
        self.create_user()
        self.login()
        self.assertEqual(self.client.post(VERIFY_EMAIL_RESEND_URL).status_code, 503)

        self.assertThrottled(self.client.post(VERIFY_EMAIL_RESEND_URL), "Ya solicitaste varios enlaces")

        # Another account from the same IP has its own counter.
        self.create_user(email="ana@finova.pe", full_name="Ana Torres")
        other = APIClient()
        other.post(LOGIN_URL, {"email": "ana@finova.pe", "password": PASSWORD}, format="json")
        self.assertEqual(other.post(VERIFY_EMAIL_RESEND_URL).status_code, 503)

    @throttle_rates(password_change="1/hour")
    def test_password_change_is_throttled(self):
        self.create_user()
        self.login()
        body = {"current_password": "Mala#1", "new_password": NEW_PASSWORD, "new_password_confirm": NEW_PASSWORD}
        self.assertEqual(self.client.post(PASSWORD_CHANGE_URL, body, format="json").status_code, 400)

        response = self.client.post(PASSWORD_CHANGE_URL, body, format="json")

        self.assertThrottled(response, "Demasiados intentos de cambio de contraseña.")

    def test_default_rates_do_not_block_normal_use(self):
        self.create_user()
        for _ in range(3):
            self.assertEqual(self.login().status_code, 200)


class ThrottleMessageTests(SimpleTestCase):
    def test_format_wait(self):
        self.assertEqual(format_wait(None), "más tarde")
        self.assertEqual(format_wait(0.2), "en 1 segundo")
        self.assertEqual(format_wait(42.1), "en 43 segundos")
        self.assertEqual(format_wait(61), "en 2 minutos")
        self.assertEqual(format_wait(3600), "en 1 hora")
        self.assertEqual(format_wait(7300), "en 3 horas")


SETTINGS_PATH = Path(settings.BASE_DIR) / "config" / "settings.py"


def load_settings(**env):
    """Execute config/settings.py in isolation with a clean DJANGO_*/FINOVA_* environment."""
    clean = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith(("DJANGO_", "FINOVA_")) or key == "DJANGO_SETTINGS_MODULE"
    }
    clean.update(env)
    with mock.patch.dict(os.environ, clean, clear=True):
        return runpy.run_path(str(SETTINGS_PATH))


class SettingsHardeningTests(SimpleTestCase):
    def test_local_development_defaults(self):
        namespace = load_settings()

        self.assertTrue(namespace["DEBUG"])
        self.assertEqual(namespace["SECRET_KEY"], namespace["INSECURE_DEV_SECRET_KEY"])

    def test_production_requires_a_real_secret_key(self):
        for secret in (None, "", "django-insecure-local-development-key", "django-insecure-abc123"):
            env = {"DJANGO_DEBUG": "false"}
            if secret is not None:
                env["DJANGO_SECRET_KEY"] = secret
            with self.subTest(secret=secret), self.assertRaises(ImproperlyConfigured):
                load_settings(**env)

    def test_production_with_real_secret_key(self):
        namespace = load_settings(DJANGO_DEBUG="False", DJANGO_SECRET_KEY="k" * 50)

        self.assertFalse(namespace["DEBUG"])

    def test_throttle_rates_defaults_and_env_overrides(self):
        rates = load_settings()["REST_FRAMEWORK"]["DEFAULT_THROTTLE_RATES"]
        self.assertEqual(
            rates,
            {
                "login": "10/min",
                "register": "10/hour",
                "password_reset": "5/hour",
                "verify_resend": "5/hour",
                "password_change": "10/hour",
            },
        )

        overridden = load_settings(FINOVA_THROTTLE_LOGIN_RATE="3/min")
        self.assertEqual(overridden["REST_FRAMEWORK"]["DEFAULT_THROTTLE_RATES"]["login"], "3/min")
        self.assertEqual(overridden["REST_FRAMEWORK"]["NUM_PROXIES"], 0)

    def test_every_throttle_rate_keeps_its_environment_variable(self):
        env = {
            "FINOVA_THROTTLE_REGISTER_RATE": "1/min",
            "FINOVA_THROTTLE_PASSWORD_RESET_RATE": "2/min",
            "FINOVA_THROTTLE_VERIFY_RESEND_RATE": "3/min",
            "FINOVA_THROTTLE_PASSWORD_CHANGE_RATE": "4/min",
        }
        rates = load_settings(**env)["REST_FRAMEWORK"]["DEFAULT_THROTTLE_RATES"]

        self.assertEqual(
            rates,
            {"login": "10/min", "register": "1/min", "password_reset": "2/min", "verify_resend": "3/min", "password_change": "4/min"},
        )


class HealthTests(AuthApiTestCase):
    def test_health_endpoint_still_available(self):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "proyecto-lenguaje-api"})

    def test_health_only_accepts_safe_methods(self):
        for url in ("/api/health/", "/api/v1/health/"):
            with self.subTest(url=url):
                self.assertEqual(self.client.head(url).status_code, 200)
                for method in (self.client.post, self.client.put, self.client.delete):
                    self.assertEqual(method(url).status_code, 405)
