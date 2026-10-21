import io

from pypdf import PdfReader
from pypdf.errors import PdfReadError

PDF_MAGIC = b"%PDF-"


class PdfExtractionError(Exception):
    pass


def extract_pages(data: bytes) -> list[str]:
    """Return the text of each page. Blocking: call via asyncio.to_thread."""
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            reader.decrypt("")
        return [page.extract_text() or "" for page in reader.pages]
    except (PdfReadError, ValueError, KeyError) as exc:
        raise PdfExtractionError(f"Could not read PDF: {exc}") from exc
