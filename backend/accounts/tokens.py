import copy

from django.contrib.auth.tokens import PasswordResetTokenGenerator, default_token_generator


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Tokens for the email verification links.

    - Its own ``key_salt``: a verification token never validates as a password
      reset token and vice versa.
    - The hash includes ``email_verified`` (the link stops working once it has
      been used) and the email (changing the address invalidates old links).
    - ``last_login`` and the password are *not* part of the hash, so logging in
      does not break a pending verification link.

    Tokens expire after ``settings.PASSWORD_RESET_TIMEOUT`` (Django default: 3 days).
    """

    key_salt = "accounts.tokens.EmailVerificationTokenGenerator"

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}:{user.email}:{int(bool(user.email_verified))}:{timestamp}"

    def check_token_already_used(self, user, token):
        """True if ``token`` is the link that verified this (already verified) user.

        Lets a second click on the same link answer "already verified" instead of
        an error, without letting arbitrary tokens learn the account state.
        """
        if not user.email_verified:
            return False
        snapshot = copy.copy(user)
        snapshot.email_verified = False
        return self.check_token(snapshot, token)


email_verification_token_generator = EmailVerificationTokenGenerator()

# Password reset keeps Django's generator: its hash includes the password and
# last_login, so a reset link stops working after the password changes.
password_reset_token_generator = default_token_generator
