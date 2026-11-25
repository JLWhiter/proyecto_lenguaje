from rest_framework.renderers import BaseRenderer

from .csv_export import rows_to_csv


def error_text(value):
    return value if isinstance(value, str) else " ".join(map(str, value))


class CSVRenderer(BaseRenderer):
    """Responde ``text/csv``. La vista entrega el CSV ya armado como texto.

    Los errores (401, 400...) llegan como diccionario y se escriben como filas
    "campo,mensaje", para no responder 406 a un cliente que pidió CSV.
    """

    media_type = "text/csv"
    format = "csv"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if isinstance(data, dict):
            data = rows_to_csv([("campo", "mensaje"), *((key, error_text(value)) for key, value in data.items())])
        return data.encode(self.charset)
