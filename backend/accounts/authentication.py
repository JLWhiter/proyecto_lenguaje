from rest_framework.authentication import SessionAuthentication as DRFSessionAuthentication


class SessionAuthentication(DRFSessionAuthentication):
    """Session authentication that answers 401 instead of 403 when logged out."""

    def authenticate_header(self, request):
        return "Session"
