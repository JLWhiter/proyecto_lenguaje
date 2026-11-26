from django.http import Http404
from rest_framework.exceptions import NotAcceptable
from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.renderers import BaseRenderer, JSONRenderer

from .csv_export import rows_to_csv
from .xlsx_export import XLSX_MEDIA_TYPE

FORMAT_PARAM = "formato"


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


class XLSXRenderer(BaseRenderer):
    """Responde el libro de Excel que la vista entrega ya armado (bytes).

    Un error no puede ser un Excel: ``errors_as_json`` lo responde como JSON.
    """

    media_type = XLSX_MEDIA_TYPE
    format = "xlsx"
    charset = None
    render_style = "binary"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class ExportNegotiation(DefaultContentNegotiation):
    """Elige el formato por ``?formato=xlsx|csv``; si no viene, por el encabezado Accept.

    Nunca responde 406 (ni 404 por un ``?format=`` desconocido): si nada
    coincide se usa el primer renderer de la vista (Excel).
    """

    def select_renderer(self, request, renderers, format_suffix=None):
        wanted = request.query_params.get(FORMAT_PARAM, "")
        for renderer in renderers:
            if renderer.format == wanted:
                return renderer, renderer.media_type
        try:
            return super().select_renderer(request, renderers, format_suffix)
        except (NotAcceptable, Http404):
            return renderers[0], renderers[0].media_type


def errors_as_json(response):
    """Las respuestas de error que iban a ser un Excel se envían como JSON legible."""
    if response.status_code >= 400 and isinstance(getattr(response, "accepted_renderer", None), XLSXRenderer):
        response.accepted_renderer = JSONRenderer()
        response.accepted_media_type = JSONRenderer.media_type
    return response
