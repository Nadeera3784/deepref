"""Split page text into overlapping chunks sized for the embedding model."""

import re
from dataclasses import dataclass

_SEPARATORS = ("\n\n", "\n", ". ", " ")


@dataclass(frozen=True, slots=True)
class TextChunk:
    page_number: int
    content: str


def normalize_whitespace(text: str) -> str:
    text = text.replace("\x00", "")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _split(text: str, chunk_size: int, separators: tuple[str, ...]) -> list[str]:
    """Recursively split text into pieces no longer than chunk_size."""
    if len(text) <= chunk_size:
        return [text]
    if not separators:
        return [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]

    separator, rest = separators[0], separators[1:]
    pieces: list[str] = []
    parts = text.split(separator)
    for position, part in enumerate(parts):
        if not part:
            continue
        keep = separator.strip() and position < len(parts) - 1
        piece = part + separator if keep else part
        if len(piece) > chunk_size:
            pieces.extend(_split(piece, chunk_size, rest))
        else:
            pieces.append(piece)
    return pieces


def split_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    chunks: list[str] = []
    current = ""
    for piece in _split(text, chunk_size, _SEPARATORS):
        joiner = "" if not current or current.endswith((" ", "\n")) else " "
        if current and len(current) + len(joiner) + len(piece) > chunk_size:
            chunks.append(current.strip())
            tail = current[-overlap:] if overlap else ""
            if " " in tail:
                tail = tail[tail.index(" ") + 1 :]
            current = tail
            joiner = " " if tail and not tail.endswith((" ", "\n")) else ""
        current += joiner + piece
    if current.strip():
        chunks.append(current.strip())
    return chunks


def chunk_pages(pages: list[str], chunk_size: int, overlap: int) -> list[TextChunk]:
    """Chunk each page separately so every chunk can cite a single page number."""
    result: list[TextChunk] = []
    for page_number, raw in enumerate(pages, start=1):
        text = normalize_whitespace(raw)
        if not text:
            continue
        result.extend(
            TextChunk(page_number=page_number, content=chunk)
            for chunk in split_text(text, chunk_size, overlap)
            if chunk
        )
    return result
