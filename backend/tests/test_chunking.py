import pytest

from app.services.chunking import chunk_pages, normalize_whitespace, split_text


def test_short_text_is_single_chunk() -> None:
    assert split_text("Hello world.", chunk_size=100, overlap=10) == ["Hello world."]


def test_chunks_respect_size_limit() -> None:
    text = " ".join(f"word{i}" for i in range(2000))
    chunks = split_text(text, chunk_size=200, overlap=40)
    assert len(chunks) > 1
    assert all(len(chunk) <= 200 for chunk in chunks)


def test_chunks_overlap() -> None:
    text = " ".join(f"w{i}" for i in range(500))
    first, second, *_ = split_text(text, chunk_size=100, overlap=30)
    last_word_of_first = first.split()[-1]
    assert last_word_of_first in second.split()[:10]


def test_no_text_lost() -> None:
    words = [f"token{i}" for i in range(1000)]
    chunks = split_text(" ".join(words), chunk_size=150, overlap=0)
    assert " ".join(chunks).split() == words


def test_overlap_must_be_smaller_than_size() -> None:
    with pytest.raises(ValueError):
        split_text("abc", chunk_size=10, overlap=10)


def test_chunk_pages_tracks_page_numbers_and_skips_blank_pages() -> None:
    chunks = chunk_pages(["First page.", "   ", "Third page."], chunk_size=100, overlap=10)
    assert [(c.page_number, c.content) for c in chunks] == [
        (1, "First page."),
        (3, "Third page."),
    ]


def test_normalize_whitespace() -> None:
    assert normalize_whitespace("a \t b\n\n\n\nc\x00") == "a b\n\nc"
