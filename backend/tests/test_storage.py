import uuid

from app.services.storage import document_key, user_prefix


def test_document_keys_live_under_the_owner_prefix() -> None:
    user_id, document_id = uuid.uuid4(), uuid.uuid4()
    key = document_key(user_id, document_id)
    assert key == f"users/{user_id}/documents/{document_id}.pdf"
    assert key.startswith(user_prefix(user_id))


def test_user_prefixes_do_not_overlap() -> None:
    a, b = user_prefix(uuid.uuid4()), user_prefix(uuid.uuid4())
    assert not a.startswith(b) and not b.startswith(a)
    assert a.endswith("/")
