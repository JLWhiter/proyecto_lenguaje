from django.contrib import admin
from django.urls import include, path
from core.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="legacy-health"),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/", include("core.urls")),
]
