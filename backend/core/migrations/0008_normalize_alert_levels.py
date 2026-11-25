"""Unifica los niveles de alerta antiguos en ``info|warning|danger|success``.

Antes convivían colores ("rojo", "amber", "indigo", "green"...) que cada
pantalla traducía a su manera. Las alertas existentes quedan con la regla
``other`` (el motor de alertas no las toca) y con la severidad de su nivel.
"""

from django.db import migrations

LEVELS = {
    "rojo": "danger", "red": "danger", "danger": "danger",
    "amber": "warning", "ambar": "warning", "ámbar": "warning", "yellow": "warning", "warning": "warning",
    "indigo": "info", "blue": "info", "info": "info",
    "green": "success", "verde": "success", "success": "success",
}
SEVERITY = {"success": 0, "info": 1, "warning": 2, "danger": 3}
LEGACY_LEVELS = {"danger": "rojo", "warning": "amber", "info": "indigo", "success": "green"}


def normalize_levels(apps, schema_editor):
    FinanceAlert = apps.get_model("core", "FinanceAlert")
    database = schema_editor.connection.alias
    alerts = list(FinanceAlert.objects.using(database).only("id", "level"))
    for alert in alerts:
        alert.level = LEVELS.get((alert.level or "").strip().casefold(), "info")
        alert.severity = SEVERITY[alert.level]
        alert.rule = "other"
    FinanceAlert.objects.using(database).bulk_update(alerts, ["level", "severity", "rule"], batch_size=500)


def restore_legacy_levels(apps, schema_editor):
    FinanceAlert = apps.get_model("core", "FinanceAlert")
    database = schema_editor.connection.alias
    for level, legacy in LEGACY_LEVELS.items():
        FinanceAlert.objects.using(database).filter(level=level).update(level=legacy)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0007_alert_engine"),
    ]

    operations = [
        migrations.RunPython(normalize_levels, restore_legacy_levels),
    ]
